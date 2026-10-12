import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { TeamEventError } from "@/lib/mobile-api/team-events";

function fail(code: string, message: string, status = 409): never {
    throw new TeamEventError(code, message, status);
}
function record(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) fail("INVALID_REQUEST", "요청 내용을 확인해주세요.", 400);
    return value as Record<string, unknown>;
}
async function access(tx: Prisma.TransactionClient, userId: string, teamId: string) {
    const team = await tx.team.findFirst({
        where: { id: teamId, isActive: true, members: { some: { userId } } },
        select: { ownerId: true, User: { select: { id: true } }, members: { where: { userId }, select: { id: true } } },
    });
    if (!team?.members[0]) fail("TEAM_NOT_FOUND", "동호회를 찾을 수 없습니다.", 404);
    return { memberId: team.members[0].id, canManage: team.ownerId === userId || team.User.some(u => u.id === userId) };
}
function requireManager(canManage: boolean) {
    if (!canManage) fail("FORBIDDEN", "관리 권한이 없습니다.", 403);
}
export function parsePaymentAccount(value: unknown) {
    const body = record(value);
    if (body.kind !== "DUES" && body.kind !== "GAME_FEE") fail("INVALID_ACCOUNT", "계좌 종류를 확인해주세요.", 400);
    const text = (key: string, max: number) => {
        const value = body[key];
        if (typeof value !== "string" || !value.trim() || value.trim().length > max || /[\x00-\x1f\x7f]/.test(value)) {
            fail("INVALID_ACCOUNT", "은행명, 계좌번호, 예금주를 확인해주세요.", 400);
        }
        return value.trim();
    };
    const bankName = text("bankName", 40);
    const holderName = text("holderName", 60);
    const accountNumber = text("accountNumber", 40).replace(/[ -]/g, "");
    if (!/^\d{6,30}$/.test(accountNumber)) fail("INVALID_ACCOUNT", "계좌번호는 숫자 6~30자리로 입력해주세요.", 400);
    if (!Number.isSafeInteger(body.revision) || (body.revision as number) < 0) fail("INVALID_REVISION", "계좌 설정을 새로고침해주세요.", 400);
    return { kind: body.kind, bankName, holderName, accountNumber, revision: body.revision as number };
}

