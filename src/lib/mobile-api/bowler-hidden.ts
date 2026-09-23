import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import {
    createSeasonPointPublication,
    getPublicationPointTable,
    getSeasonPointPreview,
    readSeasonPointTable,
    revokeSeasonPointPublication,
    seasonPointsForRank,
} from "@/lib/mobile-api/unified-season";

export const BOWLER_HIDDEN_COMPETITION_TYPES = ["INDIVIDUAL", "TEAM", "EVENT"] as const;
export const BOWLER_HIDDEN_LIFECYCLE = [
    "DRAFT", "ATTENDANCE_OPEN", "ATTENDANCE_LOCKED", "GROUPS_READY",
    "LANE_DRAW_OPEN", "IN_PROGRESS", "COMPLETED",
] as const;
export const BOWLER_HIDDEN_TIERS = ["A", "B", "C", "D", "E"] as const;

type Tier = typeof BOWLER_HIDDEN_TIERS[number];
type RankPoint = { rank: number; points: number };

export class BowlerHiddenError extends Error {
    constructor(public readonly code: string, message: string, public readonly status: number) {
        super(message);
    }
}

export function parseRankPoints(value: unknown): RankPoint[] {
    if (!Array.isArray(value) || value.length > 100) {
        throw new BowlerHiddenError("INVALID_RANK_POINTS", "순위 점수를 확인해주세요.", 400);
    }
    const ranks = new Set<number>();
    return value.map((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) {
            throw new BowlerHiddenError("INVALID_RANK_POINTS", "순위 점수를 확인해주세요.", 400);
        }
        const { rank, points } = item as Record<string, unknown>;
        if (!Number.isSafeInteger(rank) || (rank as number) < 1 ||
            !Number.isSafeInteger(points) || (points as number) < 0 || ranks.has(rank as number)) {
            throw new BowlerHiddenError("INVALID_RANK_POINTS", "순위와 점수는 중복 없는 0 이상의 정수여야 합니다.", 400);
        }
        ranks.add(rank as number);
        return { rank: rank as number, points: points as number };
    }).sort((left, right) => left.rank - right.rank);
}

export function serializeRankPoints(points: RankPoint[]): string {
    return JSON.stringify(Object.fromEntries(points.map((item) => [String(item.rank), item.points])));
}

export function readRankPoints(value: string): RankPoint[] {
    try {
        const parsed = JSON.parse(value) as unknown;
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return [];
        return Object.entries(parsed as Record<string, unknown>).map(([rank, points]) => ({
            rank: Number(rank), points: Number(points),
        })).filter((item) => Number.isSafeInteger(item.rank) && item.rank >= 1 &&
            Number.isSafeInteger(item.points) && item.points >= 0)
            .sort((left, right) => left.rank - right.rank);
    } catch { return []; }
}

export function tierForGroupingScore(value: number): Tier {
    if (value >= 200) return "A";
    if (value >= 190) return "B";
    if (value >= 180) return "C";
    if (value >= 170) return "D";
    return "E";
}

export function mergeAdjacentSkillTiers(counts: Partial<Record<Tier, number>>) {
    const source = BOWLER_HIDDEN_TIERS.map((tier) => ({
        sourceTiers: [tier], count: counts[tier] ?? 0,
    })).filter((group) => group.count > 0);
    const groups: { sourceTiers: Tier[]; count: number }[] = [];
    for (let index = 0; index < source.length; index += 1) {
        const current = source[index];
        const next = source[index + 1];
        if (current.count <= 2 && next && next.sourceTiers[0].charCodeAt(0) === current.sourceTiers[0].charCodeAt(0) + 1) {
            groups.push({ sourceTiers: [current.sourceTiers[0] as Tier, next.sourceTiers[0] as Tier], count: current.count + next.count });
            index += 1;
        } else if (current.count <= 2 && groups.length > 0) {
            const previous = groups[groups.length - 1];
            const previousTier = previous.sourceTiers[previous.sourceTiers.length - 1];
            if (previous.sourceTiers.length === 1 &&
                current.sourceTiers[0].charCodeAt(0) === previousTier.charCodeAt(0) + 1) {
                previous.sourceTiers.push(current.sourceTiers[0] as Tier);
                previous.count += current.count;
            } else {
                groups.push({ sourceTiers: [current.sourceTiers[0] as Tier], count: current.count });
            }
        } else {
            groups.push({ sourceTiers: [current.sourceTiers[0] as Tier], count: current.count });
        }
    }
    return groups.map((group, index) => ({
        displayGroup: `${String.fromCharCode(65 + index)}조`,
        sourceTiers: group.sourceTiers,
        participantCount: group.count,
        minimumRecommendedMet: group.count >= 3,
    }));
}

