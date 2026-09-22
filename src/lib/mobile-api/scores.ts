import prisma from "@/lib/prisma";
import {
    mobileScoreOrderBy,
    mobileScoreSelect,
    mobileScoreWhere,
    toMobileScoreItem,
} from "@/lib/mobile-api/score-record";
import { groupScores, type ScoreGameGroup } from "@/lib/score-groups";
import {
    createTeamActivityDetail,
    teamActivityDateKey,
    type TeamRecordMember,
    type TeamRecordScore,
} from "@/lib/team-records";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

type MobileGroupScoreRow = {
    id: string;
    score: number;
    gameDate: Date;
    gameType: string | null;
    memo: string | null;
    createdAt: Date;
    Team: { id: string; name: string } | null;
};

type TeamRankScoreRow = Omit<TeamRecordScore, "user"> & {
    teamId: string | null;
    User: { name: string | null } | null;
};

type TeamRankMemberRow = {
    id: string;
    teamId: string;
    userId: string;
    alias: string | null;
    user: { name: string };
};

type TeamRankScope = { teamId: string; date: string };

export type MobileScoreGroupDependencies = {
    listUserScores(userId: string): Promise<MobileGroupScoreRow[]>;
    listTeamRegularScores(scopes: TeamRankScope[]): Promise<TeamRankScoreRow[]>;
    listTeamMembers(teamIds: string[]): Promise<TeamRankMemberRow[]>;
};

const defaultGroupDependencies: MobileScoreGroupDependencies = {
    listUserScores(userId) {
        return prisma.score.findMany({
            where: mobileScoreWhere(userId),
            orderBy: mobileScoreOrderBy,
            select: {
                ...mobileScoreSelect,
                createdAt: true,
            },
        });
    },
    listTeamRegularScores(scopes) {
        if (scopes.length === 0) return Promise.resolve([]);
        return prisma.score.findMany({
            where: {
                gameType: "정기전",
                OR: scopes.map((scope) => {
                    const start = new Date(`${scope.date}T00:00:00+09:00`);
                    return {
                        teamId: scope.teamId,
                        gameDate: {
                            gte: start,
                            lt: new Date(start.getTime() + 24 * 60 * 60 * 1000),
                        },
                    };
                }),
            },
            orderBy: [{ gameDate: "asc" }, { createdAt: "asc" }, { id: "asc" }],
            select: {
                id: true,
                score: true,
                gameDate: true,
                gameType: true,
                userId: true,
                teamId: true,
                guestName: true,
                memo: true,
                createdAt: true,
                User: { select: { name: true } },
            },
        });
    },
    listTeamMembers(teamIds) {
        if (teamIds.length === 0) return Promise.resolve([]);
        return prisma.teamMember.findMany({
            where: { teamId: { in: teamIds } },
            orderBy: [{ joinedAt: "asc" }, { id: "asc" }],
            select: {
                id: true,
                teamId: true,
                userId: true,
                alias: true,
                user: { select: { name: true } },
            },
        });
    },
};

