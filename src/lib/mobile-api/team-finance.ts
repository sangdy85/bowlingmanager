import prisma from "@/lib/prisma";

export const MAX_CHARGE_AMOUNT = 10_000_000;
export const MAX_CHARGE_TITLE_LENGTH = 80;
export const MAX_CHARGE_MEMO_LENGTH = 500;

export type TeamChargeType = "MONTHLY_DUES" | "EVENT_FEE" | "OTHER";
export type TeamChargeStatus = "DRAFT" | "OPEN" | "CLOSED" | "CANCELLED";
export type TeamChargeTargetType = "MEMBER" | "GUEST";
export type TeamChargePaymentStatus = "UNPAID" | "PAID" | "WAIVED";
export type TeamChargePaymentAction = "MARK_PAID" | "MARK_UNPAID" | "WAIVE" | "UNWAIVE";
type TeamFinanceRole = "OWNER" | "MANAGER" | "MEMBER";

type FinanceAccess = {
    role: TeamFinanceRole;
    memberId: string;
};

type FinanceAuditRecord = {
    id: string;
    action: string;
    previousStatus: string | null;
    nextStatus: string;
    actorDisplayNameSnapshot: string;
    createdAt: Date;
};

type FinanceTargetRecord = {
    id: string;
    targetType: string;
    memberId: string | null;
    guestId: string | null;
    displayNameSnapshot: string;
    amount: number;
    paymentStatus: string;
    paidAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    audits: FinanceAuditRecord[];
};

type FinanceChargeRecord = {
    id: string;
    teamId: string;
    eventId: string | null;
    type: string;
    title: string;
    defaultAmount: number;
    dueDate: Date | null;
    status: string;
    memo: string | null;
    createdAt: Date;
    updatedAt: Date;
    targets: FinanceTargetRecord[];
};

export type CreateTeamChargeInput = {
    type: TeamChargeType;
    title: string;
    amount: number;
    dueDate: Date | null;
    memo: string | null;
    eventId: string | null;
    targetMemberIds: string[];
};

export type UpdateTeamChargeInput = {
    title?: string;
    amount?: number;
    dueDate?: Date | null;
    memo?: string | null;
    status?: TeamChargeStatus;
    targetMemberIds?: string[];
};

type CreatePersistenceInput = CreateTeamChargeInput & {
    actorUserId: string;
    teamId: string;
};

type UpdatePersistenceInput = UpdateTeamChargeInput & {
    actorUserId: string;
    teamId: string;
    chargeId: string;
};

type PaymentPersistenceInput = {
    actorUserId: string;
    teamId: string;
    chargeId: string;
    targetId: string;
    action: TeamChargePaymentAction;
    now: Date;
};

export type ChargeTargetSnapshot = {
    targetType: TeamChargeTargetType;
    memberId: string | null;
    guestId: string | null;
    displayNameSnapshot: string;
    amount: number;
};

export type TeamFinanceDependencies = {
    findAccess(actorUserId: string, teamId: string): Promise<FinanceAccess | null>;
    listCharges(teamId: string): Promise<FinanceChargeRecord[]>;
    findCharge(teamId: string, chargeId: string): Promise<FinanceChargeRecord | null>;
    createCharge(input: CreatePersistenceInput): Promise<FinanceChargeRecord>;
    updateCharge(input: UpdatePersistenceInput): Promise<FinanceChargeRecord>;
    updatePayment(input: PaymentPersistenceInput): Promise<FinanceChargeRecord>;
};

const chargeInclude = {
    targets: {
        orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }],
        include: {
            audits: { orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }] },
        },
    },
};

