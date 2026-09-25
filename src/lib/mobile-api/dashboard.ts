import prisma from "@/lib/prisma";
import {
    getAllPersonalStatisticsData,
    getPersonalStatisticsData,
    summarizeIntegratedRecords,
    type IntegratedRecord,
} from "@/lib/personal-statistics";
import { calculatePersonalProfile, PERSONAL_RADAR_AXES } from "@/lib/personal-profile";
import { getMobileSeasonRanking } from "@/lib/mobile-api/club-expansion";
import { groupScores } from "@/lib/score-groups";
import {
    calculateTeamStatistics,
    createTeamActivityDetail,
    teamActivityDateKey,
    type TeamRecordMember,
    type TeamRecordScore,
} from "@/lib/team-records";

type DashboardTeam = {
    id: string;
    name: string;
    ownerId: string | null;
    User: { id: string }[];
    seasonRankingEnabled: boolean;
    bowlerHiddenEnabled: boolean;
};
type DashboardMembership = { id: string; teamId: string; team: DashboardTeam };
type DashboardUser = { id: string; name: string; teamMemberships: DashboardMembership[] };
type DashboardScoreRow = Omit<TeamRecordScore, "user"> & {
    teamId: string | null;
    User: { name: string | null } | null;
};
type DashboardMemberRow = TeamRecordMember & { teamId: string };
type DashboardPersonalData = Awaited<ReturnType<typeof getPersonalStatisticsData>>;
type DashboardClubAchievement = {
    teamId: string; teamName: string; enabled: boolean; bowlerHiddenEnabled: boolean;
    seasonName: string | null; rank: number | null; points: number;
    gold: number; silver: number; bronze: number;
    individualPoints: number | null; teamPoints: number | null; eventPoints: number | null;
};

export type MobileDashboardDependencies = {
    findUser(userId: string): Promise<DashboardUser | null>;
    loadPersonal(user: DashboardUser, year: number): Promise<DashboardPersonalData>;
    listTeamScores(teamIds: string[], start: Date, end: Date): Promise<DashboardScoreRow[]>;
    listTeamMembers(teamIds: string[]): Promise<DashboardMemberRow[]>;
    countAllGames?(user: DashboardUser): Promise<number>;
    listClubAchievements?(user: DashboardUser): Promise<DashboardClubAchievement[]>;
};

const defaultDependencies: MobileDashboardDependencies = {
    findUser(userId) {
        return prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                teamMemberships: {
                    where: { team: { isActive: true } },
                    orderBy: [{ joinedAt: "asc" }, { id: "asc" }],
                    select: {
                        id: true,
                        teamId: true,
                        team: {
                            select: {
                                id: true,
                                name: true,
                                ownerId: true,
                                seasonRankingEnabled: true,
                                bowlerHiddenEnabled: true,
                                User: { select: { id: true } },
                            },
                        },
                    },
                },
            },
        });
    },
    loadPersonal(user, year) {
        return getPersonalStatisticsData(user, year);
    },
    listTeamScores(teamIds, start, end) {
        if (teamIds.length === 0) return Promise.resolve([]);
        return prisma.score.findMany({
            where: { teamId: { in: teamIds }, gameDate: { gte: start, lte: end } },
            orderBy: [{ gameDate: "asc" }, { createdAt: "asc" }, { id: "asc" }],
            select: {
                id: true, score: true, gameDate: true, gameType: true,
                userId: true, teamId: true, guestName: true, memo: true, createdAt: true,
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
                id: true, teamId: true, userId: true, alias: true,
                user: { select: { name: true } },
            },
        }).then((rows) => rows.map((member) => ({
            id: member.id,
            teamId: member.teamId,
            userId: member.userId,
            name: member.alias || member.user.name,
        })));
    },
    async countAllGames(user) {
        return (await getAllPersonalStatisticsData(user)).allRecords.length;
    },
    async listClubAchievements(user) {
        return Promise.all(user.teamMemberships.map(async (membership) => {
            const team = membership.team;
            if (!team.seasonRankingEnabled) return emptyClubAchievement(membership);
            const ranking = await getMobileSeasonRanking(user.id, membership.teamId);
            const mine = ranking.rankings.find((row) => row.id === membership.id);
            const hiddenMine = mine && "individualPoints" in mine ? mine : null;
            return {
                teamId: team.id,
                teamName: team.name,
                enabled: ranking.enabled,
                bowlerHiddenEnabled: team.bowlerHiddenEnabled,
                seasonName: ranking.season?.name ?? null,
                rank: mine?.rank ?? null,
                points: mine?.points ?? 0,
                gold: mine?.gold ?? 0,
                silver: mine?.silver ?? 0,
                bronze: mine?.bronze ?? 0,
                individualPoints: team.bowlerHiddenEnabled ? hiddenMine?.individualPoints ?? 0 : null,
                teamPoints: team.bowlerHiddenEnabled ? hiddenMine?.teamPoints ?? 0 : null,
                eventPoints: team.bowlerHiddenEnabled ? hiddenMine?.eventPoints ?? 0 : null,
            };
        }));
    },
};

