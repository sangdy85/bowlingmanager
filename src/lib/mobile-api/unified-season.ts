import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

export const SEASON_STATUSES = ["DRAFT", "ACTIVE", "COMPLETED"] as const;
export const SEASON_COMPETITION_TYPES = ["INDIVIDUAL", "TEAM", "EVENT"] as const;
export type SeasonStatus = typeof SEASON_STATUSES[number];
export type SeasonCompetitionType = typeof SEASON_COMPETITION_TYPES[number];
export type SeasonRankPoint = { rank: number; points: number };
export type SeasonAward = {
    memberId: string;
    memberDisplayName: string;
    competitionTeamId?: string | null;
    finalRank: number | null;
    points: number;
};

export class UnifiedSeasonError extends Error {
    constructor(public readonly code: string, message: string, public readonly status: number) { super(message); }
}

type SeasonDb = Pick<Prisma.TransactionClient, "teamSeason" | "teamEvent" | "seasonPointPublication" | "seasonPointEntry">;

type PublicationEvent = { teamId: string; eventDate: Date; seasonId: string | null; competitionType: string | null; competitionMode: string | null };

export async function getPublicationPointTable(db: SeasonDb, event: PublicationEvent) {
    if (event.competitionMode === "MINI") return [];
    if (event.competitionMode !== "OFFICIAL") {
        throw new UnifiedSeasonError("COMPETITION_MODE_REQUIRED", "대회 적용 모드를 확인해주세요.", 409);
    }
    return (await resolvePublicationSeason(db, event)).pointTable;
}

export function readSeasonPointTable(value: string): SeasonRankPoint[] {
    try {
        const parsed: unknown = JSON.parse(value);
        if (Array.isArray(parsed)) {
            return validatePointTable(parsed.map((points, index) => ({ rank: index + 1, points })));
        }
        if (!parsed || typeof parsed !== "object") return [];
        return validatePointTable(Object.entries(parsed as Record<string, unknown>).map(([rank, points]) => ({ rank: Number(rank), points })));
    } catch { return []; }
}

export function serializeSeasonPointTable(value: unknown): string {
    const points = validatePointTable(value);
    return JSON.stringify(Object.fromEntries(points.map((item) => [String(item.rank), item.points])));
}

export function seasonPointsForRank(points: readonly SeasonRankPoint[], rank: number | null) {
    if (rank === null) return 0;
    return points.find((item) => item.rank === rank)?.points ?? 0;
}

export async function getSeasonPointPreview(
    db: Pick<SeasonDb, "teamSeason">,
    event: { teamId: string; eventDate: Date; seasonId: string | null; competitionType: string | null; competitionMode?: string | null },
) {
    if (event.competitionMode !== undefined && event.competitionMode !== "OFFICIAL") return [];
    if (!SEASON_COMPETITION_TYPES.includes(event.competitionType as SeasonCompetitionType)) return [];
    const season = event.seasonId
        ? await db.teamSeason.findFirst({ where: { id: event.seasonId, teamId: event.teamId } })
        : await db.teamSeason.findFirst({
            where: { teamId: event.teamId, status: "ACTIVE", startDate: { lte: event.eventDate }, endDate: { gte: event.eventDate } },
            orderBy: [{ startDate: "desc" }, { id: "asc" }],
        });
    if (!season || season.status !== "ACTIVE" || event.eventDate < season.startDate || event.eventDate > season.endDate) return [];
    const config = event.competitionType === "INDIVIDUAL" ? season.individualPointsConfig
        : event.competitionType === "TEAM" ? season.teamPointsConfig : season.eventPointsConfig;
    return readSeasonPointTable(config);
}