export function recentAverage(values: readonly number[], limit: number): number | null {
    const selected = values.slice(0, limit);
    return selected.length === 0
        ? null
        : Number((selected.reduce((sum, value) => sum + value, 0) / selected.length).toFixed(1));
}

export async function getBowlerHiddenCompetition(actorUserId: string, teamId: string, eventId: string) {
    const event = await prisma.teamEvent.findFirst({
        where: { id: eventId, teamId, team: { isActive: true, members: { some: { userId: actorUserId } } } },
        select: {
            id: true, eventDate: true, gameType: true, competitionEnabled: true,
            competitionType: true, competitionStatus: true, rankPoints: true,
            team: {
                select: {
                    id: true, ownerId: true, bowlerHiddenEnabled: true,
                    User: { select: { id: true } },
                },
            },
            attendances: {
                where: { status: "ATTENDING", memberId: { not: null } },
                orderBy: [{ createdAt: "asc" }, { id: "asc" }],
                select: {
                    memberId: true, memberDisplayName: true,
                    member: { select: { userId: true } },
                },
            },
            seasonPublications: {
                where: { revokedAt: null }, orderBy: { revision: "desc" }, take: 1,
                select: { resultSnapshot: true, pointTableSnapshot: true, publishedAt: true },
            },
        },
    });
    if (!event) throw new BowlerHiddenError("EVENT_NOT_FOUND", "일정을 찾을 수 없습니다.", 404);
    if (!event.team.bowlerHiddenEnabled) throw new BowlerHiddenError("FEATURE_DISABLED", "Bowler Hidden 기능이 활성화되지 않은 팀입니다.", 404);
    if (!event.competitionEnabled || event.competitionType !== "INDIVIDUAL") {
        throw new BowlerHiddenError("COMPETITION_NOT_AVAILABLE", "개인전 설정이 활성화되지 않았습니다.", 409);
    }
    if (event.competitionStatus === "PUBLISHED") {
        const publication = event.seasonPublications[0];
        if (!publication) throw new BowlerHiddenError("INVALID_RESULT_SNAPSHOT", "발표 결과를 불러올 수 없습니다.", 500);
        try {
            const snapshot = JSON.parse(publication.resultSnapshot) as { version?: unknown; rows?: unknown };
            if (snapshot.version !== 1 || !Array.isArray(snapshot.rows)) throw new Error("invalid snapshot");
            return {
                enabled: true, competitionType: event.competitionType, competitionMode: event.competitionMode, status: "PUBLISHED",
                rankPoints: readSeasonPointTable(publication.pointTableSnapshot), overall: snapshot.rows,
                participantPreview: null, myPreview: null, groupingPolicy: "PUBLISHED_IMMUTABLE_SNAPSHOT",
                publishedAt: publication.publishedAt.toISOString(),
            };
        } catch { throw new BowlerHiddenError("INVALID_RESULT_SNAPSHOT", "발표 결과를 불러올 수 없습니다.", 500); }
    }
    const participants = event.attendances.flatMap((item) => item.memberId && item.member
        ? [{ memberId: item.memberId, userId: item.member.userId, name: item.memberDisplayName }]
        : []);
    const userIds = participants.map((item) => item.userId);
    const start = new Date(`${kstDateKey(event.eventDate)}T00:00:00+09:00`);
    const end = new Date(`${kstDateKey(event.eventDate)}T23:59:59.999+09:00`);
    const [eventScores, personalScores, leagueScores, tournamentScores] = userIds.length === 0
        ? [[], [], [], []] as const
        : await Promise.all([
            prisma.score.findMany({
                where: {
                    teamId, userId: { in: userIds }, score: { gte: 0, lte: 300 },
                    gameDate: { gte: start, lte: end },
                    ...(event.gameType ? { gameType: event.gameType } : {}),
                },
                orderBy: [{ gameDate: "asc" }, { createdAt: "asc" }, { id: "asc" }],
                select: { id: true, userId: true, score: true },
            }),
            prisma.score.findMany({
                where: { userId: { in: userIds }, score: { gte: 0, lte: 300 } },
                orderBy: [{ gameDate: "desc" }, { createdAt: "desc" }, { id: "desc" }],
                select: { id: true, userId: true, score: true, gameDate: true, createdAt: true },
            }),
            prisma.leagueMatchupIndividualScore.findMany({
                where: { userId: { in: userIds } },
                select: { id: true, userId: true, score1: true, score2: true, score3: true, createdAt: true,
                    LeagueMatchup: { select: { round: { select: { date: true } } } } },
            }),
            prisma.tournamentScore.findMany({
                where: { registration: { userId: { in: userIds } } },
                select: { id: true, score: true, gameNumber: true, createdAt: true,
                    registration: { select: { userId: true } }, round: { select: { date: true } } },
            }),
        ]);

    const seasonPointTable = await getSeasonPointPreview(prisma, event);
    const points = new Map(seasonPointTable.map((item) => [item.rank, item.points]));
    const eventByUser = new Map<string, number[]>();
    for (const row of eventScores) {
        if (!row.userId) continue;
        const existing = eventByUser.get(row.userId);
        if (existing) existing.push(row.score);
        else eventByUser.set(row.userId, [row.score]);
    }
    const overall = participants.map((participant, index) => {
        const scores = eventByUser.get(participant.userId) ?? [];
        return { ...participant, order: index, scores, total: scores.reduce((sum, score) => sum + score, 0) };
    }).filter((item) => item.scores.length > 0)
        .sort((left, right) => right.total - left.total || left.order - right.order)
        .map((item, index) => ({
            rank: index + 1, memberId: item.memberId, name: item.name,
            scores: item.scores, gameCount: item.scores.length, total: item.total,
            average: Number((item.total / item.scores.length).toFixed(1)), points: points.get(index + 1) ?? 0,
        }));

    type Recent = { score: number; date: Date; order: number; id: string };
    const recentByUser = new Map<string, Recent[]>();
    const append = (userId: string | null, value: Recent) => {
        if (!userId || value.score < 0 || value.score > 300) return;
        const existing = recentByUser.get(userId); if (existing) existing.push(value); else recentByUser.set(userId, [value]);
    };
    personalScores.forEach((row) => append(row.userId, { score: row.score, date: row.gameDate, order: 0, id: `P:${row.id}` }));
    leagueScores.forEach((row) => [row.score1, row.score2, row.score3].forEach((score, index) => append(row.userId, {
        score, date: row.LeagueMatchup.round.date ?? row.createdAt, order: index + 1, id: `L:${row.id}:${index + 1}`,
    })));
    tournamentScores.forEach((row) => append(row.registration.userId, {
        score: row.score, date: row.round?.date ?? row.createdAt, order: row.gameNumber, id: `T:${row.id}`,
    }));
    const previews = participants.map((participant) => {
        const values = (recentByUser.get(participant.userId) ?? []).sort((left, right) =>
            right.date.getTime() - left.date.getTime() || right.order - left.order || right.id.localeCompare(left.id),
        ).map((item) => item.score);
        return {
            memberId: participant.memberId, name: participant.name, gameSampleCount: values.length,
            recent50Average: recentAverage(values, 50), recent12Average: recentAverage(values, 12),
            expectedScore: null, groupingScore: null, baseTier: null, finalGroup: null,
            ratingStatus: values.length === 0 ? "UNRATED" : "POLICY_PENDING",
        };
    });
    const isManager = event.team.ownerId === actorUserId || event.team.User.some((item) => item.id === actorUserId);
    return {
        enabled: true, competitionType: event.competitionType, competitionMode: event.competitionMode, status: event.competitionStatus,
        rankPoints: seasonPointTable, overall,
        participantPreview: isManager ? previews : null,
        myPreview: previews.find((item) => participants.find((participant) => participant.memberId === item.memberId)?.userId === actorUserId) ?? null,
        groupingPolicy: "PENDING_PRODUCT_DECISION",
    };
}