// Fixed range accepts historic records and planned future years.
export function parseDashboardYear(params: URLSearchParams, now = new Date()): number | null {
    if (!params.has("year")) return now.getFullYear();
    const values = params.getAll("year");
    if (values.length !== 1 || !/^\d{4}$/.test(values[0])) return null;
    const year = Number(values[0]);
    return year >= 1900 && year <= 2100 ? year : null;
}

export async function getMobileDashboard(
    userId: string,
    year: number,
    dependencies: MobileDashboardDependencies = defaultDependencies,
) {
    const user = await dependencies.findUser(userId);
    if (!user) return { ...summarizeIntegratedRecords([], year), ...emptyDashboardExtensions() };

    const start = new Date(`${year}-01-01T00:00:00.000Z`);
    const end = new Date(`${year}-12-31T23:59:59.999Z`);
    const teamIds = user.teamMemberships.map((membership) => membership.teamId);
    const [personal, scoreRows, memberRows, clubAchievements] = await Promise.all([
        dependencies.loadPersonal(user, year),
        dependencies.listTeamScores(teamIds, start, end),
        dependencies.listTeamMembers(teamIds),
        dependencies.listClubAchievements ? dependencies.listClubAchievements(user) : Promise.resolve([]),
    ]);
    const compatiblePersonal = personal as DashboardPersonalData & {
        allRecords?: IntegratedRecord[];
        myYearlyScores?: unknown[];
    };
    const allRecords = compatiblePersonal.allRecords ?? personal.integratedRecords;
    const totalGameCount = dependencies.countAllGames
        ? await dependencies.countAllGames(user)
        : (compatiblePersonal.myYearlyScores?.length
            ?? personal.integratedRecords.filter((record) => record.source === "PERSONAL").length)
            + personal.officialRecords.length;
    return {
        ...summarizeIntegratedRecords(personal.integratedRecords, year),
        totalGameCount,
        regularAverage: categoryAverage(allRecords.filter((record) =>
            record.source === "PERSONAL" && record.gameType === "정기전")),
        officialAverage: categoryAverage(personal.officialRecords),
        clubAchievements,
        ...createDashboardExtensions(user, personal.integratedRecords, personal.officialRecords, scoreRows, memberRows),
    };
}

export function createDashboardExtensions(
    user: DashboardUser,
    integratedRecords: IntegratedRecord[],
    officialRecords: IntegratedRecord[],
    scoreRows: DashboardScoreRow[],
    memberRows: DashboardMemberRow[],
) {
    const teamScores = scoreRows.map(({ User, ...score }) => ({ ...score, user: User }));
    const regularScores = integratedRecords.filter((record) =>
        record.source === "PERSONAL" && record.gameType === "정기전",
    );
    const officialSessions = groupScores(officialRecords).map((session) => ({
        scores: session.scores.map((score) => score.score),
    }));
    const profile = calculatePersonalProfile({
        regularScores,
        officialSessions,
        allTeamRegularScores: scoreRows
            .filter((score) => score.gameType === "정기전")
            .map((score) => ({ score: score.score, gameDate: score.gameDate, teamId: score.teamId })),
    });
    return {
        profileRadar: profile.radar,
        medals: calculateMedals(user.id, teamScores, memberRows),
        personalStats: { regular: profile.regular, official: profile.official },
        teamSummaries: createTeamSummaries(user, teamScores, memberRows),
    };
}