export async function resolvePublicationSeason(
    db: SeasonDb,
    event: { id: string; teamId: string; eventDate: Date; seasonId: string | null; competitionType: string | null },
) {
    if (!SEASON_COMPETITION_TYPES.includes(event.competitionType as SeasonCompetitionType)) {
        throw new UnifiedSeasonError("INVALID_COMPETITION_TYPE", "시즌에 반영할 대회 유형을 확인해주세요.", 409);
    }
    const season = event.seasonId
        ? await db.teamSeason.findFirst({ where: { id: event.seasonId, teamId: event.teamId } })
        : await db.teamSeason.findFirst({
            where: { teamId: event.teamId, status: "ACTIVE", startDate: { lte: event.eventDate }, endDate: { gte: event.eventDate } },
            orderBy: [{ startDate: "desc" }, { id: "asc" }],
        });
    if (!season) throw new UnifiedSeasonError("SEASON_REQUIRED", "대회 날짜에 활성화된 시즌이 없습니다.", 409);
    if (season.status !== "ACTIVE") throw new UnifiedSeasonError("SEASON_NOT_ACTIVE", "활성 시즌의 대회만 발표할 수 있습니다.", 409);
    if (event.eventDate < season.startDate || event.eventDate > season.endDate) {
        throw new UnifiedSeasonError("EVENT_OUTSIDE_SEASON", "대회 날짜가 시즌 기간에 포함되지 않습니다.", 409);
    }
    if (!event.seasonId) await db.teamEvent.update({ where: { id: event.id }, data: { seasonId: season.id } });
    const config = event.competitionType === "INDIVIDUAL" ? season.individualPointsConfig
        : event.competitionType === "TEAM" ? season.teamPointsConfig : season.eventPointsConfig;
    return { season, competitionType: event.competitionType as SeasonCompetitionType, pointTable: readSeasonPointTable(config) };
}

export async function createSeasonPointPublication(
    db: SeasonDb,
    input: {
        event: { id: string; teamId: string; title: string; eventDate: Date; seasonId: string | null; competitionType: string | null; competitionMode: string | null; seasonPublicationRevision: number };
        pointTable: readonly SeasonRankPoint[];
        awards: readonly SeasonAward[];
        resultSnapshot: unknown;
        publishedAt: Date;
    },
) {
    if (input.event.competitionMode === "MINI") {
        return { publicationId: null, seasonId: input.event.seasonId, alreadyPublished: false, pointsAwarded: false };
    }
    if (input.event.competitionMode !== "OFFICIAL") {
        throw new UnifiedSeasonError("COMPETITION_MODE_REQUIRED", "대회 적용 모드를 확인해주세요.", 409);
    }
    const { season, competitionType } = await resolvePublicationSeason(db, input.event);
    const memberIds = new Set<string>();
    for (const award of input.awards) {
        if (!award.memberId || memberIds.has(award.memberId) || !award.memberDisplayName ||
            !Number.isSafeInteger(award.points) || award.points < 0 ||
            (award.finalRank !== null && (!Number.isSafeInteger(award.finalRank) || award.finalRank < 1))) {
            throw new UnifiedSeasonError("INVALID_SEASON_AWARDS", "시즌 포인트 지급 결과를 확인할 수 없습니다.", 500);
        }
        memberIds.add(award.memberId);
    }
    const sourceKey = `COMPETITION:${input.event.id}`;
    const existing = await db.seasonPointPublication.findFirst({
        where: { seasonId: season.id, sourceKey, revokedAt: null }, select: { id: true },
    });
    if (existing) return { publicationId: existing.id, seasonId: season.id, alreadyPublished: true, pointsAwarded: true };
    const publication = await db.seasonPointPublication.create({ data: {
        seasonId: season.id, eventId: input.event.id, sourceKey,
        revision: input.event.seasonPublicationRevision, competitionType,
        competitionDate: input.event.eventDate, competitionTitle: input.event.title,
        pointTableSnapshot: serializeSeasonPointTable([...input.pointTable]),
        resultSnapshot: JSON.stringify(input.resultSnapshot), publishedAt: input.publishedAt,
    }, select: { id: true } });
    if (input.awards.length > 0) {
        await db.seasonPointEntry.createMany({ data: input.awards.map((award) => ({
            publicationId: publication.id, seasonId: season.id, eventId: input.event.id,
            memberId: award.memberId, memberDisplayName: award.memberDisplayName,
            competitionTeamId: award.competitionTeamId ?? null, competitionType,
            competitionDate: input.event.eventDate, competitionTitle: input.event.title,
            finalRank: award.finalRank, points: award.points,
        })) });
    }
    return { publicationId: publication.id, seasonId: season.id, alreadyPublished: false, pointsAwarded: true };
}