export async function updateBowlerHiddenCompetition(actorUserId: string, teamId: string, eventId: string, value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new BowlerHiddenError("INVALID_REQUEST", "요청 내용을 확인해주세요.", 400);
    const action = (value as Record<string, unknown>).action;
    if (action === "PUBLISH") return publishIndividual(actorUserId, teamId, eventId);
    if (action === "REOPEN") return reopenIndividual(actorUserId, teamId, eventId);
    throw new BowlerHiddenError("INVALID_ACTION", "개인전 작업을 확인해주세요.", 400);
}

const individualPublishInclude = {
    team: { select: { ownerId: true, bowlerHiddenEnabled: true, User: { select: { id: true } } } },
    attendances: {
        where: { status: "ATTENDING" }, orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }],
        include: { member: { select: { id: true, userId: true, alias: true, user: { select: { name: true } } } } },
    },
} satisfies Prisma.TeamEventInclude;
type IndividualPublishEvent = Prisma.TeamEventGetPayload<{ include: typeof individualPublishInclude }>;

async function publishIndividual(actorUserId: string, teamId: string, eventId: string) {
    const existing = await prisma.teamEvent.findFirst({ where: { id: eventId, teamId }, include: individualPublishInclude });
    requireIndividualManager(existing, actorUserId);
    if (existing!.competitionStatus === "PUBLISHED") return { status: "PUBLISHED", alreadyPublished: true };
    const publishedAt = new Date();
    return prisma.$transaction(async (tx) => {
        const event = await tx.teamEvent.findFirst({ where: { id: eventId, teamId, competitionStatus: { not: "PUBLISHED" } }, include: individualPublishInclude });
        requireIndividualManager(event, actorUserId);
        const participants = event!.attendances.flatMap((item) => item.member ? [item.member] : []);
        if (participants.length === 0) throw new BowlerHiddenError("SCORES_INCOMPLETE", "참석 확정 참가자와 점수를 확인해주세요.", 409);
        const day = kstDateKey(event!.eventDate); const start = new Date(`${day}T00:00:00+09:00`); const end = new Date(`${day}T23:59:59.999+09:00`);
        const scoreRows = await tx.score.findMany({ where: {
            teamId, userId: { in: participants.map((item) => item.userId) }, score: { gte: 0, lte: 300 },
            gameDate: { gte: start, lte: end }, ...(event!.gameType ? { gameType: event!.gameType } : {}),
        }, orderBy: [{ gameDate: "asc" }, { createdAt: "asc" }, { id: "asc" }], select: { userId: true, score: true } });
        const byUser = new Map<string, number[]>();
        for (const row of scoreRows) if (row.userId) { const values = byUser.get(row.userId); if (values) values.push(row.score); else byUser.set(row.userId, [row.score]); }
        if (participants.some((item) => (byUser.get(item.userId)?.length ?? 0) === 0)) throw new BowlerHiddenError("SCORES_INCOMPLETE", "모든 참가자의 점수 입력을 완료해주세요.", 409);
        const pointTable = await getPublicationPointTable(tx, event!);
        const rows = participants.map((member) => {
            const scores = byUser.get(member.userId)!; return {
                memberId: member.id, name: member.alias?.trim() || member.user.name,
                scores, gameCount: scores.length, total: scores.reduce((sum, score) => sum + score, 0),
            };
        }).sort((left, right) => right.total - left.total || left.memberId.localeCompare(right.memberId))
            .map((row, index) => ({ rank: index + 1, ...row, average: Number((row.total / row.gameCount).toFixed(1)), points: seasonPointsForRank(pointTable, index + 1) }));
        const publication = await createSeasonPointPublication(tx, {
            event: event!, pointTable, publishedAt, resultSnapshot: { version: 1, rows },
            awards: rows.map((row) => ({ memberId: row.memberId, memberDisplayName: row.name, finalRank: row.rank, points: row.points })),
        });
        const updated = await tx.teamEvent.updateMany({ where: { id: eventId, competitionStatus: { not: "PUBLISHED" } }, data: { competitionStatus: "PUBLISHED" } });
        if (updated.count !== 1) throw new BowlerHiddenError("PUBLICATION_CONFLICT", "다른 발표 요청이 먼저 처리되었습니다.", 409);
        return { status: "PUBLISHED", seasonId: publication.seasonId, publicationId: publication.publicationId };
    });
}