function parsePositiveInteger(value: string | null, fallback: number) {
    if (!value) return fallback;

    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function parseMobileScorePagination(searchParams: URLSearchParams) {
    const page = parsePositiveInteger(searchParams.get("page"), DEFAULT_PAGE);
    const requestedLimit = parsePositiveInteger(searchParams.get("limit"), DEFAULT_LIMIT);

    return {
        page,
        limit: Math.min(requestedLimit, MAX_LIMIT),
    };
}

export async function getMobileScores(userId: string, page: number, limit: number) {
    const where = mobileScoreWhere(userId);

    const [scoreRecords, total] = await prisma.$transaction([
        prisma.score.findMany({
            where,
            orderBy: mobileScoreOrderBy,
            skip: (page - 1) * limit,
            take: limit,
            select: mobileScoreSelect,
        }),
        prisma.score.count({ where }),
    ]);

    const items = scoreRecords.map(toMobileScoreItem);

    return {
        items,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
}

export async function getMobileScoreGroups(
    userId: string,
    page: number,
    limit: number,
    dependencies: MobileScoreGroupDependencies = defaultGroupDependencies,
) {
    const scoreRecords = await dependencies.listUserScores(userId);
    const groups = groupScores(scoreRecords.map(({ Team, ...score }) => ({
        ...score,
        source: "PERSONAL" as const,
        team: Team,
    })));
    const total = groups.length;
    const start = (page - 1) * limit;
    const pageItems = groups.slice(start, start + limit);

    return {
        items: await addTeamRegularRanks(userId, pageItems, scoreRecords, dependencies),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
}

async function addTeamRegularRanks(
    userId: string,
    groups: ScoreGameGroup[],
    userScores: MobileGroupScoreRow[],
    dependencies: MobileScoreGroupDependencies,
) {
    const userScoreById = new Map(userScores.map((score) => [score.id, score]));
    const scopeByGroupId = new Map<string, TeamRankScope>();
    const uniqueScopes = new Map<string, TeamRankScope>();

    for (const group of groups) {
        if (group.gameType !== "정기전" || !group.team) continue;
        const dates = new Set<string>();
        let complete = true;
        for (const score of group.scores) {
            const source = userScoreById.get(score.id);
            if (!source) {
                complete = false;
                break;
            }
            dates.add(teamActivityDateKey(source.gameDate));
        }
        if (!complete || dates.size !== 1) continue;
        const scope = { teamId: group.team.id, date: [...dates][0] };
        scopeByGroupId.set(group.id, scope);
        uniqueScopes.set(rankScopeKey(scope.teamId, scope.date), scope);
    }

    if (uniqueScopes.size === 0) {
        return groups.map((group) => ({ ...group, rank: null }));
    }

    const scopes = [...uniqueScopes.values()];
    const teamIds = [...new Set(scopes.map((scope) => scope.teamId))];
    const [teamScoreRows, memberRows] = await Promise.all([
        dependencies.listTeamRegularScores(scopes),
        dependencies.listTeamMembers(teamIds),
    ]);
    const scoresByScope = new Map<string, TeamRecordScore[]>();
    for (const { User, teamId, ...score } of teamScoreRows) {
        if (!teamId) continue;
        const key = rankScopeKey(teamId, teamActivityDateKey(score.gameDate));
        const mapped = { ...score, user: User };
        const existing = scoresByScope.get(key);
        if (existing) existing.push(mapped);
        else scoresByScope.set(key, [mapped]);
    }
    const membersByTeam = new Map<string, TeamRecordMember[]>();
    for (const member of memberRows) {
        const mapped = {
            id: member.id,
            userId: member.userId,
            name: member.alias || member.user.name,
        };
        const existing = membersByTeam.get(member.teamId);
        if (existing) existing.push(mapped);
        else membersByTeam.set(member.teamId, [mapped]);
    }

    const rankByScope = new Map<string, { position: number; participantCount: number } | null>();
    for (const scope of scopes) {
        const key = rankScopeKey(scope.teamId, scope.date);
        const members = membersByTeam.get(scope.teamId) ?? [];
        const currentMember = members.find((member) => member.userId === userId);
        const detail = currentMember
            ? createTeamActivityDetail(
                scope.teamId,
                scope.date,
                scoresByScope.get(key) ?? [],
                members,
                "REGULAR",
            )
            : null;
        const participant = detail?.participants.find((item) => item.id === currentMember?.id);
        rankByScope.set(key, participant && detail
            ? { position: participant.rank, participantCount: detail.participantCount }
            : null);
    }

    return groups.map((group) => {
        const scope = scopeByGroupId.get(group.id);
        return {
            ...group,
            rank: scope ? rankByScope.get(rankScopeKey(scope.teamId, scope.date)) ?? null : null,
        };
    });
}

function rankScopeKey(teamId: string, date: string) {
    return JSON.stringify([teamId, date]);
}