const defaultDependencies: TeamFinanceDependencies = {
    async findAccess(actorUserId, teamId) {
        const team = await prisma.team.findFirst({
            where: { id: teamId, isActive: true, members: { some: { userId: actorUserId } } },
            select: {
                ownerId: true,
                User: { select: { id: true } },
                members: { where: { userId: actorUserId }, take: 1, select: { id: true } },
            },
        });
        const member = team?.members[0];
        if (!team || !member) return null;
        return {
            memberId: member.id,
            role: team.ownerId === actorUserId
                ? "OWNER"
                : team.User.some((manager) => manager.id === actorUserId)
                    ? "MANAGER"
                    : "MEMBER",
        };
    },
    listCharges(teamId) {
        return prisma.teamCharge.findMany({
            where: { teamId },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            include: chargeInclude,
        });
    },
    findCharge(teamId, chargeId) {
        return prisma.teamCharge.findFirst({
            where: { id: chargeId, teamId },
            include: chargeInclude,
        });
    },
    createCharge(input) {
        return prisma.$transaction(async (tx) => {
            let targets: ChargeTargetSnapshot[] = [];

            if (input.type === "EVENT_FEE") {
                const event = await tx.teamEvent.findFirst({
                    where: { id: input.eventId ?? "", teamId: input.teamId },
                    select: {
                        id: true,
                        attendances: {
                            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
                            select: {
                                status: true,
                                memberId: true,
                                memberDisplayName: true,
                                member: {
                                    select: {
                                        teamId: true,
                                        alias: true,
                                        user: { select: { name: true } },
                                    },
                                },
                            },
                        },
                        guests: { orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: { id: true, name: true } },
                    },
                });
                if (!event) throw new TeamFinanceError("EVENT_NOT_FOUND", "일정을 찾을 수 없습니다.", 404);
                targets = buildEventFeeTargets(input.teamId, event.attendances, event.guests, input.amount);
            } else {
                const members = await tx.teamMember.findMany({
                    where: { teamId: input.teamId, id: { in: input.targetMemberIds } },
                    select: { id: true, alias: true, user: { select: { name: true } } },
                });
                targets = buildMemberChargeTargets(input.targetMemberIds, members, input.amount);
            }
            if (targets.length === 0) {
                throw new TeamFinanceError("INVALID_TARGET", "납부 대상을 한 명 이상 선택해주세요.", 400);
            }
            assertTargetIdentities(targets);
            const actor = await tx.user.findUnique({
                where: { id: input.actorUserId },
                select: { name: true },
            });
            if (!actor) throw new TeamFinanceError("FINANCE_FORBIDDEN", "관리 권한을 확인할 수 없습니다.", 403);
            return tx.teamCharge.create({
                data: {
                    teamId: input.teamId,
                    eventId: input.eventId,
                    type: input.type,
                    title: input.title,
                    defaultAmount: input.amount,
                    dueDate: input.dueDate,
                    status: "DRAFT",
                    memo: input.memo,
                    createdByUserId: input.actorUserId,
                    createdByDisplayNameSnapshot: actor.name,
                    targets: { create: targets },
                },
                include: chargeInclude,
            });
        }, { isolationLevel: "Serializable" });
    },
    updateCharge(input) {
        return prisma.$transaction(async (tx) => {
            const current = await tx.teamCharge.findFirst({
                where: { id: input.chargeId, teamId: input.teamId },
                include: chargeInclude,
            });
            if (!current) throw new TeamFinanceError("CHARGE_NOT_FOUND", "회비 항목을 찾을 수 없습니다.", 404);
            validateChargeUpdate(current, input);

            if (input.targetMemberIds) {
                const members = await tx.teamMember.findMany({
                    where: { teamId: input.teamId, id: { in: input.targetMemberIds } },
                    select: { id: true, alias: true, user: { select: { name: true } } },
                });
                if (members.length !== input.targetMemberIds.length) {
                    throw new TeamFinanceError("INVALID_TARGET", "다른 동호회 회원이 포함되어 있습니다.", 400);
                }
                const memberById = new Map(members.map((member) => [member.id, member]));
                await tx.teamChargeTarget.deleteMany({ where: { chargeId: current.id } });
                await tx.teamChargeTarget.createMany({
                    data: input.targetMemberIds.map((memberId) => {
                        const member = memberById.get(memberId)!;
                        return {
                            chargeId: current.id,
                            targetType: "MEMBER",
                            memberId,
                            displayNameSnapshot: displayName(member.alias, member.user.name),
                            amount: input.amount ?? current.defaultAmount,
                        };
                    }),
                });
            } else if (input.amount !== undefined) {
                await tx.teamChargeTarget.updateMany({
                    where: { chargeId: current.id },
                    data: { amount: input.amount },
                });
            }

            await tx.teamCharge.update({
                where: { id: current.id },
                data: {
                    ...(input.title !== undefined ? { title: input.title } : {}),
                    ...(input.amount !== undefined ? { defaultAmount: input.amount } : {}),
                    ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
                    ...(input.memo !== undefined ? { memo: input.memo } : {}),
                    ...(input.status !== undefined ? { status: input.status } : {}),
                },
            });
            return (await tx.teamCharge.findUnique({ where: { id: current.id }, include: chargeInclude }))!;
        }, { isolationLevel: "Serializable" });
    },
    updatePayment(input) {
        return prisma.$transaction(async (tx) => {
            const target = await tx.teamChargeTarget.findFirst({
                where: {
                    id: input.targetId,
                    chargeId: input.chargeId,
                    charge: { teamId: input.teamId },
                },
                include: { charge: { select: { id: true, status: true } } },
            });
            if (!target) throw new TeamFinanceError("TARGET_NOT_FOUND", "납부 대상을 찾을 수 없습니다.", 404);
            if (target.charge.status !== "OPEN") {
                throw new TeamFinanceError("CHARGE_NOT_OPEN", "진행 중인 회비만 납부 상태를 변경할 수 있습니다.", 409);
            }
            const previousStatus = asPaymentStatus(target.paymentStatus);
            const nextStatus = nextPaymentStatus(previousStatus, input.action);
            if (previousStatus !== nextStatus) {
                const actor = await tx.user.findUnique({ where: { id: input.actorUserId }, select: { name: true } });
                if (!actor) throw new TeamFinanceError("FINANCE_FORBIDDEN", "관리 권한을 확인할 수 없습니다.", 403);
                await tx.teamChargeTarget.update({
                    where: { id: target.id },
                    data: {
                        paymentStatus: nextStatus,
                        paidAt: nextStatus === "PAID" ? input.now : null,
                        markedByUserId: input.actorUserId,
                    },
                });
                await tx.teamChargeTargetAudit.create({
                    data: {
                        targetId: target.id,
                        action: input.action,
                        previousStatus,
                        nextStatus,
                        actorUserId: input.actorUserId,
                        actorDisplayNameSnapshot: actor.name,
                    },
                });
            }
            return (await tx.teamCharge.findUnique({ where: { id: target.charge.id }, include: chargeInclude }))!;
        }, { isolationLevel: "Serializable" });
    },
};

