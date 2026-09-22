import { createHash } from "node:crypto";
import { v4 as uuidv4 } from "uuid";
import prisma from "@/lib/prisma";
import {
    createTeamActivityId,
    filterTeamRecordScores,
    parseTeamActivityId,
    TEAM_GAME_TYPES,
    type TeamRecordFilter,
    type TeamRecordScore,
} from "@/lib/team-records";

type TeamAccess = {
    id: string;
    ownerId: string | null;
    User: { id: string }[];
    members: {
        id: string;
        userId: string;
        alias: string | null;
        user: { name: string };
    }[];
};

type EditableScore = {
    id: string;
    score: number;
    gameDate: Date;
    gameType: string | null;
    userId: string | null;
    guestName: string | null;
    memo: string | null;
    createdAt: Date;
    User: { name: string | null } | null;
};

export type TeamManagementDependencies = {
    findAccessibleTeam(actorUserId: string, teamId: string): Promise<TeamAccess | null>;
    listScores(teamId: string, start: Date, end: Date): Promise<EditableScore[]>;
    replaceScores(input: {
        teamId: string;
        expectedIds: string[];
        expectedRevision: string;
        filter: TeamRecordFilter;
        activityDate: string;
        date: string;
        gameType: string;
        memo: string | null;
        participants: TeamActivityMutation["participants"];
        members: TeamAccess["members"];
    }): Promise<{ createdCount: number }>;
    deleteScores(input: {
        teamId: string;
        expectedIds: string[];
        expectedRevision: string;
        filter: TeamRecordFilter;
        activityDate: string;
    }): Promise<{ deletedCount: number }>;
    removeMember(input: {
        teamId: string;
        memberId: string;
        userId: string;
        displayName: string;
    }): Promise<void>;
    setManager(teamId: string, userId: string, enabled: boolean): Promise<void>;
};

const defaultDependencies: TeamManagementDependencies = {
    findAccessibleTeam(actorUserId, teamId) {
        return prisma.team.findFirst({
            where: {
                id: teamId,
                isActive: true,
                members: { some: { userId: actorUserId } },
            },
            select: {
                id: true,
                ownerId: true,
                User: { select: { id: true } },
                members: {
                    select: {
                        id: true,
                        userId: true,
                        alias: true,
                        user: { select: { name: true } },
                    },
                },
            },
        });
    },
    listScores(teamId, start, end) {
        return prisma.score.findMany({
            where: { teamId, gameDate: { gte: start, lte: end } },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            select: {
                id: true,
                score: true,
                gameDate: true,
                gameType: true,
                userId: true,
                guestName: true,
                memo: true,
                createdAt: true,
                User: { select: { name: true } },
            },
        });
    },
    async replaceScores(input) {
        return prisma.$transaction(async (tx) => {
            const range = kstDayRange(input.activityDate);
            const allCurrent = await tx.score.findMany({
                where: { teamId: input.teamId, gameDate: { gte: range.start, lte: range.end } },
                orderBy: [{ createdAt: "asc" }, { id: "asc" }],
                select: {
                    id: true, score: true, gameDate: true, gameType: true,
                    userId: true, guestName: true, memo: true, createdAt: true,
                },
            });
            const current = filterEditableRows(allCurrent, input.filter);
            const currentRevision = createActivityRevision(current);
            if (current.length !== input.expectedIds.length || currentRevision !== input.expectedRevision) {
                throw new TeamManagementError(
                    "ACTIVITY_CONFLICT",
                    "다른 관리자가 기록을 변경했습니다. 새로고침 후 다시 시도해주세요.",
                    409,
                );
            }

            const requestedMemberIds = [...new Set(input.participants
                .map((participant) => participant.memberId)
                .filter((memberId): memberId is string => memberId !== null))];
            const currentMembers = requestedMemberIds.length === 0
                ? []
                : await tx.teamMember.findMany({
                    where: { id: { in: requestedMemberIds }, teamId: input.teamId },
                    select: { id: true, userId: true },
                });
            if (currentMembers.length !== requestedMemberIds.length) {
                throw new TeamManagementError("INVALID_MEMBER", "선택한 팀원을 확인할 수 없습니다.", 400);
            }

            await tx.score.deleteMany({ where: { id: { in: input.expectedIds }, teamId: input.teamId } });
            const memberById = new Map(currentMembers.map((member) => [member.id, member]));
            const gameDate = parseCalendarDate(input.date);
            let createdCount = 0;
            for (const participant of input.participants) {
                const member = participant.memberId ? memberById.get(participant.memberId) : null;
                if (participant.memberId && !member) {
                    throw new TeamManagementError("INVALID_MEMBER", "선택한 팀원을 확인할 수 없습니다.", 400);
                }
                for (const score of participant.scores) {
                    await tx.score.create({
                        data: {
                            id: uuidv4(),
                            score,
                            gameDate,
                            gameType: input.gameType,
                            memo: input.memo,
                            teamId: input.teamId,
                            userId: member?.userId ?? null,
                            guestName: member ? null : participant.name,
                        },
                    });
                    createdCount += 1;
                }
            }
            return { createdCount };
        });
    },
    async deleteScores(input) {
        return prisma.$transaction(async (tx) => {
            const range = kstDayRange(input.activityDate);
            const allCurrent = await tx.score.findMany({
                where: { teamId: input.teamId, gameDate: { gte: range.start, lte: range.end } },
                orderBy: [{ createdAt: "asc" }, { id: "asc" }],
                select: {
                    id: true, score: true, gameDate: true, gameType: true,
                    userId: true, guestName: true, memo: true, createdAt: true,
                },
            });
            const current = filterEditableRows(allCurrent, input.filter);
            if (current.length !== input.expectedIds.length
                || createActivityRevision(current) !== input.expectedRevision) {
                throw new TeamManagementError(
                    "ACTIVITY_CONFLICT",
                    "다른 관리자가 기록을 변경했습니다. 새로고침 후 다시 시도해주세요.",
                    409,
                );
            }
            const deleted = await tx.score.deleteMany({
                where: { id: { in: input.expectedIds }, teamId: input.teamId },
            });
            return { deletedCount: deleted.count };
        });
    },
    async removeMember(input) {
        await prisma.$transaction(async (tx) => {
            await tx.score.updateMany({
                where: { teamId: input.teamId, userId: input.userId },
                data: { userId: null, guestName: input.displayName },
            });
            await tx.team.update({
                where: { id: input.teamId },
                data: { User: { disconnect: { id: input.userId } } },
            });
            await tx.teamMember.delete({
                where: { id: input.memberId, teamId: input.teamId },
            });
        });
    },
    async setManager(teamId, userId, enabled) {
        await prisma.team.update({
            where: { id: teamId },
            data: { User: enabled ? { connect: { id: userId } } : { disconnect: { id: userId } } },
        });
    },
};

