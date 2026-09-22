import prisma from "@/lib/prisma";
import {
    calculateTeamStatistics,
    createTeamActivities,
    createTeamActivityDetail,
    isTeamRecordFilter,
    parseTeamActivityId,
    type TeamRecordFilter,
    type TeamRecordMember,
    type TeamRecordScore,
} from "@/lib/team-records";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

type AccessRecord = { id: string };
type MemberRecord = { id: string; userId: string; alias: string | null; user: { name: string } };
type ScoreRecord = Omit<TeamRecordScore, "user"> & { User: { name: string | null } | null };

export type TeamRecordsDependencies = {
    findAccessibleTeam(userId: string, teamId: string): Promise<AccessRecord | null>;
    listMembers(teamId: string): Promise<MemberRecord[]>;
    listScores(teamId: string, start: Date, end: Date): Promise<ScoreRecord[]>;
    listScoreDates(teamId: string): Promise<{ gameDate: Date }[]>;
};

const defaultDependencies: TeamRecordsDependencies = {
    findAccessibleTeam(userId, teamId) {
        return prisma.team.findFirst({
            where: {
                id: teamId,
                isActive: true,
                members: { some: { userId } },
            },
            select: { id: true },
        });
    },
    listMembers(teamId) {
        return prisma.teamMember.findMany({
            where: { teamId },
            orderBy: [{ joinedAt: "asc" }, { id: "asc" }],
            select: {
                id: true,
                userId: true,
                alias: true,
                user: { select: { name: true } },
            },
        });
    },
    listScores(teamId, start, end) {
        return prisma.score.findMany({
            where: { teamId, gameDate: { gte: start, lte: end } },
            orderBy: { gameDate: "desc" },
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
    listScoreDates(teamId) {
        return prisma.score.findMany({
            where: { teamId },
            orderBy: [{ gameDate: "desc" }, { id: "asc" }],
            select: { gameDate: true },
        });
    },
};

export type TeamRecordsQuery = {
    year: number;
    filter: TeamRecordFilter;
};

export function parseTeamRecordsQuery(searchParams: URLSearchParams): TeamRecordsQuery | null {
    const rawYear = searchParams.get("year");
    const year = rawYear === null ? new Date().getFullYear() : Number(rawYear);
    const filter = searchParams.get("type") ?? "REGULAR";
    if (!Number.isSafeInteger(year) || year < 1900 || year > 2100 || !isTeamRecordFilter(filter)) {
        return null;
    }
    return { year, filter };
}

export function parseTeamActivitiesPagination(searchParams: URLSearchParams) {
    const parsedPage = Number(searchParams.get("page") ?? "1");
    const parsedLimit = Number(searchParams.get("limit") ?? String(DEFAULT_LIMIT));
    if (!Number.isSafeInteger(parsedPage) || parsedPage < 1
        || !Number.isSafeInteger(parsedLimit) || parsedLimit < 1) {
        return null;
    }
    return { page: parsedPage, limit: Math.min(parsedLimit, MAX_LIMIT) };
}

export async function getMobileTeamStatistics(
    userId: string,
    teamId: string,
    query: TeamRecordsQuery,
    dependencies: TeamRecordsDependencies = defaultDependencies,
) {
    const data = await loadYearData(userId, teamId, query.year, dependencies, true);
    if (!data) return null;
    const calculated = calculateTeamStatistics(data.scores, data.members, query.filter);
    return {
        year: query.year,
        filter: query.filter,
        availableYears: data.availableYears,
        ...calculated,
    };
}

export async function getMobileTeamActivities(
    userId: string,
    teamId: string,
    query: TeamRecordsQuery,
    page: number,
    limit: number,
    dependencies: TeamRecordsDependencies = defaultDependencies,
) {
    const data = await loadYearData(userId, teamId, query.year, dependencies, false);
    if (!data) return null;
    const allItems = createTeamActivities(teamId, data.scores, data.members, query.filter);
    const start = (page - 1) * limit;
    return {
        year: query.year,
        filter: query.filter,
        items: allItems.slice(start, start + limit),
        pagination: {
            page,
            limit,
            total: allItems.length,
            totalPages: Math.ceil(allItems.length / limit),
        },
    };
}

export async function getMobileTeamActivityDetail(
    userId: string,
    teamId: string,
    activityId: string,
    dependencies: TeamRecordsDependencies = defaultDependencies,
) {
    const access = await dependencies.findAccessibleTeam(userId, teamId);
    if (!access) return { kind: "TEAM_NOT_FOUND" as const };
    const parsed = parseTeamActivityId(activityId);
    if (!parsed) return { kind: "INVALID_ACTIVITY" as const };

    const start = new Date(`${parsed.date}T00:00:00+09:00`);
    const end = new Date(`${parsed.date}T23:59:59.999+09:00`);
    const [memberRows, scoreRows] = await Promise.all([
        dependencies.listMembers(teamId),
        dependencies.listScores(teamId, start, end),
    ]);
    const detail = createTeamActivityDetail(
        teamId,
        parsed.date,
        mapScores(scoreRows),
        mapMembers(memberRows),
        parsed.filter,
    );
    return detail
        ? { kind: "FOUND" as const, activity: detail }
        : { kind: "ACTIVITY_NOT_FOUND" as const };
}

async function loadYearData(
    userId: string,
    teamId: string,
    year: number,
    dependencies: TeamRecordsDependencies,
    includeYears: boolean,
) {
    const access = await dependencies.findAccessibleTeam(userId, teamId);
    if (!access) return null;
    const start = new Date(`${year}-01-01T00:00:00.000Z`);
    const end = new Date(`${year}-12-31T23:59:59.999Z`);
    const [memberRows, scoreRows, dateRows] = await Promise.all([
        dependencies.listMembers(teamId),
        dependencies.listScores(teamId, start, end),
        includeYears ? dependencies.listScoreDates(teamId) : Promise.resolve([]),
    ]);
    const years = [...new Set(dateRows.map((row) => row.gameDate.getFullYear()))]
        .sort((left, right) => right - left);
    if (!years.includes(year)) years.unshift(year);
    return {
        members: mapMembers(memberRows),
        scores: mapScores(scoreRows),
        availableYears: years,
    };
}

function mapMembers(rows: MemberRecord[]): TeamRecordMember[] {
    return rows.map((member) => ({
        id: member.id,
        userId: member.userId,
        name: member.alias || member.user.name,
    }));
}

function mapScores(rows: ScoreRecord[]): TeamRecordScore[] {
    return rows.map(({ User, ...score }) => ({ ...score, user: User }));
}