export class TeamFinanceError extends Error {
    constructor(
        public readonly code: string,
        message: string,
        public readonly status: number,
    ) {
        super(message);
        this.name = "TeamFinanceError";
    }
}

export function parseCreateTeamChargeInput(value: unknown): CreateTeamChargeInput {
    const record = asRecord(value);
    assertOnlyKeys(record, ["type", "title", "amount", "dueDate", "memo", "eventId", "targetMemberIds"]);
    const type = parseChargeType(record.type);
    const title = parseTitle(record.title);
    const amount = parseAmount(record.amount);
    const dueDate = parseOptionalDate(record.dueDate);
    const memo = parseMemo(record.memo);
    const eventId = optionalId(record.eventId, "INVALID_EVENT");
    const targetMemberIds = parseTargetMemberIds(record.targetMemberIds);

    if (type === "EVENT_FEE") {
        if (!eventId) throw new TeamFinanceError("EVENT_NOT_FOUND", "이벤트 게임비에는 일정이 필요합니다.", 400);
        if (targetMemberIds.length > 0) {
            throw new TeamFinanceError("INVALID_TARGET", "이벤트 게임비 대상은 서버가 참석자에서 결정합니다.", 400);
        }
    } else {
        if (eventId) throw new TeamFinanceError("INVALID_EVENT", "이 유형에는 일정을 연결할 수 없습니다.", 400);
        if (targetMemberIds.length === 0) {
            throw new TeamFinanceError("INVALID_TARGET", "납부 대상을 한 명 이상 선택해주세요.", 400);
        }
    }
    return { type, title, amount, dueDate, memo, eventId, targetMemberIds };
}