export async function revokeSeasonPointPublication(db: SeasonDb, eventId: string, revokedAt: Date, required = true) {
    const result = await db.seasonPointPublication.updateMany({ where: { eventId, revokedAt: null }, data: { revokedAt } });
    if (required && result.count !== 1) throw new UnifiedSeasonError("PUBLICATION_NOT_FOUND", "취소할 시즌 포인트 발표를 찾을 수 없습니다.", 409);
}

export function jointCompetitionRanks<T extends { totalPoints: number }>(rows: readonly T[]) {
    let previousPoints: number | null = null;
    let previousRank = 0;
    return rows.map((row, index) => {
        const rank = previousPoints === row.totalPoints ? previousRank : index + 1;
        previousPoints = row.totalPoints; previousRank = rank;
        return { rank, ...row };
    });
}

export async function getUnifiedSeasonRanking(
    actorUserId: string,
    teamId: string,
    options: { seasonId?: string | null; competitionType?: SeasonCompetitionType | "ALL" } = {},
) {
    const team = await prisma.team.findFirst({
        where: { id: teamId, isActive: true, members: { some: { userId: actorUserId } } },
        select: {
            id: true, bowlerHiddenEnabled: true, seasonRankingEnabled: true,
            members: { orderBy: [{ joinedAt: "asc" }, { id: "asc" }], select: { id: true, alias: true, user: { select: { name: true } } } },
        },
    });
    if (!team) throw new UnifiedSeasonError("TEAM_NOT_FOUND", "동호회를 찾을 수 없습니다.", 404);
    if (!team.bowlerHiddenEnabled) throw new UnifiedSeasonError("FEATURE_DISABLED", "Bowler Hidden 기능이 활성화되지 않은 팀입니다.", 404);
    const seasons = await prisma.teamSeason.findMany({ where: { teamId }, orderBy: [{ startDate: "desc" }, { id: "asc" }] });
    if (!team.seasonRankingEnabled) return { enabled: false, season: null, seasons: seasons.map(serializeSeasonSummary), competitionType: "ALL", rankings: [] };
    const season = options.seasonId
        ? seasons.find((item) => item.id === options.seasonId) ?? null
        : seasons.find((item) => item.status === "ACTIVE") ?? null;
    if (options.seasonId && !season) throw new UnifiedSeasonError("SEASON_NOT_FOUND", "시즌을 찾을 수 없습니다.", 404);
    const competitionType = options.competitionType ?? "ALL";
    if (competitionType !== "ALL" && !SEASON_COMPETITION_TYPES.includes(competitionType)) {
        throw new UnifiedSeasonError("INVALID_COMPETITION_TYPE", "대회 유형을 확인해주세요.", 400);
    }
    if (!season) return { enabled: true, season: null, seasons: seasons.map(serializeSeasonSummary), competitionType, rankings: [] };
    const entries = await prisma.seasonPointEntry.findMany({
        where: {
            seasonId: season.id, publication: { revokedAt: null },
            ...(competitionType === "ALL" ? {} : { competitionType }),
        },
        orderBy: [{ competitionDate: "asc" }, { createdAt: "asc" }, { id: "asc" }],
        select: {
            id: true, publicationId: true, eventId: true, memberId: true, memberDisplayName: true,
            competitionType: true, competitionDate: true, competitionTitle: true,
            finalRank: true, points: true,
        },
    });
    const rows = new Map<string, {
        id: string; name: string; totalPoints: number; individualPoints: number; teamPoints: number; eventPoints: number;
        competitionsPlayed: number; individualWins: number; teamWins: number; eventWins: number;
        entries: { id: string; eventId: string | null; competitionType: string; competitionDate: string; competitionTitle: string; finalRank: number | null; points: number; month: number }[];
    }>();
    for (const member of team.members) rows.set(member.id, emptyRankingRow(member.id, member.alias || member.user.name));
    for (const entry of entries) {
        const row = rows.get(entry.memberId) ?? emptyRankingRow(entry.memberId, entry.memberDisplayName);
        rows.set(entry.memberId, row);
        row.totalPoints += entry.points;
        if (entry.competitionType === "INDIVIDUAL") { row.individualPoints += entry.points; if (entry.finalRank === 1) row.individualWins += 1; }
        if (entry.competitionType === "TEAM") { row.teamPoints += entry.points; if (entry.finalRank === 1) row.teamWins += 1; }
        if (entry.competitionType === "EVENT") { row.eventPoints += entry.points; if (entry.finalRank === 1) row.eventWins += 1; }
        row.competitionsPlayed += 1;
        row.entries.push({
            id: entry.id, eventId: entry.eventId, competitionType: entry.competitionType,
            competitionDate: entry.competitionDate.toISOString(), competitionTitle: entry.competitionTitle,
            finalRank: entry.finalRank, points: entry.points, month: kstMonth(entry.competitionDate),
        });
    }
    const ranked = jointCompetitionRanks([...rows.values()].sort((left, right) =>
        right.totalPoints - left.totalPoints || left.name.localeCompare(right.name, "ko") || left.id.localeCompare(right.id),
    ));
    return {
        enabled: true, season: serializeSeasonSummary(season), seasons: seasons.map(serializeSeasonSummary),
        competitionType, rankings: ranked.map((row) => ({
            ...row,
            points: row.totalPoints,
            attended: row.competitionsPlayed,
            games: 0, average: 0,
            gold: row.individualWins + row.teamWins + row.eventWins,
            silver: 0, bronze: 0,
            monthlyHistory: Array.from({ length: 12 }, (_, index) => row.entries.filter((entry) => entry.month === index + 1)),
        })),
    };
}

