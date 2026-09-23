import prisma from "@/lib/prisma";
import {
    calculateTeamStatistics,
    createTeamActivityFeed,
    teamActivityDateKey,
    teamRecordFilterForGameType,
    type TeamRecordMember,
    type TeamRecordScore,
} from "@/lib/team-records";
import {
    getUnifiedSeasonRanking,
    readSeasonPointTable,
    serializeSeasonPointTable,
    serializeSeasonSummary,
    UnifiedSeasonError,
} from "@/lib/mobile-api/unified-season";

export type SeasonScoringMode = "FULL_RANK" | "PODIUM";
export type PublishedEventAward = {
    date: string;
    gameType: string | null;
    rows: { memberId: string; rank: number | null; seasonPoint: number }[];
};
type TeamRole = "OWNER" | "MANAGER" | "MEMBER";

export class ClubExpansionError extends Error {
    constructor(public readonly code: string, message: string, public readonly status: number) {
        super(message);
    }
}

const accessSelect = {
    id: true,
    name: true,
    ownerId: true,
    description: true,
    notice: true,
    seasonRankingEnabled: true,
    User: { select: { id: true } },
    members: {
        orderBy: [{ joinedAt: "asc" as const }, { id: "asc" as const }],
        select: {
            id: true, userId: true, alias: true, joinedAt: true,
            user: { select: { name: true, handicap: true } },
        },
    },
};

async function requireTeam(userId: string, teamId: string) {
    const team = await prisma.team.findFirst({
        where: { id: teamId, isActive: true, members: { some: { userId } } },
        select: accessSelect,
    });
    if (!team) throw new ClubExpansionError("TEAM_NOT_FOUND", "동호회를 찾을 수 없습니다.", 404);
    return team;
}

function roleOf(team: { ownerId: string | null; User: { id: string }[] }, userId: string): TeamRole {
    if (team.ownerId === userId) return "OWNER";
    if (team.User.some((manager) => manager.id === userId)) return "MANAGER";
    return "MEMBER";
}

const displayMembers = (members: Awaited<ReturnType<typeof requireTeam>>["members"]): TeamRecordMember[] =>
    members.map((member) => ({
        id: member.id,
        userId: member.userId,
        name: member.alias || member.user.name,
    }));

function mappedScores(rows: Awaited<ReturnType<typeof listTeamScores>>): TeamRecordScore[] {
    return rows.map(({ User, ...score }) => ({ ...score, user: User }));
}

async function listTeamScores(teamId: string, start?: Date, end?: Date) {
    return prisma.score.findMany({
        where: {
            teamId,
            gameType: "정기전",
            ...(start && end ? { gameDate: { gte: start, lte: end } } : {}),
        },
        orderBy: [{ gameDate: "desc" }, { createdAt: "asc" }, { id: "asc" }],
        select: {
            id: true, score: true, gameDate: true, gameType: true,
            userId: true, guestName: true, memo: true, createdAt: true,
            User: { select: { name: true } },
        },
    });
}

export function parseExpansionYear(searchParams: URLSearchParams) {
    const year = Number(searchParams.get("year") ?? new Date().getFullYear());
    return Number.isSafeInteger(year) && year >= 1900 && year <= 2100 ? year : null;
}

export async function getMobileMemberProfile(
    actorUserId: string,
    teamId: string,
    memberId: string,
    year: number,
) {
    const team = await requireTeam(actorUserId, teamId);
    const member = team.members.find((candidate) => candidate.id === memberId);
    if (!member) throw new ClubExpansionError("MEMBER_NOT_FOUND", "회원을 찾을 수 없습니다.", 404);
    const allScores = mappedScores(await listTeamScores(teamId));
    const yearScores = allScores.filter(
        (score) => Number(teamActivityDateKey(score.gameDate).slice(0, 4)) === year,
    );
    const members = displayMembers(team.members);
    const statistics = calculateTeamStatistics(yearScores, members, "REGULAR");
    const stats = statistics.members.find((candidate) => candidate.id === memberId);
    const activities = createTeamActivityFeed(teamId, yearScores, members, ["REGULAR"]);
    let gold = 0;
    let silver = 0;
    let bronze = 0;
    for (const activity of activities) {
        const participant = activity.participants.find((candidate) => candidate.id === memberId);
        if (participant?.rank === 1) gold += 1;
        if (participant?.rank === 2) silver += 1;
        if (participant?.rank === 3) bronze += 1;
    }
    const memberScores = allScores.filter((score) => score.userId === member.userId);
    const activityStartDate = memberScores.length > 0
        ? [...memberScores].sort((left, right) => left.gameDate.getTime() - right.gameDate.getTime())[0].gameDate
        : null;
    return {
        id: member.id,
        name: member.alias || member.user.name,
        alias: member.alias,
        role: roleOf(team, member.userId),
        handicap: member.user.handicap,
        joinedAt: member.joinedAt.toISOString(),
        activityStartDate: activityStartDate ? teamActivityDateKey(activityStartDate) : null,
        year,
        attendanceRate: stats?.attendanceRate ?? 0,
        attended: stats?.attended ?? 0,
        activityCount: stats?.activityCount ?? statistics.summary.activityCount,
        gameCount: stats?.gameCount ?? 0,
        total: stats?.total ?? 0,
        average: stats?.average ?? 0,
        monthlyAverages: stats?.monthlyAverages ?? Array.from({ length: 12 }, () => null),
        medals: { gold, silver, bronze },
        recentRegularScores: memberScores.slice(0, 10).map((score) => ({
            id: score.id,
            date: teamActivityDateKey(score.gameDate),
            score: score.score,
        })),
    };
}