export function parseUpdateTeamChargeInput(value: unknown): UpdateTeamChargeInput {
    const record = asRecord(value);
    assertOnlyKeys(record, ["title", "amount", "dueDate", "memo", "status", "targetMemberIds"]);
    if (Object.keys(record).length === 0) {
        throw new TeamFinanceError("INVALID_CHARGE_UPDATE", "수정할 내용을 입력해주세요.", 400);
    }
    const result: UpdateTeamChargeInput = {};
    if (Object.hasOwn(record, "title")) result.title = parseTitle(record.title);
    if (Object.hasOwn(record, "amount")) result.amount = parseAmount(record.amount);
    if (Object.hasOwn(record, "dueDate")) result.dueDate = parseOptionalDate(record.dueDate);
    if (Object.hasOwn(record, "memo")) result.memo = parseMemo(record.memo);
    if (Object.hasOwn(record, "status")) result.status = parseChargeStatus(record.status);
    if (Object.hasOwn(record, "targetMemberIds")) {
        result.targetMemberIds = parseTargetMemberIds(record.targetMemberIds, true);
    }
    return result;
}

export function parsePaymentAction(value: unknown): TeamChargePaymentAction {
    const record = asRecord(value);
    assertOnlyKeys(record, ["action"]);
    if (record.action === "MARK_PAID" || record.action === "MARK_UNPAID"
        || record.action === "WAIVE" || record.action === "UNWAIVE") return record.action;
    throw new TeamFinanceError("INVALID_PAYMENT_TRANSITION", "납부 상태 변경 요청을 확인해주세요.", 400);
}

export async function listTeamCharges(
    actorUserId: string,
    teamId: string,
    dependencies: TeamFinanceDependencies = defaultDependencies,
) {
    const access = await requireAccess(actorUserId, teamId, dependencies);
    const charges = await dependencies.listCharges(teamId);
    const visibleCharges = access.role === "MEMBER"
        ? charges.filter((charge) => charge.status === "OPEN" || charge.status === "CLOSED")
        : charges;
    return {
        role: access.role,
        charges: visibleCharges.map((charge) => serializeChargeForAccess(charge, access)),
    };
}

export async function getTeamCharge(
    actorUserId: string,
    teamId: string,
    chargeId: string,
    dependencies: TeamFinanceDependencies = defaultDependencies,
) {
    const access = await requireAccess(actorUserId, teamId, dependencies);
    const charge = await dependencies.findCharge(teamId, chargeId);
    if (!charge) throw new TeamFinanceError("CHARGE_NOT_FOUND", "회비 항목을 찾을 수 없습니다.", 404);
    if (access.role === "MEMBER" && charge.status !== "OPEN" && charge.status !== "CLOSED") {
        throw new TeamFinanceError("CHARGE_NOT_FOUND", "회비 항목을 찾을 수 없습니다.", 404);
    }
    return { role: access.role, ...serializeChargeForAccess(charge, access) };
}

export async function getTeamFinanceSummary(
    actorUserId: string,
    teamId: string,
    dependencies: TeamFinanceDependencies = defaultDependencies,
) {
    const access = await requireManager(actorUserId, teamId, dependencies);
    const charges = await dependencies.listCharges(teamId);
    const active = charges.filter((charge) => charge.status !== "CANCELLED");
    return {
        role: access.role,
        charges: {
            total: charges.length,
            draft: charges.filter((item) => item.status === "DRAFT").length,
            open: charges.filter((item) => item.status === "OPEN").length,
            closed: charges.filter((item) => item.status === "CLOSED").length,
            cancelled: charges.filter((item) => item.status === "CANCELLED").length,
        },
        totals: aggregateTargets(active.flatMap((charge) => charge.targets)),
    };
}