export class TeamManagementError extends Error {
    constructor(
        public readonly code: string,
        message: string,
        public readonly status: number,
    ) {
        super(message);
        this.name = "TeamManagementError";
    }
}

export type TeamActivityMutation = {
    revision: string;
    date: string;
    gameType: string;
    memo: string | null;
    participants: {
        memberId: string | null;
        name: string;
        scores: number[];
    }[];
};

export function parseTeamActivityMutation(value: unknown): TeamActivityMutation {
    const payload = record(value);
    const revision = requiredString(payload.revision, 128);
    const date = requiredString(payload.date, 10);
    parseCalendarDate(date);
    const gameType = requiredString(payload.gameType, 30);
    if (!TEAM_GAME_TYPES.includes(gameType as typeof TEAM_GAME_TYPES[number])) {
        throw invalid("INVALID_GAME_TYPE", "경기 분류를 확인해주세요.");
    }
    const memo = optionalString(payload.memo, 500);
    if (!Array.isArray(payload.participants) || payload.participants.length < 1 || payload.participants.length > 50) {
        throw invalid("INVALID_PARTICIPANTS", "참가자 정보를 확인해주세요.");
    }
    const seen = new Set<string>();
    const participants = payload.participants.map((raw) => {
        const participant = record(raw);
        const memberId = participant.memberId == null ? null : requiredString(participant.memberId, 100);
        const name = requiredString(participant.name, 100);
        const key = memberId ? `member:${memberId}` : `guest:${name}`;
        if (seen.has(key)) throw invalid("DUPLICATE_PARTICIPANT", "같은 참가자를 중복으로 추가할 수 없습니다.");
        seen.add(key);
        if (!Array.isArray(participant.scores) || participant.scores.length < 1 || participant.scores.length > 12) {
            throw invalid("INVALID_SCORES", "참가자별 점수를 확인해주세요.");
        }
        const scores = participant.scores.map((score) => {
            if (!Number.isInteger(score) || Number(score) < 0 || Number(score) > 300) {
                throw invalid("INVALID_SCORE", "모든 점수는 0에서 300 사이의 정수여야 합니다.");
            }
            return Number(score);
        });
        return { memberId, name, scores };
    });
    return { revision, date, gameType, memo, participants };
}