export async function listMobileTeamPosts(actorUserId: string, teamId: string, page: number, limit: number) {
    await requireTeam(actorUserId, teamId);
    const skip = (page - 1) * limit;
    const [posts, total] = await prisma.$transaction([
        prisma.post.findMany({
            where: { teamId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip, take: limit,
            select: { id: true, title: true, createdAt: true, updatedAt: true, author: { select: { name: true } }, _count: { select: { images: true } } },
        }),
        prisma.post.count({ where: { teamId } }),
    ]);
    return {
        items: posts.map((post) => ({
            id: post.id, title: post.title, authorName: post.author.name,
            createdAt: post.createdAt.toISOString(), updatedAt: post.updatedAt.toISOString(),
            imageCount: post._count.images,
        })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
}

export async function getMobileTeamPost(actorUserId: string, teamId: string, postId: string) {
    await requireTeam(actorUserId, teamId);
    const post = await prisma.post.findFirst({
        where: { id: postId, teamId },
        select: {
            id: true, title: true, content: true, authorId: true, createdAt: true, updatedAt: true,
            author: { select: { name: true } }, images: { orderBy: { createdAt: "asc" }, select: { id: true, url: true } },
        },
    });
    if (!post) throw new ClubExpansionError("POST_NOT_FOUND", "게시글을 찾을 수 없습니다.", 404);
    return {
        id: post.id, title: post.title, content: post.content, authorName: post.author.name,
        createdAt: post.createdAt.toISOString(), updatedAt: post.updatedAt.toISOString(),
        images: post.images, canEdit: post.authorId === actorUserId,
    };
}

function parsePostInput(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const title = typeof (value as Record<string, unknown>).title === "string"
        ? ((value as Record<string, unknown>).title as string).trim() : "";
    const content = typeof (value as Record<string, unknown>).content === "string"
        ? ((value as Record<string, unknown>).content as string).trim() : "";
    return title.length >= 1 && title.length <= 120 && content.length >= 1 && content.length <= 10000
        ? { title, content } : null;
}

export async function createMobileTeamPost(actorUserId: string, teamId: string, input: unknown) {
    await requireTeam(actorUserId, teamId);
    const data = parsePostInput(input);
    if (!data) throw new ClubExpansionError("INVALID_POST", "제목과 내용을 확인해주세요.", 400);
    const post = await prisma.post.create({ data: { ...data, teamId, authorId: actorUserId }, select: { id: true } });
    return { postId: post.id };
}

export async function updateMobileTeamPost(actorUserId: string, teamId: string, postId: string, input: unknown) {
    await requireTeam(actorUserId, teamId);
    const data = parsePostInput(input);
    if (!data) throw new ClubExpansionError("INVALID_POST", "제목과 내용을 확인해주세요.", 400);
    const post = await prisma.post.findFirst({ where: { id: postId, teamId }, select: { authorId: true } });
    if (!post) throw new ClubExpansionError("POST_NOT_FOUND", "게시글을 찾을 수 없습니다.", 404);
    if (post.authorId !== actorUserId) throw new ClubExpansionError("FORBIDDEN", "작성자만 게시글을 수정할 수 있습니다.", 403);
    await prisma.post.update({ where: { id: postId }, data });
    return { postId };
}

export async function deleteMobileTeamPost(actorUserId: string, teamId: string, postId: string) {
    await requireTeam(actorUserId, teamId);
    const post = await prisma.post.findFirst({ where: { id: postId, teamId }, select: { authorId: true } });
    if (!post) throw new ClubExpansionError("POST_NOT_FOUND", "게시글을 찾을 수 없습니다.", 404);
    if (post.authorId !== actorUserId) throw new ClubExpansionError("FORBIDDEN", "작성자만 게시글을 삭제할 수 있습니다.", 403);
    await prisma.post.delete({ where: { id: postId } });
    return { deletedPostId: postId };
}

export async function getMobileTeamProfile(actorUserId: string, teamId: string) {
    const team = await requireTeam(actorUserId, teamId);
    const activeSeason = await prisma.teamSeason.findFirst({
        where: { teamId, status: "ACTIVE" }, orderBy: [{ startDate: "desc" }, { id: "asc" }],
    });
    return {
        id: team.id, name: team.name, description: team.description, notice: team.notice,
        myRole: roleOf(team, actorUserId), seasonRankingEnabled: team.seasonRankingEnabled,
        activeSeason: activeSeason ? serializeSeason(activeSeason) : null,
    };
}

const serializeSeason = serializeSeasonSummary;

function parseKstSeasonDate(value: unknown, endOfDay: boolean) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}+09:00`);
    return !Number.isNaN(date.getTime()) && teamActivityDateKey(date) === value ? date : null;
}

export async function updateMobileTeamProfile(actorUserId: string, teamId: string, input: unknown) {
    const team = await requireTeam(actorUserId, teamId);
    const role = roleOf(team, actorUserId);
    if (role === "MEMBER") throw new ClubExpansionError("FORBIDDEN", "관리 권한이 없습니다.", 403);
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new ClubExpansionError("INVALID_SETTINGS", "설정을 확인해주세요.", 400);
    const body = input as Record<string, unknown>;
    const description = body.description === null ? null : typeof body.description === "string" ? body.description.trim() : team.description;
    const notice = body.notice === null ? null : typeof body.notice === "string" ? body.notice.trim() : team.notice;
    if ((description?.length ?? 0) > 2000 || (notice?.length ?? 0) > 2000) throw new ClubExpansionError("INVALID_SETTINGS", "소개와 공지는 2,000자 이하여야 합니다.", 400);
    const hasSeason = Object.hasOwn(body, "seasonRankingEnabled") || Object.hasOwn(body, "season");
    const seasonEnabled = typeof body.seasonRankingEnabled === "boolean" ? body.seasonRankingEnabled : team.seasonRankingEnabled;
    const season = body.season;
    let parsedSeason: {
        id: string | null; name: string; start: Date; end: Date; mode: SeasonScoringMode;
        individualPoints: { rank: number; points: number }[];
        teamPoints: { rank: number; points: number }[];
        eventPoints: { rank: number; points: number }[];
    } | null = null;
    if (season !== undefined && season !== null) {
        if (typeof season !== "object" || Array.isArray(season)) throw new ClubExpansionError("INVALID_SETTINGS", "시즌 설정을 확인해주세요.", 400);
        const value = season as Record<string, unknown>;
        const name = typeof value.name === "string" ? value.name.trim() : "";
        const start = parseKstSeasonDate(value.startDate, false);
        const end = parseKstSeasonDate(value.endDate, true);
        const mode = value.scoringMode;
        const id = typeof value.id === "string" && value.id ? value.id : null;
        const tables = value.pointTables && typeof value.pointTables === "object" && !Array.isArray(value.pointTables)
            ? value.pointTables as Record<string, unknown> : null;
        const legacy = value.points;
        let individualPoints: { rank: number; points: number }[];
        let teamPoints: { rank: number; points: number }[];
        let eventPoints: { rank: number; points: number }[];
        try {
            individualPoints = parsePointInput(tables?.individual ?? legacy);
            teamPoints = parsePointInput(tables?.team ?? legacy);
            eventPoints = parsePointInput(tables?.event ?? legacy);
        } catch {
            throw new ClubExpansionError("INVALID_SETTINGS", "시즌 유형별 포인트를 확인해주세요.", 400);
        }
        if (!name || name.length > 80 || !start || !end || start > end
            || (mode !== "FULL_RANK" && mode !== "PODIUM") || individualPoints.length < 1 || teamPoints.length < 1 || eventPoints.length < 1) {
            throw new ClubExpansionError("INVALID_SETTINGS", "시즌 설정을 확인해주세요.", 400);
        }
        parsedSeason = { id, name, start, end, mode, individualPoints, teamPoints, eventPoints };
    }
    await prisma.$transaction(async (tx) => {
        await tx.team.update({ where: { id: teamId }, data: { description: description || null, notice: notice || null, seasonRankingEnabled: seasonEnabled } });
        if (parsedSeason) {
            const data = {
                name: parsedSeason.name, startDate: parsedSeason.start, endDate: parsedSeason.end,
                enabled: true, status: "ACTIVE",
                scoringMode: parsedSeason.mode,
                pointsConfig: JSON.stringify(parsedSeason.individualPoints.map((item) => item.points)),
                individualPointsConfig: serializeSeasonPointTable(parsedSeason.individualPoints),
                teamPointsConfig: serializeSeasonPointTable(parsedSeason.teamPoints),
                eventPointsConfig: serializeSeasonPointTable(parsedSeason.eventPoints),
            };
            await tx.teamSeason.updateMany({ where: { teamId, status: "ACTIVE", ...(parsedSeason.id ? { id: { not: parsedSeason.id } } : {}) }, data: { enabled: false, status: "COMPLETED" } });
            if (parsedSeason.id) {
                const updated = await tx.teamSeason.updateMany({ where: { id: parsedSeason.id, teamId }, data });
                if (updated.count !== 1) throw new ClubExpansionError("SEASON_NOT_FOUND", "수정할 시즌을 찾을 수 없습니다.", 404);
            } else await tx.teamSeason.create({ data: { teamId, ...data } });
        }
    });
    return getMobileTeamProfile(actorUserId, teamId);
}

export function calculateSeasonRanking(
    teamId: string,
    scores: TeamRecordScore[],
    members: TeamRecordMember[],
    scoringMode: SeasonScoringMode,
    points: readonly number[],
    publishedEventAwards: readonly PublishedEventAward[] = [],
) {
    const activities = createTeamActivityFeed(teamId, scores, members, ["REGULAR"]);
    const regularEventDates = new Set(publishedEventAwards
        .filter((event) => teamRecordFilterForGameType(event.gameType) === "REGULAR")
        .map((event) => event.date));
    const rows = new Map(members.map((member) => [member.id, {
        id: member.id, name: member.name, points: 0, attended: 0, games: 0,
        total: 0, gold: 0, silver: 0, bronze: 0,
    }]));
    for (const activity of activities) {
        const eventActivity = regularEventDates.has(activity.date);
        for (const participant of activity.participants) {
            const row = rows.get(participant.id);
            if (!row) continue;
            row.attended += 1;
            row.games += participant.scores.length;
            row.total += participant.total;
            if (!eventActivity && participant.rank === 1) row.gold += 1;
            if (!eventActivity && participant.rank === 2) row.silver += 1;
            if (!eventActivity && participant.rank === 3) row.bronze += 1;
            if (!eventActivity && (scoringMode === "FULL_RANK" || participant.rank <= 3)) {
                row.points += points[participant.rank - 1] ?? 0;
            }
        }
    }
    for (const event of publishedEventAwards) {
        const regular = teamRecordFilterForGameType(event.gameType) === "REGULAR";
        for (const award of event.rows) {
            const row = rows.get(award.memberId);
            if (!row) continue;
            if (!regular) row.attended += 1;
            if (award.rank === null) continue;
            if (award.rank === 1) row.gold += 1;
            if (award.rank === 2) row.silver += 1;
            if (award.rank === 3) row.bronze += 1;
            row.points += award.seasonPoint;
        }
    }
    return [...rows.values()].map((row) => ({
        ...row, average: row.games > 0 ? Number((row.total / row.games).toFixed(1)) : 0,
    })).sort((left, right) => right.points - left.points || right.gold - left.gold
        || right.silver - left.silver || right.bronze - left.bronze
        || right.average - left.average || left.name.localeCompare(right.name, "ko")
        || left.id.localeCompare(right.id))
        .map((row, index) => ({ rank: index + 1, ...row }));
}

export async function getMobileSeasonRanking(actorUserId: string, teamId: string) {
    try { return await getUnifiedSeasonRanking(actorUserId, teamId); }
    catch (error) {
        if (error instanceof UnifiedSeasonError) throw new ClubExpansionError(error.code, error.message, error.status);
        throw error;
    }
}

function parsePointInput(value: unknown) {
    if (!Array.isArray(value) || value.length < 1 || value.length > 100) throw new Error("invalid points");
    const normalized = value.map((item, index) => typeof item === "number" ? { rank: index + 1, points: item } : item);
    return readSeasonPointTable(serializeSeasonPointTable(normalized));
}