async function reopenIndividual(actorUserId: string, teamId: string, eventId: string) {
    const event = await prisma.teamEvent.findFirst({ where: { id: eventId, teamId }, include: individualPublishInclude });
    requireIndividualManager(event, actorUserId);
    if (event!.competitionStatus !== "PUBLISHED") throw new BowlerHiddenError("INVALID_COMPETITION_STATE", "발표된 개인전만 다시 열 수 있습니다.", 409);
    await prisma.$transaction(async (tx) => {
        await revokeSeasonPointPublication(tx, eventId, new Date(), event!.competitionMode === "OFFICIAL");
        const updated = await tx.teamEvent.updateMany({ where: { id: eventId, competitionStatus: "PUBLISHED" }, data: {
            competitionStatus: "ATTENDANCE_OPEN", seasonPublicationRevision: { increment: 1 },
        } });
        if (updated.count !== 1) throw new BowlerHiddenError("PUBLICATION_CONFLICT", "개인전 발표 상태가 변경되었습니다.", 409);
    });
    return { status: "ATTENDANCE_OPEN", publicationRevoked: true };
}

function requireIndividualManager(event: IndividualPublishEvent | null, actorUserId: string): asserts event is IndividualPublishEvent {
    if (!event) throw new BowlerHiddenError("EVENT_NOT_FOUND", "일정을 찾을 수 없습니다.", 404);
    if (!event.team.bowlerHiddenEnabled || !event.competitionEnabled || event.competitionType !== "INDIVIDUAL") throw new BowlerHiddenError("COMPETITION_NOT_AVAILABLE", "개인전 설정이 활성화되지 않았습니다.", 409);
    if (event.team.ownerId !== actorUserId && !event.team.User.some((item) => item.id === actorUserId)) throw new BowlerHiddenError("FORBIDDEN", "개인전 관리 권한이 없습니다.", 403);
}

function kstDateKey(value: Date) {
    return new Date(value.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