function calculateMedals(
    userId: string,
    scores: (TeamRecordScore & { teamId: string | null })[],
    members: DashboardMemberRow[],
) {
    const counts = { goldCount: 0, silverCount: 0, bronzeCount: 0 };
    const regularByScope = new Map<string, (TeamRecordScore & { teamId: string | null })[]>();
    for (const score of scores) {
        if (score.gameType !== "정기전" || !score.teamId) continue;
        const key = scopeKey(score.teamId, teamActivityDateKey(score.gameDate));
        const existing = regularByScope.get(key);
        if (existing) existing.push(score);
        else regularByScope.set(key, [score]);
    }
    const membersByTeam = groupMembers(members);
    for (const [key, group] of regularByScope) {
        const [teamId, date] = JSON.parse(key) as [string, string];
        const teamMembers = membersByTeam.get(teamId) ?? [];
        const currentMember = teamMembers.find((member) => member.userId === userId);
        if (!currentMember) continue;
        const detail = createTeamActivityDetail(teamId, date, group, teamMembers, "REGULAR");
        const rank = detail?.participants.find((participant) => participant.id === currentMember.id)?.rank;
        if (rank === 1) counts.goldCount += 1;
        else if (rank === 2) counts.silverCount += 1;
        else if (rank === 3) counts.bronzeCount += 1;
    }
    return counts;
}

function createTeamSummaries(
    user: DashboardUser,
    scores: (TeamRecordScore & { teamId: string | null })[],
    members: DashboardMemberRow[],
) {
    const scoresByTeam = new Map<string, TeamRecordScore[]>();
    for (const score of scores) {
        if (!score.teamId) continue;
        const existing = scoresByTeam.get(score.teamId);
        if (existing) existing.push(score);
        else scoresByTeam.set(score.teamId, [score]);
    }
    const membersByTeam = groupMembers(members);
    return user.teamMemberships.map((membership) => {
        const teamMembers = membersByTeam.get(membership.teamId) ?? [];
        const calculated = calculateTeamStatistics(
            scoresByTeam.get(membership.teamId) ?? [],
            teamMembers,
            "REGULAR",
        );
        const mine = calculated.members.find((member) => member.id === membership.id);
        return {
            id: membership.team.id,
            name: membership.team.name,
            myRole: teamRole(membership.team, user.id),
            attended: mine?.attended ?? 0,
            activityCount: mine?.activityCount ?? calculated.summary.activityCount,
            attendanceRate: mine?.attendanceRate ?? 0,
            gameCount: mine?.gameCount ?? 0,
            average: mine?.average ?? 0,
        };
    });
}

function groupMembers(members: DashboardMemberRow[]) {
    const grouped = new Map<string, TeamRecordMember[]>();
    for (const { teamId, ...member } of members) {
        const existing = grouped.get(teamId);
        if (existing) existing.push(member);
        else grouped.set(teamId, [member]);
    }
    return grouped;
}

function teamRole(team: DashboardTeam, userId: string) {
    if (team.ownerId === userId) return "OWNER" as const;
    if (team.User.some((manager) => manager.id === userId)) return "MANAGER" as const;
    return "MEMBER" as const;
}

function scopeKey(teamId: string, date: string) {
    return JSON.stringify([teamId, date]);
}

function emptyDashboardExtensions() {
    return {
        profileRadar: { axes: PERSONAL_RADAR_AXES, series: [] },
        medals: { goldCount: 0, silverCount: 0, bronzeCount: 0 },
        personalStats: {
            regular: { average: 0, highScore: 0, lowScore: 0, gameCount: 0, roundSpread: 0, attendanceRate: 0 },
            official: { average: 0, highScore: 0, lowScore: 0, gameCount: 0, roundSpread: 0, roundCount: 0 },
        },
        teamSummaries: [],
        totalGameCount: 0,
        regularAverage: 0,
        officialAverage: 0,
        clubAchievements: [],
    };
}

function categoryAverage(records: IntegratedRecord[]) {
    if (records.length === 0) return 0;
    return Number((records.reduce((sum, record) => sum + record.score, 0) / records.length).toFixed(1));
}

function emptyClubAchievement(membership: DashboardMembership): DashboardClubAchievement {
    return {
        teamId: membership.team.id,
        teamName: membership.team.name,
        enabled: false,
        bowlerHiddenEnabled: membership.team.bowlerHiddenEnabled,
        seasonName: null,
        rank: null,
        points: 0,
        gold: 0,
        silver: 0,
        bronze: 0,
        individualPoints: null,
        teamPoints: null,
        eventPoints: null,
    };
}
