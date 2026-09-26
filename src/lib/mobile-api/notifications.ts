import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { Prisma, PrismaClient } from "@prisma/client";

import prisma from "@/lib/prisma";

export const MOBILE_NOTIFICATION_TYPES = {
    laneDrawOpened: "LANE_DRAW_OPENED",
    laneAssigned: "LANE_ASSIGNED",
    individualGroupReady: "INDIVIDUAL_GROUP_READY",
    teamCaptainSelected: "TEAM_CAPTAIN_SELECTED",
    teamDraftTurn: "TEAM_DRAFT_TURN",
    teamMemberSelected: "TEAM_MEMBER_SELECTED",
    eventVotingOpened: "EVENT_VOTING_OPENED",
} as const;

export type MobileNotificationType = typeof MOBILE_NOTIFICATION_TYPES[keyof typeof MOBILE_NOTIFICATION_TYPES];
export type MobileNotificationTarget =
    | "LANE_DRAW"
    | "EVENT_DETAIL"
    | "INDIVIDUAL_GROUP"
    | "TEAM_DRAFT"
    | "TEAM_DETAIL"
    | "EVENT_VOTING";

type DbClient = Prisma.TransactionClient | PrismaClient;
type NotificationInput = {
    userId: string;
    dedupeKey: string;
    type: MobileNotificationType;
    title: string;
    body: string;
    teamId: string;
    eventId?: string | null;
    target: MobileNotificationTarget;
};

export class MobileNotificationError extends Error {
    constructor(public code: string, message: string, public status: number) {
        super(message);
    }
}

export async function registerMobilePushDevice(userId: string, value: unknown) {
    const input = asRecord(value);
    const token = typeof input.token === "string" ? input.token.trim() : "";
    if (token.length < 20 || token.length > 4096 || input.platform !== "ANDROID") {
        throw new MobileNotificationError("INVALID_DEVICE", "기기 알림 정보를 확인해주세요.", 400);
    }
    for (let attempt = 0; attempt < 3; attempt += 1) {
        const existing = await prisma.mobilePushDevice.findUnique({
            where: { token },
            select: { id: true, userId: true, enabled: true, revokedAt: true },
        });
        const now = new Date();
        if (!existing) {
            try {
                return await prisma.mobilePushDevice.create({
                    data: { userId, token, platform: "ANDROID", lastSeenAt: now },
                    select: { id: true, platform: true, enabled: true, lastSeenAt: true },
                });
            } catch (error) {
                if (isUniqueConstraintError(error)) continue;
                throw error;
            }
        }
        if (existing.userId === userId) {
            const updated = await prisma.mobilePushDevice.updateMany({
                where: { id: existing.id, userId },
                data: { platform: "ANDROID", enabled: true, revokedAt: null, lastSeenAt: now },
            });
            if (updated.count === 1) return registeredDevice(existing.id, now);
            continue;
        }
        if (existing.enabled || existing.revokedAt === null) {
            throw deviceTokenConflict();
        }
        const reassigned = await prisma.$transaction(async (tx) => {
            const updated = await tx.mobilePushDevice.updateMany({
                where: {
                    id: existing.id,
                    userId: existing.userId,
                    enabled: false,
                    revokedAt: { not: null },
                },
                data: { userId, platform: "ANDROID", enabled: true, revokedAt: null, lastSeenAt: now },
            });
            if (updated.count !== 1) return false;
            await tx.mobileNotificationDelivery.updateMany({
                where: { deviceId: existing.id, status: { in: ["PENDING", "PROCESSING", "FAILED"] } },
                data: {
                    status: "FAILED",
                    lastErrorCode: "device/reassigned",
                    nextAttemptAt: new Date("9999-12-31T00:00:00.000Z"),
                },
            });
            return true;
        });
        if (reassigned) return registeredDevice(existing.id, now);
    }
    throw deviceTokenConflict();
}

export async function revokeMobilePushDevice(userId: string, value: unknown) {
    const token = typeof asRecord(value).token === "string" ? String(asRecord(value).token).trim() : "";
    if (!token) throw new MobileNotificationError("INVALID_DEVICE", "기기 알림 정보를 확인해주세요.", 400);
    const result = await prisma.mobilePushDevice.updateMany({
        where: { userId, token, enabled: true },
        data: { enabled: false, revokedAt: new Date() },
    });
    return { revoked: result.count > 0 };
}

