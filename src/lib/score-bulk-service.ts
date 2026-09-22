import prisma from "@/lib/prisma";
import { v4 as uuidv4 } from "uuid";

export const SCORE_GAME_TYPES = ["정기전", "벙개", "상주", "교류전", "기타"] as const;

export type ScoreBulkRow = {
    memberName: string;
    memberId?: string | null;
    scores: number[];
    gameDate: Date;
    gameType: string;
    memo: string | null;
};

type TeamMemberRecord = {
    id: string;
    userId: string;
    alias: string | null;
    user: { name: string };
};

type TeamRecord = {
    id: string;
    name: string;
    ownerId: string | null;
    User: { id: string }[];
    members: TeamMemberRecord[];
};

export type ScoreCreateRecord = {
    id: string;
    score: number;
    userId: string | null;
    guestName: string | null;
    gameDate: Date;
    teamId: string;
    gameType: string;
    memo: string | null;
};

export type ScoreBulkDependencies = {
    findDefaultTeamId: (userId: string) => Promise<string | null>;
    findTeam: (teamId: string, actorUserId: string, requireActive?: boolean) => Promise<TeamRecord | null>;
    createScoresAtomically: (records: ScoreCreateRecord[]) => Promise<void>;
    createId: () => string;
};

const defaultDependencies: ScoreBulkDependencies = {
    async findDefaultTeamId(userId) {
        const membership = await prisma.teamMember.findFirst({
            where: { userId },
            select: { teamId: true },
        });
        return membership?.teamId ?? null;
    },
    async findTeam(teamId, actorUserId, requireActive = false) {
        return prisma.team.findUnique({
            where: { id: teamId, ...(requireActive ? { isActive: true } : {}) },
            select: {
                id: true,
                name: true,
                ownerId: true,
                User: {
                    where: { id: actorUserId },
                    select: { id: true },
                },
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
    async createScoresAtomically(records) {
        await prisma.$transaction(async (tx) => {
            for (const record of records) {
                const { userId, teamId, ...data } = record;
                await tx.score.create({
                    data: {
                        ...data,
                        User: userId ? { connect: { id: userId } } : undefined,
                        Team: { connect: { id: teamId } },
                    },
                });
            }
        }, { timeout: 60000 });
    },
    createId: uuidv4,
};

export class ScoreBulkServiceError extends Error {
    constructor(
        public readonly code: string,
        message: string,
        public readonly status: number,
    ) {
        super(message);
        this.name = "ScoreBulkServiceError";
    }
}

export async function saveBulkScoreRows(
    input: {
        actorUserId: string;
        teamId?: string;
        rows: ScoreBulkRow[];
        requireMembership: boolean;
        allowPrivilegedWithoutMembership?: boolean;
        memberMatchMode: "none" | "preferred-name" | "alias-or-name";
        allowEmpty?: boolean;
        requireActiveTeam?: boolean;
    },
    dependencies: ScoreBulkDependencies = defaultDependencies,
) {
    const teamId = input.teamId || await dependencies.findDefaultTeamId(input.actorUserId);
    if (!teamId) {
        throw new ScoreBulkServiceError("TEAM_REQUIRED", "팀에 소속되어 있지 않습니다.", 400);
    }

    const team = await dependencies.findTeam(teamId, input.actorUserId, input.requireActiveTeam);
    if (!team) {
        throw new ScoreBulkServiceError("TEAM_NOT_FOUND", "팀 정보를 찾을 수 없습니다.", 404);
    }

    const isOwner = team.ownerId === input.actorUserId;
    const isManager = team.User.length > 0;
    const isMember = team.members.some((member) => member.userId === input.actorUserId);
    if (
        input.requireMembership &&
        !isMember &&
        !(input.allowPrivilegedWithoutMembership && (isOwner || isManager))
    ) {
        throw new ScoreBulkServiceError("FORBIDDEN", "팀 구성원만 점수를 등록할 수 있습니다.", 403);
    }
    if (!isOwner && !isManager) {
        throw new ScoreBulkServiceError(
            "FORBIDDEN",
            "권한이 없습니다. 팀장 또는 매니저만 일괄 등록할 수 있습니다.",
            403,
        );
    }
    if (input.rows.length === 0 && !input.allowEmpty) {
        throw new ScoreBulkServiceError("EMPTY_SCORES", "등록할 데이터가 없습니다.", 400);
    }

    const records: ScoreCreateRecord[] = [];
    for (const row of input.rows) {
        const member = resolveMember(team.members, row, input.memberMatchMode);
        for (const score of row.scores) {
            records.push({
                id: dependencies.createId(),
                score,
                userId: member?.userId ?? null,
                guestName: member ? null : row.memberName.trim(),
                gameDate: row.gameDate,
                teamId,
                gameType: row.gameType,
                memo: row.memo,
            });
        }
    }
    if (records.length === 0 && !input.allowEmpty) {
        throw new ScoreBulkServiceError("EMPTY_SCORES", "저장할 데이터가 없습니다.", 400);
    }

    await dependencies.createScoresAtomically(records);
    return {
        teamId,
        playerCount: input.rows.length,
        createdCount: records.length,
    };
}

function resolveMember(
    members: TeamMemberRecord[],
    row: ScoreBulkRow,
    mode: "none" | "preferred-name" | "alias-or-name",
) {
    if (row.memberId) {
        const member = members.find(
            (candidate) => candidate.id === row.memberId || candidate.userId === row.memberId,
        );
        if (!member) {
            throw new ScoreBulkServiceError(
                "INVALID_MEMBER",
                "선택한 팀원을 확인할 수 없습니다.",
                400,
            );
        }
        return member;
    }
    if (mode === "none") return null;
    const cleanName = row.memberName.trim();
    if (mode === "preferred-name") {
        return members.find((member) => (member.alias || member.user.name) === cleanName) ?? null;
    }
    return members.find(
        (member) => member.alias === cleanName || member.user.name === cleanName,
    ) ?? null;
}

export async function listManageableScoreTeams(userId: string) {
    const memberships = await prisma.teamMember.findMany({
        where: {
            userId,
            team: {
                isActive: true,
                OR: [
                    { ownerId: userId },
                    { User: { some: { id: userId } } },
                ],
            },
        },
        select: {
            team: {
                select: {
                    id: true,
                    name: true,
                    members: {
                        orderBy: { joinedAt: "asc" },
                        select: {
                            id: true,
                            userId: true,
                            alias: true,
                            user: { select: { name: true } },
                        },
                    },
                },
            },
        },
        orderBy: { joinedAt: "asc" },
    });
    return memberships.map(({ team }) => ({
        id: team.id,
        name: team.name,
        members: team.members.map((member) => ({
            id: member.id,
            name: member.alias || member.user.name,
        })),
    }));
}
