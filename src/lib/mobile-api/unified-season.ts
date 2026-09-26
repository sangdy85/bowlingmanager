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

const MAX_ADJUSTMENT_ABS = 100_000;
const MAX_ADJUSTMENT_REASON_LENGTH = 500;

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

export function memberSeasonAwards<T extends {
    memberId: string | null;
    name: string;
    competitionTeamId?: string | null;
}>(rows: readonly T[], pointTable: readonly SeasonRankPoint[]): SeasonAward[] {
    let memberRank = 0;
    return rows.flatMap((row) => {
        if (!row.memberId) return [];
        memberRank += 1;
        return [{
            memberId: row.memberId,
            memberDisplayName: row.name,
            competitionTeamId: row.competitionTeamId ?? null,
            finalRank: memberRank,
            points: seasonPointsForRank(pointTable, memberRank),
        }];
    });
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

export async function createSeasonPointAdjustment(
    actorUserId: string,
    teamId: string,
    seasonId: string,
    input: unknown,
) {
    const parsed = parseSeasonPointAdjustment(input);
    for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
            return await prisma.$transaction(async (tx) => {
                const team = await tx.team.findFirst({
                    where: { id: teamId, isActive: true, members: { some: { userId: actorUserId } } },
                    select: {
                        ownerId: true, bowlerHiddenEnabled: true,
                        User: { where: { id: actorUserId }, select: { id: true } },
                        seasons: { where: { id: seasonId }, take: 1, select: { id: true } },
                        members: {
                            where: { id: parsed.memberId }, take: 1,
                            select: { id: true, alias: true, user: { select: { name: true } } },
                        },
                    },
                });
                if (!team) throw new UnifiedSeasonError("TEAM_NOT_FOUND", "동호회를 찾을 수 없습니다.", 404);
                if (!team.bowlerHiddenEnabled) {
                    throw new UnifiedSeasonError("FEATURE_DISABLED", "Bowler Hidden 기능이 활성화되지 않은 팀입니다.", 404);
                }
                if (team.ownerId !== actorUserId && !team.User.some((manager) => manager.id === actorUserId)) {
                    throw new UnifiedSeasonError("FORBIDDEN", "시즌 포인트를 조정할 권한이 없습니다.", 403);
                }
                if (team.seasons.length !== 1) throw new UnifiedSeasonError("SEASON_NOT_FOUND", "시즌을 찾을 수 없습니다.", 404);
                const member = team.members[0];
                if (!member) throw new UnifiedSeasonError("MEMBER_NOT_FOUND", "조정할 팀 회원을 찾을 수 없습니다.", 404);

                const [automatic, manual, legacy] = await Promise.all([
                    tx.seasonPointEntry.aggregate({
                        where: { seasonId, memberId: member.id, publication: { revokedAt: null } },
                        _sum: { points: true },
                    }),
                    tx.seasonPointAdjustment.aggregate({
                        where: { seasonId, memberId: member.id },
                        _sum: { delta: true },
                    }),
                    tx.seasonLegacyPointEntry.aggregate({
                        where: { seasonId, memberId: member.id, batch: { reversedAt: null } },
                        _sum: { points: true },
                    }),
                ]);
                const currentTotal = (automatic._sum.points ?? 0) + (manual._sum.delta ?? 0) + (legacy._sum.points ?? 0);
                const newTotal = currentTotal + parsed.delta;
                if (newTotal < 0) {
                    throw new UnifiedSeasonError(
                        "NEGATIVE_SEASON_TOTAL",
                        `조정 후 시즌 포인트는 0보다 작을 수 없습니다. 현재 포인트는 ${currentTotal}P입니다.`,
                        409,
                    );
                }
                const adjustment = await tx.seasonPointAdjustment.create({
                    data: {
                        seasonId, memberId: member.id, delta: parsed.delta,
                        reason: parsed.reason, enteredByUserId: actorUserId,
                    },
                    select: { id: true, seasonId: true, memberId: true, delta: true, reason: true, createdAt: true },
                });
                return {
                    adjustment: {
                        ...adjustment,
                        memberName: member.alias || member.user.name,
                        createdAt: adjustment.createdAt.toISOString(),
                    },
                    previousTotal: currentTotal,
                    totalPoints: newTotal,
                };
            }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
                if (attempt === 0) continue;
                throw new UnifiedSeasonError("ADJUSTMENT_CONFLICT", "포인트가 동시에 변경되었습니다. 다시 시도해주세요.", 409);
            }
            throw error;
        }
    }
    throw new UnifiedSeasonError("ADJUSTMENT_CONFLICT", "포인트가 동시에 변경되었습니다. 다시 시도해주세요.", 409);
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
    options: { seasonId?: string | null; year?: number; competitionType?: SeasonCompetitionType | "ALL" } = {},
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
    if (!team.seasonRankingEnabled && !team.bowlerHiddenEnabled) {
        return { enabled: false, season: null, seasons: seasons.map(serializeSeasonSummary), competitionType: "ALL", rankings: [] };
    }
    const season = options.seasonId
        ? seasons.find((item) => item.id === options.seasonId) ?? null
        : options.year
        ? seasons.find((item) => kstYear(item.startDate) <= options.year! && options.year! <= kstYear(item.endDate)) ?? null
        : seasons.find((item) => item.status === "ACTIVE") ?? null;
    if (options.seasonId && !season) throw new UnifiedSeasonError("SEASON_NOT_FOUND", "시즌을 찾을 수 없습니다.", 404);
    const competitionType = options.competitionType ?? "ALL";
    if (competitionType !== "ALL" && !SEASON_COMPETITION_TYPES.includes(competitionType)) {
        throw new UnifiedSeasonError("INVALID_COMPETITION_TYPE", "대회 유형을 확인해주세요.", 400);
    }
    if (!season) return { enabled: true, season: null, seasons: seasons.map(serializeSeasonSummary), competitionType, rankings: [] };
    const [entries, adjustments, legacyEntries] = await Promise.all([
        prisma.seasonPointEntry.findMany({
            where: {
                seasonId: season.id, publication: { revokedAt: null },
                ...(competitionType === "ALL" ? {} : { competitionType }),
            },
            orderBy: [{ competitionDate: "asc" }, { createdAt: "asc" }, { id: "asc" }],
            select: {
                id: true, publicationId: true, eventId: true, memberId: true, memberDisplayName: true,
                competitionType: true, competitionDate: true, competitionTitle: true,
                finalRank: true, points: true, createdAt: true,
            },
        }),
        competitionType === "ALL" ? prisma.seasonPointAdjustment.findMany({
            where: { seasonId: season.id },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            select: { id: true, memberId: true, delta: true, reason: true, createdAt: true },
        }) : Promise.resolve([]),
        prisma.seasonLegacyPointEntry.findMany({
            where: {
                seasonId: season.id,
                batch: { reversedAt: null },
                ...(competitionType === "ALL" ? {} : { competitionType }),
            },
            orderBy: [{ eventDate: "asc" }, { createdAt: "asc" }, { id: "asc" }],
            select: {
                id: true, memberId: true, eventDate: true, competitionType: true,
                placement: true, points: true, note: true, createdAt: true,
                batch: { select: { id: true, mode: true } },
            },
        }),
    ]);
    const rows = new Map<string, {
        id: string; name: string; totalPoints: number; individualPoints: number; teamPoints: number; eventPoints: number; adjustmentPoints: number; legacyPoints: number; openingBalancePoints: number;
        competitionsPlayed: number; individualWins: number; teamWins: number; eventWins: number;
        entries: SeasonLedgerEntry[];
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
            sourceType: "AUTOMATIC", reason: null, createdAt: entry.createdAt.toISOString(),
        });
    }
    for (const adjustment of adjustments) {
        const row = rows.get(adjustment.memberId);
        if (!row) continue;
        row.totalPoints += adjustment.delta;
        row.adjustmentPoints += adjustment.delta;
        row.entries.push({
            id: adjustment.id, eventId: null, competitionType: "MANUAL_ADJUSTMENT",
            competitionDate: adjustment.createdAt.toISOString(), competitionTitle: adjustment.reason,
            finalRank: null, points: adjustment.delta, month: kstMonth(adjustment.createdAt),
            sourceType: "MANUAL_ADJUSTMENT", reason: adjustment.reason,
            createdAt: adjustment.createdAt.toISOString(),
        });
    }
    for (const entry of legacyEntries) {
        const row = rows.get(entry.memberId);
        if (!row) continue;
        const opening = entry.batch.mode === "OPENING_BALANCE";
        row.totalPoints += entry.points;
        row.legacyPoints += entry.points;
        if (opening) {
            row.openingBalancePoints += entry.points;
        } else {
            if (entry.competitionType === "INDIVIDUAL") { row.individualPoints += entry.points; if (entry.placement === 1) row.individualWins += 1; }
            if (entry.competitionType === "TEAM") { row.teamPoints += entry.points; if (entry.placement === 1) row.teamWins += 1; }
            if (entry.competitionType === "EVENT") { row.eventPoints += entry.points; if (entry.placement === 1) row.eventWins += 1; }
            row.competitionsPlayed += 1;
        }
        row.entries.push({
            id: entry.id, eventId: null,
            competitionType: entry.competitionType ?? "LEGACY_OPENING_BALANCE",
            competitionDate: entry.eventDate?.toISOString() ?? null,
            competitionTitle: opening ? "기존 누적 포인트" : entry.note || "기존 시즌 경기",
            finalRank: entry.placement, points: entry.points,
            month: entry.eventDate ? kstMonth(entry.eventDate) : null,
            sourceType: opening ? "LEGACY_OPENING_BALANCE" : "LEGACY_IMPORT",
            reason: entry.note, createdAt: entry.createdAt.toISOString(), batchId: entry.batch.id,
        });
    }
    for (const row of rows.values()) {
        row.entries.sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
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
        id, name, totalPoints: 0, individualPoints: 0, teamPoints: 0, eventPoints: 0, adjustmentPoints: 0, legacyPoints: 0, openingBalancePoints: 0,
        competitionsPlayed: 0, individualWins: 0, teamWins: 0, eventWins: 0,
        entries: [] as SeasonLedgerEntry[],
    };
}