export async function getEditableTeamActivity(
    actorUserId: string,
    teamId: string,
    activityId: string,
    dependencies: TeamManagementDependencies = defaultDependencies,
) {
    const { team, role } = await requireManager(actorUserId, teamId, dependencies);
    const loaded = await loadActivity(teamId, activityId, dependencies);
    const memberByUserId = new Map(team.members.map((member) => [member.userId, member]));
    const grouped = new Map<string, {
        memberId: string | null;
        name: string;
        scores: { id: string; score: number }[];
    }>();
    for (const score of loaded.scores) {
        const member = score.userId ? memberByUserId.get(score.userId) : null;
        const key = member ? `member:${member.id}` : `guest:${score.userId ?? score.guestName}`;
        let participant = grouped.get(key);
        if (!participant) {
            participant = {
                memberId: member?.id ?? null,
                name: member?.alias || member?.user.name || score.guestName || score.User?.name || "알 수 없음",
                scores: [],
            };
            grouped.set(key, participant);
        }
        participant.scores.push({ id: score.id, score: score.score });
    }
    return {
        role,
        activity: {
            id: activityId,
            revision: createActivityRevision(loaded.scores),
            date: loaded.parsed.date,
            gameType: loaded.scores.find((score) => score.gameType)?.gameType ?? "기타",
            memo: loaded.scores.find((score) => score.memo)?.memo ?? null,
            scoreCount: loaded.scores.length,
            participants: [...grouped.values()],
        },
    };
}

export async function updateTeamActivity(
    actorUserId: string,
    teamId: string,
    activityId: string,
    mutation: TeamActivityMutation,
    dependencies: TeamManagementDependencies = defaultDependencies,
) {
    const { team } = await requireManager(actorUserId, teamId, dependencies);
    const loaded = await loadActivity(teamId, activityId, dependencies);
    if (createActivityRevision(loaded.scores) !== mutation.revision) {
        throw new TeamManagementError("ACTIVITY_CONFLICT", "다른 관리자가 기록을 변경했습니다. 새로고침 후 다시 시도해주세요.", 409);
    }
    validateMemberIds(mutation.participants, team.members);
    const result = await dependencies.replaceScores({
        teamId,
        expectedIds: loaded.scores.map((score) => score.id),
        expectedRevision: mutation.revision,
        filter: loaded.parsed.filter,
        activityDate: loaded.parsed.date,
        date: mutation.date,
        gameType: mutation.gameType,
        memo: mutation.memo,
        participants: mutation.participants,
        members: team.members,
    });
    return { activityId: createTeamActivityId(mutation.date, "ALL"), updatedCount: result.createdCount };
}

export async function deleteTeamActivity(
    actorUserId: string,
    teamId: string,
    activityId: string,
    revision: string,
    dependencies: TeamManagementDependencies = defaultDependencies,
) {
    await requireManager(actorUserId, teamId, dependencies);
    const loaded = await loadActivity(teamId, activityId, dependencies);
    if (createActivityRevision(loaded.scores) !== revision) {
        throw new TeamManagementError("ACTIVITY_CONFLICT", "다른 관리자가 기록을 변경했습니다. 새로고침 후 다시 시도해주세요.", 409);
    }
    return dependencies.deleteScores({
        teamId,
        expectedIds: loaded.scores.map((score) => score.id),
        expectedRevision: revision,
        filter: loaded.parsed.filter,
        activityDate: loaded.parsed.date,
    });
}

export async function removeTeamMember(
    actorUserId: string,
    teamId: string,
    memberId: string,
    dependencies: TeamManagementDependencies = defaultDependencies,
) {
    const { team, role } = await requireManager(actorUserId, teamId, dependencies);
    const target = team.members.find((member) => member.id === memberId);
    if (!target) throw new TeamManagementError("MEMBER_NOT_FOUND", "팀원을 찾을 수 없습니다.", 404);
    if (target.userId === actorUserId) {
        throw new TeamManagementError("SELF_REMOVAL_FORBIDDEN", "자기 자신은 강퇴할 수 없습니다.", 400);
    }
    const targetRole = roleOf(team, target.userId);
    if (targetRole === "OWNER" || (role === "MANAGER" && targetRole === "MANAGER")) {
        throw new TeamManagementError("MEMBER_PROTECTED", "해당 팀원은 강퇴할 수 없습니다.", 403);
    }
    await dependencies.removeMember({
        teamId,
        memberId,
        userId: target.userId,
        displayName: target.alias || target.user.name,
    });
    return { removedMemberId: memberId };
}

export async function changeTeamMemberRole(
    actorUserId: string,
    teamId: string,
    memberId: string,
    nextRole: unknown,
    dependencies: TeamManagementDependencies = defaultDependencies,
) {
    const { team, role } = await requireManager(actorUserId, teamId, dependencies);
    if (role !== "OWNER") throw new TeamManagementError("FORBIDDEN", "팀장만 매니저 권한을 변경할 수 있습니다.", 403);
    if (nextRole !== "MANAGER" && nextRole !== "MEMBER") {
        throw invalid("INVALID_ROLE", "변경할 역할을 확인해주세요.");
    }
    const target = team.members.find((member) => member.id === memberId);
    if (!target) throw new TeamManagementError("MEMBER_NOT_FOUND", "팀원을 찾을 수 없습니다.", 404);
    if (target.userId === team.ownerId) {
        throw new TeamManagementError("OWNER_PROTECTED", "팀장 역할은 변경할 수 없습니다.", 403);
    }
    await dependencies.setManager(teamId, target.userId, nextRole === "MANAGER");
    return { memberId, role: nextRole };
}

