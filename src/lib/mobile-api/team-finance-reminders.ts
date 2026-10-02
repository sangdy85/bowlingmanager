import prisma from "@/lib/prisma";
import {
    enqueueMobileNotifications,
    MOBILE_NOTIFICATION_TYPES,
    type NotificationInput,
} from "@/lib/mobile-api/notifications";
import { TeamFinanceError } from "@/lib/mobile-api/team-finance";

type FinanceManagerRole = "OWNER" | "MANAGER" | "MEMBER";

type ReminderTarget = {
    targetType: string;
    paymentStatus: string;
    amount: number;
    member: { userId: string } | null;
};

type ReminderCharge = {
    id: string;
    title: string;
    dueDate: Date | null;
    status: string;
    targets: ReminderTarget[];
};

export type FinanceReminderDependencies = {
    findManagerRole(actorUserId: string, teamId: string): Promise<FinanceManagerRole | null>;
    findCharge(teamId: string, chargeId: string): Promise<ReminderCharge | null>;
    enqueueNotifications(inputs: NotificationInput[]): Promise<void>;
};

const defaultDependencies: FinanceReminderDependencies = {
    async findManagerRole(actorUserId, teamId) {
        const team = await prisma.team.findFirst({
            where: { id: teamId, isActive: true, members: { some: { userId: actorUserId } } },
            select: {
                ownerId: true,
                User: { where: { id: actorUserId }, take: 1, select: { id: true } },
            },
        });
        if (!team) return null;
        if (team.ownerId === actorUserId) return "OWNER";
        return team.User.length > 0 ? "MANAGER" : "MEMBER";
    },
    findCharge(teamId, chargeId) {
        return prisma.teamCharge.findFirst({
            where: { id: chargeId, teamId },
            select: {
                id: true,
                title: true,
                dueDate: true,
                status: true,
                targets: {
                    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
                    select: {
                        targetType: true,
                        paymentStatus: true,
                        amount: true,
                        member: { select: { userId: true } },
                    },
                },
            },
        });
    },
    async enqueueNotifications(inputs) {
        if (inputs.length === 0) return;
        await prisma.$transaction(async (tx) => enqueueMobileNotifications(tx, inputs));
    },
};

export type FinanceReminderResult = {
    eligibleMemberCount: number;
    unpaidGuestCount: number;
    skippedUnavailableMemberCount: number;
    processed: true;
};

export async function remindUnpaidTeamChargeMembers(
    actorUserId: string,
    teamId: string,
    chargeId: string,
    dependencies: FinanceReminderDependencies = defaultDependencies,
    now = new Date(),
): Promise<FinanceReminderResult> {
    const role = await dependencies.findManagerRole(actorUserId, teamId);
    if (role === null) {
        throw new TeamFinanceError("TEAM_NOT_FOUND", "동호회를 찾을 수 없습니다.", 404);
    }
    if (role === "MEMBER") {
        throw new TeamFinanceError("FINANCE_FORBIDDEN", "회비 관리 권한이 없습니다.", 403);
    }

    const charge = await dependencies.findCharge(teamId, chargeId);
    if (!charge) {
        throw new TeamFinanceError("CHARGE_NOT_FOUND", "회비 항목을 찾을 수 없습니다.", 404);
    }
    if (charge.status !== "OPEN") {
        throw new TeamFinanceError("CHARGE_NOT_OPEN", "공개 중인 회비만 알림을 등록할 수 있습니다.", 409);
    }

    const plan = buildFinanceDueReminderPlan(teamId, charge, now);
    await dependencies.enqueueNotifications(plan.inputs);
    return {
        eligibleMemberCount: plan.inputs.length,
        unpaidGuestCount: plan.unpaidGuestCount,
        skippedUnavailableMemberCount: plan.skippedUnavailableMemberCount,
        processed: true,
    };
}

export function buildFinanceDueReminderPlan(
    teamId: string,
    charge: ReminderCharge,
    now = new Date(),
) {
    const dateKey = koreaDateKey(now);
    const recipients = new Map<string, NotificationInput>();
    let unpaidGuestCount = 0;
    let skippedUnavailableMemberCount = 0;

    for (const target of charge.targets) {
        if (target.paymentStatus !== "UNPAID") continue;
        if (target.targetType === "GUEST") {
            unpaidGuestCount += 1;
            continue;
        }
        if (target.targetType !== "MEMBER" || !target.member?.userId) {
            skippedUnavailableMemberCount += 1;
            continue;
        }
        const userId = target.member.userId;
        recipients.set(userId, {
            userId,
            dedupeKey: `finance-due-reminder:${charge.id}:${userId}:${dateKey}`,
            type: MOBILE_NOTIFICATION_TYPES.financeDueReminder,
            title: charge.title,
            body: financeDueReminderBody(target.amount, charge.dueDate),
            teamId,
            eventId: null,
            chargeId: charge.id,
            target: "FINANCE_CHARGE",
        });
    }

    return {
        inputs: [...recipients.values()],
        unpaidGuestCount,
        skippedUnavailableMemberCount,
    };
}

export function koreaDateKey(now: Date) {
    return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function financeDueReminderBody(amount: number, dueDate: Date | null) {
    const formattedAmount = `${amount.toLocaleString("en-US")}원`;
    if (!dueDate) return `${formattedAmount} 납부 확인이 필요합니다.`;
    return `${formattedAmount} · ${dueDate.getUTCMonth() + 1}월 ${dueDate.getUTCDate()}일까지`;
}