export async function createTeamCharge(
    actorUserId: string,
    teamId: string,
    value: unknown,
    dependencies: TeamFinanceDependencies = defaultDependencies,
) {
    const access = await requireManager(actorUserId, teamId, dependencies);
    const input = parseCreateTeamChargeInput(value);
    const charge = await dependencies.createCharge({ actorUserId, teamId, ...input });
    return { role: access.role, ...serializeManagerCharge(charge) };
}

export async function updateTeamCharge(
    actorUserId: string,
    teamId: string,
    chargeId: string,
    value: unknown,
    dependencies: TeamFinanceDependencies = defaultDependencies,
) {
    const access = await requireManager(actorUserId, teamId, dependencies);
    const input = parseUpdateTeamChargeInput(value);
    const current = await dependencies.findCharge(teamId, chargeId);
    if (!current) throw new TeamFinanceError("CHARGE_NOT_FOUND", "회비 항목을 찾을 수 없습니다.", 404);
    validateChargeUpdate(current, input);
    const charge = await dependencies.updateCharge({ actorUserId, teamId, chargeId, ...input });
    return { role: access.role, ...serializeManagerCharge(charge) };
}

export async function updateTeamChargePayment(
    actorUserId: string,
    teamId: string,
    chargeId: string,
    targetId: string,
    value: unknown,
    dependencies: TeamFinanceDependencies = defaultDependencies,
    now = new Date(),
) {
    const access = await requireManager(actorUserId, teamId, dependencies);
    const action = parsePaymentAction(value);
    const charge = await dependencies.findCharge(teamId, chargeId);
    if (!charge) throw new TeamFinanceError("CHARGE_NOT_FOUND", "회비 항목을 찾을 수 없습니다.", 404);
    const target = charge.targets.find((item) => item.id === targetId);
    if (!target) throw new TeamFinanceError("TARGET_NOT_FOUND", "납부 대상을 찾을 수 없습니다.", 404);
    if (charge.status !== "OPEN") {
        throw new TeamFinanceError("CHARGE_NOT_OPEN", "진행 중인 회비만 납부 상태를 변경할 수 있습니다.", 409);
    }
    nextPaymentStatus(asPaymentStatus(target.paymentStatus), action);
    const updated = await dependencies.updatePayment({ actorUserId, teamId, chargeId, targetId, action, now });
    return { role: access.role, ...serializeManagerCharge(updated) };
}

function validateChargeUpdate(charge: FinanceChargeRecord, input: UpdateTeamChargeInput) {
    const changesAmountOrTargets = input.amount !== undefined || input.targetMemberIds !== undefined;
    if (changesAmountOrTargets && charge.targets.some((target) => target.paymentStatus !== "UNPAID")) {
        throw new TeamFinanceError("CHARGE_LOCKED", "납부 또는 면제 기록이 있어 금액과 대상을 변경할 수 없습니다.", 409);
    }
    if (input.targetMemberIds && charge.type === "EVENT_FEE") {
        throw new TeamFinanceError("INVALID_TARGET", "이벤트 게임비 대상 snapshot은 직접 변경할 수 없습니다.", 400);
    }
    if (charge.status === "DRAFT") {
        if (input.status !== undefined) assertChargeStatusTransition("DRAFT", input.status);
        return;
    }
    if (charge.status === "OPEN") {
        if (changesAmountOrTargets) {
            throw new TeamFinanceError("CHARGE_LOCKED", "공개된 회비의 금액과 대상은 변경할 수 없습니다.", 409);
        }
        if (input.status !== undefined) assertChargeStatusTransition("OPEN", input.status);
        return;
    }
    const onlySameStatus = Object.keys(input).length === 1 && input.status === charge.status;
    if (!onlySameStatus) {
        throw new TeamFinanceError("CHARGE_CLOSED", "종료되거나 취소된 회비는 변경할 수 없습니다.", 409);
    }
}