export async function listMobileNotifications(userId: string, pageValue: string | null, limitValue: string | null) {
    const page = parsePositiveInt(pageValue, 1);
    const limit = Math.min(parsePositiveInt(limitValue, 20), 100);
    const where = { userId };
    const [total, rows] = await prisma.$transaction([
        prisma.mobileNotification.count({ where }),
        prisma.mobileNotification.findMany({
            where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * limit, take: limit,
            select: { id: true, type: true, title: true, body: true, teamId: true, eventId: true, data: true, createdAt: true, readAt: true },
        }),
    ]);
    return {
        items: rows.map((row) => ({ ...row, data: safeData(row.data) })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
}

export async function markMobileNotificationRead(userId: string, notificationId: string) {
    const result = await prisma.mobileNotification.updateMany({
        where: { id: notificationId, userId }, data: { readAt: new Date() },
    });
    if (result.count !== 1) throw new MobileNotificationError("NOTIFICATION_NOT_FOUND", "알림을 찾을 수 없습니다.", 404);
    return { read: true };
}

/** Adds the durable notification and device deliveries to the caller's transaction. */
export async function enqueueMobileNotifications(tx: DbClient, inputs: NotificationInput[]) {
    const database = tx as DbClient & {
        mobileNotification?: Prisma.TransactionClient["mobileNotification"];
        mobilePushDevice?: Prisma.TransactionClient["mobilePushDevice"];
        mobileNotificationDelivery?: Prisma.TransactionClient["mobileNotificationDelivery"];
    };
    // Older isolated service-test fakes intentionally do not implement the outbox delegates.
    if (!database.mobileNotification || !database.mobilePushDevice || !database.mobileNotificationDelivery) return;
    for (const input of inputs) {
        const notification = await database.mobileNotification.upsert({
            where: { dedupeKey: input.dedupeKey },
            create: {
                userId: input.userId, dedupeKey: input.dedupeKey, type: input.type,
                title: input.title, body: input.body, teamId: input.teamId,
                eventId: input.eventId ?? null,
                data: JSON.stringify({ type: input.type, teamId: input.teamId, eventId: input.eventId ?? null, target: input.target }),
            },
            update: {}, select: { id: true, userId: true },
        });
        if (notification.userId !== input.userId) continue;
        const devices = await database.mobilePushDevice.findMany({
            where: { userId: input.userId, enabled: true }, select: { id: true },
        });
        if (devices.length > 0) {
            for (const device of devices) {
                await database.mobileNotificationDelivery.upsert({
                    where: { notificationId_deviceId: { notificationId: notification.id, deviceId: device.id } },
                    create: { notificationId: notification.id, deviceId: device.id }, update: {},
                });
            }
        }
    }
}

type MessageSender = (message: { token: string; notification: { title: string; body: string }; data: Record<string, string> }) => Promise<unknown>;

export async function deliverPendingMobileNotifications(send?: MessageSender, now = new Date()) {
    const sender = send ?? configuredSender();
    if (!sender) return { configured: false, attempted: 0, sent: 0, failed: 0, disabled: 0 };
    const deliveries = await prisma.mobileNotificationDelivery.findMany({
        where: { status: { in: ["PENDING", "PROCESSING", "FAILED"] }, nextAttemptAt: { lte: now }, device: { enabled: true } },
        orderBy: { createdAt: "asc" }, take: 100,
        include: { notification: true, device: true },
    });
    let attempted = 0; let sent = 0; let failed = 0; let disabled = 0;
    for (const delivery of deliveries) {
        const claimed = await prisma.mobileNotificationDelivery.updateMany({
            where: { id: delivery.id, status: delivery.status, nextAttemptAt: { lte: now } },
            data: { status: "PROCESSING", nextAttemptAt: new Date(now.getTime() + 5 * 60_000) },
        });
        if (claimed.count !== 1) continue;
        attempted += 1;
        try {
            const data = safeData(delivery.notification.data);
            await sender({
                token: delivery.device.token,
                notification: { title: delivery.notification.title, body: delivery.notification.body },
                data: Object.fromEntries(Object.entries(data).map(([key, value]) => [key, value == null ? "" : String(value)])),
            });
            await prisma.mobileNotificationDelivery.update({ where: { id: delivery.id }, data: { status: "SENT", sentAt: now, lastErrorCode: null } });
            sent += 1;
        } catch (error) {
            const code = providerErrorCode(error);
            const invalid = code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token";
            await prisma.$transaction(async (tx) => {
                await tx.mobileNotificationDelivery.update({ where: { id: delivery.id }, data: {
                    status: "FAILED", retryCount: { increment: 1 }, lastErrorCode: code,
                    nextAttemptAt: invalid ? new Date("9999-12-31T00:00:00.000Z") : retryAt(now, delivery.retryCount + 1),
                } });
                if (invalid) await tx.mobilePushDevice.update({ where: { id: delivery.deviceId }, data: { enabled: false, revokedAt: now } });
            });
            failed += 1; if (invalid) disabled += 1;
        }
    }
    return { configured: true, attempted, sent, failed, disabled };
}

function configuredSender(): MessageSender | null {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!raw) return null;
    let serviceAccount: object;
    try { serviceAccount = JSON.parse(raw) as object; }
    catch { throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON."); }
    const app = getApps()[0] ?? initializeApp({ credential: cert(serviceAccount) });
    return (message) => getMessaging(app).send(message);
}

function registeredDevice(id: string, lastSeenAt: Date) {
    return { id, platform: "ANDROID", enabled: true, lastSeenAt };
}

function deviceTokenConflict() {
    return new MobileNotificationError("DEVICE_TOKEN_CONFLICT", "이 기기는 다른 계정에 등록되어 있습니다.", 409);
}

function isUniqueConstraintError(error: unknown) {
    return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

function retryAt(now: Date, retryCount: number) {
    return new Date(now.getTime() + Math.min(60, 2 ** Math.min(retryCount, 5)) * 60_000);
}

function providerErrorCode(error: unknown) {
    if (typeof error === "object" && error !== null && "code" in error && typeof error.code === "string") return error.code.slice(0, 120);
    return "messaging/unknown-error";
}

function safeData(value: string): Record<string, unknown> {
    try {
        const parsed: unknown = JSON.parse(value);
        return asRecord(parsed);
    } catch { return {}; }
}

function asRecord(value: unknown): Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function parsePositiveInt(value: string | null, fallback: number) {
    if (value === null) return fallback;
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}