export async function getPaymentAccounts(userId: string, teamId: string) {
    return prisma.$transaction(async tx => {
        requireManager((await access(tx, userId, teamId)).canManage);
        return { accounts: await tx.teamPaymentAccount.findMany({ where: { teamId }, orderBy: { kind: "asc" } }) };
    });
}
export async function savePaymentAccount(userId: string, teamId: string, value: unknown) {
    const input = parsePaymentAccount(value);
    return prisma.$transaction(async tx => {
        requireManager((await access(tx, userId, teamId)).canManage);
        const current = await tx.teamPaymentAccount.findUnique({ where: { teamId_kind: { teamId, kind: input.kind } } });
        if ((current?.revision ?? 0) !== input.revision) fail("STALE_ACCOUNT", "다른 관리자가 계좌를 변경했습니다. 새로고침해주세요.");
        const { revision: _revision, ...data } = input;
        const account = current
            ? await tx.teamPaymentAccount.update({ where: { id: current.id }, data: { ...data, revision: { increment: 1 } } })
            : await tx.teamPaymentAccount.create({ data: { teamId, ...data } });
        return { account };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

// Financial state belongs to the attendance row, independent of the attendance answer.
// Changing attendance must never erase a reported or confirmed payment.
export async function updateGameFee(userId: string, teamId: string, eventId: string, value: unknown) {
    const body = record(value);
    if (typeof body.action !== "string" || !["REQUEST_TRANSFER", "REQUEST_CASH", "CANCEL_REQUEST", "CONFIRM_TRANSFER", "CONFIRM_CASH"].includes(body.action) ||
        !Number.isSafeInteger(body.revision) || (body.revision as number) < 0) {
        fail("INVALID_REQUEST", "결제 요청 내용을 확인해주세요.", 400);
    }
    const confirming = body.action === "CONFIRM_TRANSFER" || body.action === "CONFIRM_CASH";
    return prisma.$transaction(async tx => {
        const actor = await access(tx, userId, teamId);
        if (confirming) requireManager(actor.canManage);
        if (confirming && (typeof body.memberId !== "string" || !body.memberId)) fail("INVALID_REQUEST", "확인할 회원을 선택해주세요.", 400);
        if (!confirming && body.memberId !== undefined) fail("FORBIDDEN", "본인의 결제만 요청할 수 있습니다.", 403);
        const memberId = confirming ? body.memberId as string : actor.memberId;
        const event = await tx.teamEvent.findFirst({ where: { id: eventId, teamId } });
        if (!event) fail("EVENT_NOT_FOUND", "일정을 찾을 수 없습니다.", 404);
        const attendance = await tx.teamEventAttendance.findUnique({ where: { eventId_memberId: { eventId, memberId } } });
        if (!attendance) fail("ATTENDANCE_REQUIRED", "참석을 먼저 선택해주세요.");
        if (attendance.gameFeeRevision !== body.revision) fail("STALE_PAYMENT", "결제 상태가 변경되었습니다. 새로고침해주세요.");
        let nextStatus: string;
        let accountJson: string | null = attendance.gameFeeAccountJson;
        const cancelling = body.action === "CANCEL_REQUEST";
        if (confirming) {
            const expected = body.action === "CONFIRM_TRANSFER" ? "TRANSFER_REQUESTED" : "CASH_REQUESTED";
            if (attendance.gameFeeStatus !== expected) fail("INVALID_PAYMENT_STATE", "해당 결제 확인 요청이 없습니다.");
            nextStatus = body.action === "CONFIRM_TRANSFER" ? "TRANSFER_CONFIRMED" : "CASH_CONFIRMED";
        } else if (cancelling) {
            if (!["TRANSFER_REQUESTED", "CASH_REQUESTED"].includes(attendance.gameFeeStatus)) fail("INVALID_PAYMENT_STATE", "확인 대기 중인 요청만 취소할 수 있습니다.");
            nextStatus = "UNPAID";
            accountJson = null;
        } else {
            if (!event.attendanceEnabled || attendance.status !== "ATTENDING") fail("ATTENDANCE_REQUIRED", "참석한 회원만 결제를 요청할 수 있습니다.");
            if (attendance.gameFeeStatus !== "UNPAID") fail("INVALID_PAYMENT_STATE", "이미 결제 확인을 요청했거나 최종 확인되었습니다.");
            nextStatus = body.action === "REQUEST_TRANSFER" ? "TRANSFER_REQUESTED" : "CASH_REQUESTED";
            accountJson = null;
            if (body.action === "REQUEST_TRANSFER") {
                const account = await tx.teamPaymentAccount.findUnique({ where: { teamId_kind: { teamId, kind: "GAME_FEE" } } });
                if (!account) fail("ACCOUNT_NOT_CONFIGURED", "관리자가 게임비 입금 계좌를 설정해야 합니다.");
                if (body.accountId !== account.id || body.accountRevision !== account.revision) fail("STALE_ACCOUNT", "입금 계좌가 변경되었습니다. 새로고침 후 계좌를 확인해주세요. 이미 입금했다면 관리자에게 문의해주세요.");
                accountJson = JSON.stringify({ bankName: account.bankName, accountNumber: account.accountNumber, holderName: account.holderName });
            }
        }
        const now = new Date();
        const result = await tx.teamEventAttendance.updateMany({
            where: { id: attendance.id, gameFeeRevision: body.revision as number, gameFeeStatus: attendance.gameFeeStatus },
            data: {
                gameFeeStatus: nextStatus, gameFeeRevision: { increment: 1 }, gameFeeAccountJson: accountJson,
                gameFeeRequestedAt: cancelling ? null : confirming ? attendance.gameFeeRequestedAt : now,
                gameFeeConfirmedAt: confirming ? now : null, gameFeeConfirmedBy: confirming ? userId : null,
            },
        });
        if (result.count !== 1) fail("STALE_PAYMENT", "결제 상태가 변경되었습니다. 새로고침해주세요.");
        await tx.teamGameFeeAudit.create({ data: {
            teamId, attendanceId: attendance.id, eventSnapshotId: eventId, eventTitle: event.title,
            memberId, memberName: attendance.memberDisplayName, actorUserId: userId,
            action: body.action as string, previousStatus: attendance.gameFeeStatus, nextStatus,
            revision: attendance.gameFeeRevision + 1,
            accountJson: accountJson ?? attendance.gameFeeAccountJson,
        } });
        return { status: nextStatus, revision: attendance.gameFeeRevision + 1 };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