export function assertChargeStatusTransition(current: string, next: TeamChargeStatus) {
    if (current === next) return;
    const allowed = current === "DRAFT"
        ? new Set<TeamChargeStatus>(["OPEN", "CANCELLED"])
        : current === "OPEN"
            ? new Set<TeamChargeStatus>(["CLOSED", "CANCELLED"])
            : new Set<TeamChargeStatus>();
    if (!allowed.has(next)) {
        throw new TeamFinanceError("INVALID_CHARGE_TRANSITION", "회비 상태를 변경할 수 없습니다.", 409);
    }
}

export function nextPaymentStatus(
    current: TeamChargePaymentStatus,
    action: TeamChargePaymentAction,
): TeamChargePaymentStatus {
    if (action === "MARK_PAID") {
        if (current === "PAID") return current;
        if (current === "UNPAID") return "PAID";
    } else if (action === "MARK_UNPAID") {
        if (current === "UNPAID") return current;
        if (current === "PAID") return "UNPAID";
    } else if (action === "WAIVE") {
        if (current === "WAIVED") return current;
        if (current === "UNPAID") return "WAIVED";
    } else if (action === "UNWAIVE") {
        if (current === "UNPAID") return current;
        if (current === "WAIVED") return "UNPAID";
    }
    throw new TeamFinanceError("INVALID_PAYMENT_TRANSITION", "현재 납부 상태에서는 요청한 변경을 할 수 없습니다.", 409);
}

export function aggregateTargets(targets: Array<Pick<FinanceTargetRecord, "amount" | "paymentStatus">>) {
    const result = {
        targetCount: targets.length,
        paidCount: 0,
        unpaidCount: 0,
        waivedCount: 0,
        expectedAmount: 0,
        paidAmount: 0,
        unpaidAmount: 0,
        waivedAmount: 0,
    };
    for (const target of targets) {
        const status = asPaymentStatus(target.paymentStatus);
        if (status === "PAID") {
            result.paidCount += 1;
            result.paidAmount += target.amount;
            result.expectedAmount += target.amount;
        } else if (status === "UNPAID") {
            result.unpaidCount += 1;
            result.unpaidAmount += target.amount;
            result.expectedAmount += target.amount;
        } else {
            result.waivedCount += 1;
            result.waivedAmount += target.amount;
        }
    }
    return result;
}

function serializeChargeForAccess(charge: FinanceChargeRecord, access: FinanceAccess) {
    if (access.role === "OWNER" || access.role === "MANAGER") return serializeManagerCharge(charge);
    const myTarget = charge.targets.find((target) => target.memberId === access.memberId);
    return {
        charge: serializeChargeBase(charge),
        myPayment: myTarget ? {
            amount: myTarget.amount,
            status: myTarget.paymentStatus,
            paidAt: myTarget.paidAt?.toISOString() ?? null,
        } : null,
    };
}

function serializeManagerCharge(charge: FinanceChargeRecord) {
    return {
        charge: serializeChargeBase(charge),
        summary: aggregateTargets(charge.targets),
        targets: charge.targets.map((target) => ({
            id: target.id,
            targetType: target.targetType,
            memberId: target.memberId,
            displayName: target.displayNameSnapshot,
            amount: target.amount,
            status: target.paymentStatus,
            paidAt: target.paidAt?.toISOString() ?? null,
            createdAt: target.createdAt.toISOString(),
            updatedAt: target.updatedAt.toISOString(),
            audits: target.audits.map((audit) => ({
                id: audit.id,
                action: audit.action,
                previousStatus: audit.previousStatus,
                nextStatus: audit.nextStatus,
                actorDisplayName: audit.actorDisplayNameSnapshot,
                createdAt: audit.createdAt.toISOString(),
            })),
        })),
    };
}