type SeasonLedgerEntry = {
    id: string;
    eventId: string | null;
    competitionType: string;
    competitionDate: string | null;
    competitionTitle: string;
    finalRank: number | null;
    points: number;
    month: number | null;
    sourceType: "AUTOMATIC" | "MANUAL_ADJUSTMENT" | "LEGACY_IMPORT" | "LEGACY_OPENING_BALANCE";
    reason: string | null;
    createdAt: string;
    batchId?: string;
};

function parseSeasonPointAdjustment(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new UnifiedSeasonError("INVALID_ADJUSTMENT", "포인트 조정 내용을 확인해주세요.", 400);
    }
    const body = value as Record<string, unknown>;
    const memberId = typeof body.memberId === "string" ? body.memberId.trim() : "";
    const delta = body.delta;
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (!memberId || !Number.isSafeInteger(delta) || delta === 0 || Math.abs(delta as number) > MAX_ADJUSTMENT_ABS) {
        throw new UnifiedSeasonError("INVALID_ADJUSTMENT", "회원과 0이 아닌 증감 포인트를 확인해주세요.", 400);
    }
    if (!reason || reason.length > MAX_ADJUSTMENT_REASON_LENGTH) {
        throw new UnifiedSeasonError("INVALID_ADJUSTMENT_REASON", `사유는 1~${MAX_ADJUSTMENT_REASON_LENGTH}자로 입력해주세요.`, 400);
    }
    return { memberId, delta: delta as number, reason };
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
function kstYear(value: Date) { return new Date(value.getTime() + 9 * 60 * 60 * 1000).getUTCFullYear(); }

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