async function requireManager(actorUserId: string, teamId: string, dependencies: TeamManagementDependencies) {
    const team = await dependencies.findAccessibleTeam(actorUserId, teamId);
    if (!team) throw new TeamManagementError("TEAM_NOT_FOUND", "동호회를 찾을 수 없습니다.", 404);
    const role = roleOf(team, actorUserId);
    if (role !== "OWNER" && role !== "MANAGER") {
        throw new TeamManagementError("FORBIDDEN", "팀장 또는 매니저 권한이 필요합니다.", 403);
    }
    return { team, role };
}

async function loadActivity(teamId: string, activityId: string, dependencies: TeamManagementDependencies) {
    const parsed = parseTeamActivityId(activityId);
    if (!parsed) throw new TeamManagementError("INVALID_ACTIVITY", "활동 정보를 확인해주세요.", 400);
    const start = new Date(`${parsed.date}T00:00:00+09:00`);
    const end = new Date(`${parsed.date}T23:59:59.999+09:00`);
    const rows = await dependencies.listScores(teamId, start, end);
    const mapped: TeamRecordScore[] = rows.map(({ User, ...score }) => ({ ...score, user: User }));
    const allowedIds = new Set(filterTeamRecordScores(mapped, parsed.filter).map((score) => score.id));
    const scores = rows.filter((score) => allowedIds.has(score.id));
    if (scores.length === 0) throw new TeamManagementError("ACTIVITY_NOT_FOUND", "활동 기록을 찾을 수 없습니다.", 404);
    return { parsed, scores };
}

function createActivityRevision(scores: Array<Pick<EditableScore, "id" | "score" | "gameDate" | "gameType" | "userId" | "guestName" | "memo" | "createdAt">>) {
    const value = [...scores]
        .sort((left, right) => left.id.localeCompare(right.id))
        .map((score) => [
            score.id, score.score, score.gameDate.toISOString(), score.gameType,
            score.userId, score.guestName, score.memo, score.createdAt.toISOString(),
        ]);
    return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function roleOf(team: Pick<TeamAccess, "ownerId" | "User">, userId: string) {
    if (team.ownerId === userId) return "OWNER" as const;
    if (team.User.some((manager) => manager.id === userId)) return "MANAGER" as const;
    return "MEMBER" as const;
}

function validateMemberIds(participants: TeamActivityMutation["participants"], members: TeamAccess["members"]) {
    const valid = new Set(members.map((member) => member.id));
    for (const participant of participants) {
        if (participant.memberId && !valid.has(participant.memberId)) {
            throw new TeamManagementError("INVALID_MEMBER", "선택한 팀원을 확인할 수 없습니다.", 400);
        }
    }
}

function filterEditableRows<T extends Pick<EditableScore, "id" | "score" | "gameDate" | "gameType" | "userId" | "guestName">>(
    rows: T[],
    filter: TeamRecordFilter,
) {
    const mapped: TeamRecordScore[] = rows.map((score) => ({
        ...score,
        user: null,
    }));
    const ids = new Set(filterTeamRecordScores(mapped, filter).map((score) => score.id));
    return rows.filter((score) => ids.has(score.id));
}

function kstDayRange(date: string) {
    return {
        start: new Date(`${date}T00:00:00+09:00`),
        end: new Date(`${date}T23:59:59.999+09:00`),
    };
}

function parseCalendarDate(value: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw invalid("INVALID_DATE", "경기 날짜를 확인해주세요.");
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
        throw invalid("INVALID_DATE", "경기 날짜를 확인해주세요.");
    }
    return parsed;
}

function record(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid("INVALID_REQUEST", "요청 내용을 확인해주세요.");
    return value as Record<string, unknown>;
}

function requiredString(value: unknown, max: number) {
    if (typeof value !== "string") throw invalid("INVALID_REQUEST", "요청 내용을 확인해주세요.");
    const clean = value.trim();
    if (!clean || clean.length > max) throw invalid("INVALID_REQUEST", "요청 내용을 확인해주세요.");
    return clean;
}

function optionalString(value: unknown, max: number) {
    if (value == null || value === "") return null;
    if (typeof value !== "string") throw invalid("INVALID_REQUEST", "요청 내용을 확인해주세요.");
    const clean = value.trim();
    if (clean.length > max) throw invalid("INVALID_REQUEST", "요청 내용을 확인해주세요.");
    return clean || null;
}

function invalid(code: string, message: string) {
    return new TeamManagementError(code, message, 400);
}