export async function getUnifiedSeasonMemberDetail(
    actorUserId: string,
    teamId: string,
    memberId: string,
    options: { seasonId?: string | null; competitionType?: SeasonCompetitionType | "ALL" } = {},
) {
    const ranking = await getUnifiedSeasonRanking(actorUserId, teamId, options);
    const member = ranking.rankings.find((row) => row.id === memberId);
    if (!member) throw new UnifiedSeasonError("MEMBER_NOT_FOUND", "시즌 회원 기록을 찾을 수 없습니다.", 404);
    return { season: ranking.season, competitionType: ranking.competitionType, member };
}

function emptyRankingRow(id: string, name: string) {
    return {
        id, name, totalPoints: 0, individualPoints: 0, teamPoints: 0, eventPoints: 0,
        competitionsPlayed: 0, individualWins: 0, teamWins: 0, eventWins: 0,
        entries: [] as { id: string; eventId: string | null; competitionType: string; competitionDate: string; competitionTitle: string; finalRank: number | null; points: number; month: number }[],
    };
}

export function serializeSeasonSummary(season: {
    id: string; name: string; startDate: Date; endDate: Date; enabled: boolean; status: string;
    individualPointsConfig: string; teamPointsConfig: string; eventPointsConfig: string;
    scoringMode?: string; pointsConfig?: string;
}) {
    const individual = readSeasonPointTable(season.individualPointsConfig);
    return {
        id: season.id, name: season.name,
        startDate: season.startDate.toISOString().slice(0, 10),
        endDate: season.endDate.toISOString().slice(0, 10),
        enabled: season.enabled, status: season.status,
        scoringMode: season.scoringMode === "PODIUM" ? "PODIUM" : "FULL_RANK",
        points: individual.map((item) => item.points),
        pointTables: {
            individual,
            team: readSeasonPointTable(season.teamPointsConfig),
            event: readSeasonPointTable(season.eventPointsConfig),
        },
    };
}

function kstMonth(value: Date) { return new Date(value.getTime() + 9 * 60 * 60 * 1000).getUTCMonth() + 1; }

function validatePointTable(value: unknown): SeasonRankPoint[] {
    if (!Array.isArray(value) || value.length > 100) throw new UnifiedSeasonError("INVALID_POINT_TABLE", "시즌 포인트표를 확인해주세요.", 400);
    const ranks = new Set<number>();
    return value.map((raw) => {
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new UnifiedSeasonError("INVALID_POINT_TABLE", "시즌 포인트표를 확인해주세요.", 400);
        const { rank, points } = raw as Record<string, unknown>;
        if (!Number.isSafeInteger(rank) || (rank as number) < 1 || !Number.isSafeInteger(points) || (points as number) < 0 || (points as number) > 1000 || ranks.has(rank as number)) {
            throw new UnifiedSeasonError("INVALID_POINT_TABLE", "시즌 순위와 포인트는 중복 없는 0 이상의 정수여야 합니다.", 400);
        }
        ranks.add(rank as number); return { rank: rank as number, points: points as number };
    }).sort((left, right) => left.rank - right.rank);
}