function serializeChargeBase(charge: FinanceChargeRecord) {
    return {
        id: charge.id,
        eventId: charge.eventId,
        type: charge.type,
        title: charge.title,
        amount: charge.defaultAmount,
        dueDate: formatDateOnly(charge.dueDate),
        status: charge.status,
        memo: charge.memo,
        createdAt: charge.createdAt.toISOString(),
        updatedAt: charge.updatedAt.toISOString(),
    };
}

async function requireAccess(actorUserId: string, teamId: string, dependencies: TeamFinanceDependencies) {
    const access = await dependencies.findAccess(actorUserId, teamId);
    if (!access) throw new TeamFinanceError("TEAM_NOT_FOUND", "동호회를 찾을 수 없습니다.", 404);
    return access;
}

async function requireManager(actorUserId: string, teamId: string, dependencies: TeamFinanceDependencies) {
    const access = await requireAccess(actorUserId, teamId, dependencies);
    if (access.role === "MEMBER") {
        throw new TeamFinanceError("FINANCE_FORBIDDEN", "회비 관리 권한이 없습니다.", 403);
    }
    return access;
}

function parseChargeType(value: unknown): TeamChargeType {
    if (value === "MONTHLY_DUES" || value === "EVENT_FEE" || value === "OTHER") return value;
    throw new TeamFinanceError("INVALID_CHARGE_TYPE", "회비 유형을 확인해주세요.", 400);
}

function parseChargeStatus(value: unknown): TeamChargeStatus {
    if (value === "DRAFT" || value === "OPEN" || value === "CLOSED" || value === "CANCELLED") return value;
    throw new TeamFinanceError("INVALID_CHARGE_STATUS", "회비 상태를 확인해주세요.", 400);
}

function parseTitle(value: unknown) {
    if (typeof value !== "string") throw new TeamFinanceError("INVALID_TITLE", "제목을 입력해주세요.", 400);
    const title = value.trim();
    if (title.length < 1 || title.length > MAX_CHARGE_TITLE_LENGTH) {
        throw new TeamFinanceError("INVALID_TITLE", `제목은 1~${MAX_CHARGE_TITLE_LENGTH}자로 입력해주세요.`, 400);
    }
    return title;
}

function parseAmount(value: unknown) {
    if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > MAX_CHARGE_AMOUNT) {
        throw new TeamFinanceError("INVALID_AMOUNT", `금액은 1~${MAX_CHARGE_AMOUNT}원 정수로 입력해주세요.`, 400);
    }
    return value as number;
}

function parseMemo(value: unknown) {
    if (value === undefined || value === null) return null;
    if (typeof value !== "string" || value.length > MAX_CHARGE_MEMO_LENGTH) {
        throw new TeamFinanceError("INVALID_MEMO", `메모는 ${MAX_CHARGE_MEMO_LENGTH}자 이하로 입력해주세요.`, 400);
    }
    const memo = value.trim();
    return memo.length === 0 ? null : memo;
}

function parseOptionalDate(value: unknown): Date | null {
    if (value === undefined || value === null || value === "") return null;
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new TeamFinanceError("INVALID_DUE_DATE", "납부 기한은 YYYY-MM-DD 형식이어야 합니다.", 400);
    }
    const [year, month, day] = value.split("-").map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
        throw new TeamFinanceError("INVALID_DUE_DATE", "유효한 납부 기한을 입력해주세요.", 400);
    }
    return parsed;
}

function parseTargetMemberIds(value: unknown, required = false) {
    if (value === undefined && !required) return [];
    if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== "string" || item.trim() === "")) {
        throw new TeamFinanceError("INVALID_TARGET", "납부 대상 회원을 확인해주세요.", 400);
    }
    const ids = value.map((item) => (item as string).trim());
    if (new Set(ids).size !== ids.length) {
        throw new TeamFinanceError("DUPLICATE_TARGET", "중복된 납부 대상이 있습니다.", 400);
    }
    return ids;
}

function optionalId(value: unknown, code: string) {
    if (value === undefined || value === null || value === "") return null;
    if (typeof value !== "string" || value.trim() === "") {
        throw new TeamFinanceError(code, "식별자를 확인해주세요.", 400);
    }
    return value.trim();
}

function asRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new TeamFinanceError("INVALID_JSON", "요청 내용을 확인해주세요.", 400);
    }
    return value as Record<string, unknown>;
}

function assertOnlyKeys(record: Record<string, unknown>, allowed: string[]) {
    const unknown = Object.keys(record).find((key) => !allowed.includes(key));
    if (unknown) throw new TeamFinanceError("INVALID_FIELD", `허용되지 않은 필드입니다: ${unknown}`, 400);
}

function assertTargetIdentities(targets: Array<{ targetType: TeamChargeTargetType; memberId: string | null; guestId: string | null }>) {
    for (const target of targets) {
        const valid = target.targetType === "MEMBER"
            ? target.memberId !== null && target.guestId === null
            : target.guestId !== null && target.memberId === null;
        if (!valid) throw new TeamFinanceError("INVALID_TARGET", "납부 대상 유형과 식별자가 일치하지 않습니다.", 400);
    }
}

export function buildMemberChargeTargets(
    requestedMemberIds: string[],
    members: Array<{ id: string; alias: string | null; user: { name: string } }>,
    amount: number,
): ChargeTargetSnapshot[] {
    if (members.length !== requestedMemberIds.length) {
        throw new TeamFinanceError("INVALID_TARGET", "다른 동호회 회원이 포함되어 있습니다.", 400);
    }
    const memberById = new Map(members.map((member) => [member.id, member]));
    return requestedMemberIds.map((memberId) => {
        const member = memberById.get(memberId);
        if (!member) throw new TeamFinanceError("INVALID_TARGET", "다른 동호회 회원이 포함되어 있습니다.", 400);
        return {
            targetType: "MEMBER",
            memberId,
            guestId: null,
            displayNameSnapshot: displayName(member.alias, member.user.name),
            amount,
        };
    });
}

export function buildEventFeeTargets(
    teamId: string,
    attendances: Array<{
        status: string;
        memberId: string | null;
        memberDisplayName: string;
        member: { teamId: string; alias: string | null; user: { name: string } } | null;
    }>,
    guests: Array<{ id: string; name: string }>,
    amount: number,
): ChargeTargetSnapshot[] {
    const memberTargets = attendances
        .filter((attendance) => attendance.status === "ATTENDING"
            && attendance.memberId !== null
            && attendance.member?.teamId === teamId)
        .map((attendance) => ({
            targetType: "MEMBER" as const,
            memberId: attendance.memberId!,
            guestId: null,
            displayNameSnapshot: displayName(
                attendance.member!.alias,
                attendance.member!.user.name,
                attendance.memberDisplayName,
            ),
            amount,
        }));
    const guestTargets = guests.map((guest) => ({
        targetType: "GUEST" as const,
        memberId: null,
        guestId: guest.id,
        displayNameSnapshot: displayName(null, guest.name),
        amount,
    }));
    const targets = [...memberTargets, ...guestTargets];
    assertTargetIdentities(targets);
    return targets;
}

function displayName(alias: string | null, userName: string, fallback?: string) {
    const value = alias?.trim() || userName.trim() || fallback?.trim();
    if (!value) throw new TeamFinanceError("INVALID_TARGET", "납부 대상 이름을 확인할 수 없습니다.", 400);
    return value;
}

function asPaymentStatus(value: string): TeamChargePaymentStatus {
    if (value === "UNPAID" || value === "PAID" || value === "WAIVED") return value;
    throw new TeamFinanceError("INVALID_PAYMENT_TRANSITION", "저장된 납부 상태를 확인할 수 없습니다.", 500);
}

function formatDateOnly(value: Date | null) {
    return value?.toISOString().slice(0, 10) ?? null;
}
