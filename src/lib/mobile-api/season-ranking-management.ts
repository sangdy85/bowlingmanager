import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import {
    PostImageStorageError,
    readStoredPostImage,
    removeStoredPostImages,
    removeStoredPostImagesStrict,
    storePostImages,
    storedPostImagePath,
    type PostImageUpload,
} from "@/lib/post-image-storage";

export const SEASON_RANKING_MODES = ["DATA", "IMAGE"] as const;
export type SeasonRankingMode = typeof SEASON_RANKING_MODES[number];

export class SeasonRankingManagementError extends Error {
    constructor(public readonly code: string, message: string, public readonly status: number) {
        super(message);
        this.name = "SeasonRankingManagementError";
    }
}

type SeasonAccess = Awaited<ReturnType<typeof loadSeasonAccess>>;

async function loadSeasonAccess(actorUserId: string, teamId: string, seasonId: string) {
    const team = await prisma.team.findFirst({
        where: { id: teamId, isActive: true, members: { some: { userId: actorUserId } } },
        select: {
            id: true,
            ownerId: true,
            bowlerHiddenEnabled: true,
            User: { where: { id: actorUserId }, select: { id: true } },
            members: {
                orderBy: [{ joinedAt: "asc" }, { id: "asc" }],
                select: { id: true, alias: true, user: { select: { name: true } } },
            },
            seasons: {
                where: { id: seasonId },
                take: 1,
                select: { id: true, name: true, startDate: true, endDate: true, rankingMode: true },
            },
        },
    });
    if (!team) throw new SeasonRankingManagementError("TEAM_NOT_FOUND", "동호회를 찾을 수 없습니다.", 404);
    if (!team.bowlerHiddenEnabled) {
        throw new SeasonRankingManagementError("FEATURE_DISABLED", "Bowler Hidden 기능이 활성화되지 않은 팀입니다.", 404);
    }
    const season = team.seasons[0];
    if (!season) throw new SeasonRankingManagementError("SEASON_NOT_FOUND", "시즌을 찾을 수 없습니다.", 404);
    return {
        team,
        season,
        canManage: team.ownerId === actorUserId || team.User.some((manager) => manager.id === actorUserId),
    };
}

function requireManager(access: NonNullable<SeasonAccess>) {
    if (!access.canManage) {
        throw new SeasonRankingManagementError("FORBIDDEN", "시즌 순위를 관리할 권한이 없습니다.", 403);
    }
}

function requireMode(access: NonNullable<SeasonAccess>, mode: SeasonRankingMode) {
    if (access.season.rankingMode !== mode) {
        throw new SeasonRankingManagementError(
            "SEASON_RANKING_MODE_MISMATCH",
            mode === "DATA"
                ? "데이터 관리 방식의 시즌에서만 사용할 수 있습니다."
                : "이미지 관리 방식의 시즌에서만 사용할 수 있습니다.",
            409,
        );
    }
}

export async function assertSeasonDataMode(seasonId: string, db: Pick<Prisma.TransactionClient, "teamSeason"> = prisma) {
    const season = await db.teamSeason.findUnique({ where: { id: seasonId }, select: { rankingMode: true } });
    if (!season) throw new SeasonRankingManagementError("SEASON_NOT_FOUND", "시즌을 찾을 수 없습니다.", 404);
    if (season.rankingMode !== "DATA") {
        throw new SeasonRankingManagementError(
            "SEASON_RANKING_MODE_MISMATCH",
            "이미지 관리 시즌에는 데이터 순위 기능을 사용할 수 없습니다.",
            409,
        );
    }
}

export async function updateSeasonRankingMode(
    actorUserId: string,
    teamId: string,
    seasonId: string,
    value: unknown,
) {
    const access = await loadSeasonAccess(actorUserId, teamId, seasonId);
    requireManager(access);
    const raw = value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>).rankingMode : null;
    const confirmed = value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>).confirmed === true : false;
    if (raw !== "DATA" && raw !== "IMAGE") {
        throw new SeasonRankingManagementError("INVALID_RANKING_MODE", "순위 관리 방식을 확인해주세요.", 400);
    }
    const [dataCount, imageCount] = await Promise.all([
        Promise.all([
            prisma.seasonPointEntry.count({ where: { seasonId } }),
            prisma.seasonPointAdjustment.count({ where: { seasonId } }),
            prisma.seasonLegacyPointEntry.count({ where: { seasonId } }),
            prisma.seasonManualCompetition.count({ where: { seasonId } }),
        ]).then((counts) => counts.reduce((sum, count) => sum + count, 0)),
        prisma.seasonRankingImage.count({ where: { seasonId } }),
    ]);
    const requiresConfirmation = access.season.rankingMode !== raw
        && ((raw === "IMAGE" && dataCount > 0) || (raw === "DATA" && imageCount > 0));
    if (requiresConfirmation && !confirmed) {
        throw new SeasonRankingManagementError(
            "MODE_CHANGE_CONFIRMATION_REQUIRED",
            raw === "IMAGE"
                ? "기존 순위 데이터가 있습니다. 이미지 방식 변경을 확인해주세요."
                : "기존 순위표 이미지가 있습니다. 데이터 방식 변경을 확인해주세요.",
            409,
        );
    }
    const season = access.season.rankingMode === raw
        ? access.season
        : await prisma.teamSeason.update({
            where: { id: seasonId }, data: { rankingMode: raw },
            select: { id: true, name: true, startDate: true, endDate: true, rankingMode: true },
        });
    return {
        seasonId: season.id,
        rankingMode: season.rankingMode,
        hiddenDataPreserved: dataCount > 0,
        hiddenImagesPreserved: imageCount > 0,
    };
}

type ManualResult = { memberId: string; finalRank: number | null; points: number };
type ManualCompetitionInput = {
    name: string;
    eventDate: Date;
    competitionType: "INDIVIDUAL" | "TEAM" | "EVENT";
    results: ManualResult[];
};

type StructuredCompetitionInput = ManualCompetitionInput & { id: string | null };
type StructuredTargetInput = { memberId: string; targetTotal: number };

function parseDate(value: unknown) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const date = new Date(`${value}T00:00:00+09:00`);
    return Number.isNaN(date.getTime()) ? null : date;
}

function parseManualCompetition(value: unknown): ManualCompetitionInput {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new SeasonRankingManagementError("INVALID_MANUAL_COMPETITION", "수동 대회 내용을 확인해주세요.", 400);
    }
    const body = value as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const eventDate = parseDate(body.eventDate);
    const competitionType = body.competitionType;
    if (!name || name.length > 100 || !eventDate ||
        (competitionType !== "INDIVIDUAL" && competitionType !== "TEAM" && competitionType !== "EVENT") ||
        !Array.isArray(body.results) || body.results.length < 1 || body.results.length > 500) {
        throw new SeasonRankingManagementError("INVALID_MANUAL_COMPETITION", "수동 대회 내용을 확인해주세요.", 400);
    }
    const seen = new Set<string>();
    const results = body.results.map((raw): ManualResult => {
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
            throw new SeasonRankingManagementError("INVALID_MANUAL_RESULT", "회원별 순위와 포인트를 확인해주세요.", 400);
        }
        const item = raw as Record<string, unknown>;
        const memberId = typeof item.memberId === "string" ? item.memberId.trim() : "";
        const finalRank = item.finalRank == null ? null : item.finalRank;
        const points = item.points;
        if (!memberId || seen.has(memberId) ||
            (finalRank !== null && (!Number.isSafeInteger(finalRank) || Number(finalRank) < 1 || Number(finalRank) > 1000)) ||
            !Number.isSafeInteger(points) || Number(points) < 0 || Number(points) > 100_000) {
            throw new SeasonRankingManagementError("INVALID_MANUAL_RESULT", "회원별 순위와 포인트를 확인해주세요.", 400);
        }
        seen.add(memberId);
        return { memberId, finalRank: finalRank === null ? null : Number(finalRank), points: Number(points) };
    });
    return { name, eventDate, competitionType, results };
}

function parseStructuredImport(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new SeasonRankingManagementError("INVALID_STRUCTURED_IMPORT", "기존 시즌 입력 내용을 확인해주세요.", 400);
    }
    const body = value as Record<string, unknown>;
    if (!Array.isArray(body.competitions) || body.competitions.length > 100 ||
        !Array.isArray(body.targetTotals) || body.targetTotals.length > 500) {
        throw new SeasonRankingManagementError("INVALID_STRUCTURED_IMPORT", "기존 시즌 입력 내용을 확인해주세요.", 400);
    }
    const competitionIds = new Set<string>();
    const competitionKeys = new Set<string>();
    const competitions = body.competitions.map((raw): StructuredCompetitionInput => {
        const parsed = parseManualCompetition(raw);
        const rawId = raw && typeof raw === "object" && !Array.isArray(raw)
            ? (raw as Record<string, unknown>).id : null;
        const id = rawId == null ? null : typeof rawId === "string" && rawId.trim() ? rawId.trim() : null;
        if (rawId != null && id === null) {
            throw new SeasonRankingManagementError("INVALID_STRUCTURED_IMPORT", "수동 대회 식별자를 확인해주세요.", 400);
        }
        if (id && competitionIds.has(id)) {
            throw new SeasonRankingManagementError("DUPLICATE_MANUAL_COMPETITION", "같은 수동 대회를 중복 저장할 수 없습니다.", 400);
        }
        if (id) competitionIds.add(id);
        const key = `${parsed.eventDate.getTime()}|${parsed.competitionType}|${parsed.name}`;
        if (competitionKeys.has(key)) {
            throw new SeasonRankingManagementError("MANUAL_COMPETITION_DUPLICATE", "같은 날짜와 유형의 수동 대회가 중복되었습니다.", 409);
        }
        competitionKeys.add(key);
        return { id, ...parsed };
    });
    const targetMembers = new Set<string>();
    const targetTotals = body.targetTotals.map((raw): StructuredTargetInput => {
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
            throw new SeasonRankingManagementError("INVALID_STRUCTURED_TARGET", "회원별 총점 보정을 확인해주세요.", 400);
        }
        const item = raw as Record<string, unknown>;
        const memberId = typeof item.memberId === "string" ? item.memberId.trim() : "";
        const targetTotal = item.targetTotal;
        if (!memberId || targetMembers.has(memberId) || !Number.isSafeInteger(targetTotal) ||
            Number(targetTotal) < 0 || Number(targetTotal) > 1_000_000) {
            throw new SeasonRankingManagementError("INVALID_STRUCTURED_TARGET", "회원별 총점 보정을 확인해주세요.", 400);
        }
        targetMembers.add(memberId);
        return { memberId, targetTotal: Number(targetTotal) };
    });
    if (competitions.length === 0 && targetTotals.length === 0) {
        throw new SeasonRankingManagementError("EMPTY_STRUCTURED_IMPORT", "저장할 대회 또는 총점 보정이 없습니다.", 400);
    }
    return { competitions, targetTotals };
}

function memberMap(access: NonNullable<SeasonAccess>) {
    return new Map(access.team.members.map((member) => [member.id, member]));
}

function validateManualScope(access: NonNullable<SeasonAccess>, parsed: ManualCompetitionInput) {
    if (parsed.eventDate < access.season.startDate || parsed.eventDate > access.season.endDate) {
        throw new SeasonRankingManagementError("COMPETITION_OUTSIDE_SEASON", "대회 날짜가 시즌 기간에 포함되지 않습니다.", 400);
    }
    const members = memberMap(access);
    if (parsed.results.some((result) => !members.has(result.memberId))) {
        throw new SeasonRankingManagementError("INVALID_MEMBER", "다른 동호회 회원은 등록할 수 없습니다.", 400);
    }
    return members;
}

async function assertNoLegacyOverlap(
    db: Pick<Prisma.TransactionClient, "seasonLegacyPointEntry">,
    seasonId: string,
    competitions: readonly ManualCompetitionInput[],
) {
    const legacyRows = await db.seasonLegacyPointEntry.findMany({
        where: { seasonId, eventDate: { not: null }, batch: { reversedAt: null } },
        select: { memberId: true, eventDate: true, competitionType: true },
    });
    const legacyKeys = new Set(legacyRows.map((row) =>
        `${row.memberId}|${row.eventDate?.getTime()}|${row.competitionType ?? ""}`,
    ));
    const overlaps = competitions.some((competition) => competition.results.some((result) =>
        legacyKeys.has(`${result.memberId}|${competition.eventDate.getTime()}|${competition.competitionType}`),
    ));
    if (overlaps) {
        throw new SeasonRankingManagementError(
            "LEGACY_MANUAL_DUPLICATE",
            "같은 회원·날짜·유형의 Legacy 기록과 수동 대회를 중복 등록할 수 없습니다.",
            409,
        );
    }
}

export async function listSeasonManualCompetitions(actorUserId: string, teamId: string, seasonId: string) {
    const access = await loadSeasonAccess(actorUserId, teamId, seasonId);
    requireMode(access, "DATA");
    const rows = await prisma.seasonManualCompetition.findMany({
        where: { seasonId }, orderBy: [{ eventDate: "asc" }, { createdAt: "asc" }, { id: "asc" }],
        select: {
            id: true, name: true, eventDate: true, competitionType: true, createdAt: true, updatedAt: true,
            results: { orderBy: [{ finalRank: "asc" }, { memberDisplayName: "asc" }], select: {
                memberId: true, memberDisplayName: true, finalRank: true, points: true,
            } },
        },
    });
    return { competitions: rows.map(serializeManualCompetition) };
}

export async function createSeasonManualCompetition(
    actorUserId: string,
    teamId: string,
    seasonId: string,
    value: unknown,
) {
    const parsed = parseManualCompetition(value);
    const access = await loadSeasonAccess(actorUserId, teamId, seasonId);
    requireManager(access); requireMode(access, "DATA");
    const members = validateManualScope(access, parsed);
    try {
        await assertNoLegacyOverlap(prisma, seasonId, [parsed]);
        const created = await prisma.seasonManualCompetition.create({
        data: {
            seasonId, name: parsed.name, eventDate: parsed.eventDate,
            competitionType: parsed.competitionType, createdByUserId: actorUserId,
            results: { create: parsed.results.map((result) => ({
                ...result,
                memberDisplayName: members.get(result.memberId)!.alias || members.get(result.memberId)!.user.name,
            })) },
        },
        select: {
            id: true, name: true, eventDate: true, competitionType: true, createdAt: true, updatedAt: true,
            results: { select: { memberId: true, memberDisplayName: true, finalRank: true, points: true } },
        },
    });
        return { competition: serializeManualCompetition(created) };
    } catch (error) {
        throw mapManualCompetitionWriteError(error);
    }
}

export async function updateSeasonManualCompetition(
    actorUserId: string,
    teamId: string,
    seasonId: string,
    competitionId: string,
    value: unknown,
) {
    const parsed = parseManualCompetition(value);
    const access = await loadSeasonAccess(actorUserId, teamId, seasonId);
    requireManager(access); requireMode(access, "DATA");
    const members = validateManualScope(access, parsed);
    try {
        return await prisma.$transaction(async (tx) => {
        await assertNoLegacyOverlap(tx, seasonId, [parsed]);
        const existing = await tx.seasonManualCompetition.findFirst({
            where: { id: competitionId, seasonId },
            select: {
                id: true, name: true, eventDate: true, competitionType: true,
                results: { select: { memberId: true, memberDisplayName: true, finalRank: true, points: true } },
            },
        });
        if (!existing) throw new SeasonRankingManagementError("MANUAL_COMPETITION_NOT_FOUND", "수동 대회를 찾을 수 없습니다.", 404);
        await tx.seasonManualCompetitionRevision.create({
            data: { competitionId, revisedByUserId: actorUserId, snapshot: JSON.stringify(serializeManualCompetition(existing)) },
        });
        await tx.seasonManualCompetitionResult.deleteMany({ where: { competitionId } });
        const updated = await tx.seasonManualCompetition.update({
            where: { id: competitionId },
            data: {
                name: parsed.name, eventDate: parsed.eventDate, competitionType: parsed.competitionType,
                results: { create: parsed.results.map((result) => ({
                    ...result,
                    memberDisplayName: members.get(result.memberId)!.alias || members.get(result.memberId)!.user.name,
                })) },
            },
            select: {
                id: true, name: true, eventDate: true, competitionType: true, createdAt: true, updatedAt: true,
                results: { select: { memberId: true, memberDisplayName: true, finalRank: true, points: true } },
            },
        });
        return { competition: serializeManualCompetition(updated) };
        });
    } catch (error) {
        throw mapManualCompetitionWriteError(error);
    }
}

export async function saveStructuredSeasonRanking(
    actorUserId: string,
    teamId: string,
    seasonId: string,
    value: unknown,
) {
    const parsed = parseStructuredImport(value);
    const access = await loadSeasonAccess(actorUserId, teamId, seasonId);
    requireManager(access); requireMode(access, "DATA");
    const members = memberMap(access);
    for (const competition of parsed.competitions) validateManualScope(access, competition);
    if (parsed.targetTotals.some((target) => !members.has(target.memberId))) {
        throw new SeasonRankingManagementError("INVALID_MEMBER", "다른 동호회 회원은 등록할 수 없습니다.", 400);
    }
    try {
        return await prisma.$transaction(async (tx) => {
            await assertNoLegacyOverlap(tx, seasonId, parsed.competitions);
            for (const competition of parsed.competitions) {
                const results = competition.results.map((result) => ({
                    ...result,
                    memberDisplayName: members.get(result.memberId)!.alias || members.get(result.memberId)!.user.name,
                }));
                if (competition.id === null) {
                    await tx.seasonManualCompetition.create({
                        data: {
                            seasonId, name: competition.name, eventDate: competition.eventDate,
                            competitionType: competition.competitionType, createdByUserId: actorUserId,
                            results: { create: results },
                        },
                    });
                    continue;
                }
                const existing = await tx.seasonManualCompetition.findFirst({
                    where: { id: competition.id, seasonId },
                    select: {
                        id: true, name: true, eventDate: true, competitionType: true,
                        results: { select: { memberId: true, memberDisplayName: true, finalRank: true, points: true } },
                    },
                });
                if (!existing) {
                    throw new SeasonRankingManagementError("MANUAL_COMPETITION_NOT_FOUND", "수동 대회를 찾을 수 없습니다.", 404);
                }
                await tx.seasonManualCompetitionRevision.create({
                    data: {
                        competitionId: competition.id,
                        revisedByUserId: actorUserId,
                        snapshot: JSON.stringify(serializeManualCompetition(existing)),
                    },
                });
                await tx.seasonManualCompetitionResult.deleteMany({ where: { competitionId: competition.id } });
                await tx.seasonManualCompetition.update({
                    where: { id: competition.id },
                    data: {
                        name: competition.name, eventDate: competition.eventDate,
                        competitionType: competition.competitionType,
                        results: { create: results },
                    },
                });
            }

            const [automatic, legacy, manual, adjustments] = await Promise.all([
                tx.seasonPointEntry.groupBy({
                    by: ["memberId"], where: { seasonId, publication: { revokedAt: null } }, _sum: { points: true },
                }),
                tx.seasonLegacyPointEntry.groupBy({
                    by: ["memberId"], where: { seasonId, batch: { reversedAt: null } }, _sum: { points: true },
                }),
                tx.seasonManualCompetitionResult.groupBy({
                    by: ["memberId"], where: { competition: { seasonId } }, _sum: { points: true },
                }),
                tx.seasonPointAdjustment.groupBy({
                    by: ["memberId"], where: { seasonId }, _sum: { delta: true },
                }),
            ]);
            const totals = new Map<string, number>();
            for (const rows of [automatic, legacy, manual]) {
                for (const row of rows) totals.set(row.memberId, (totals.get(row.memberId) ?? 0) + (row._sum.points ?? 0));
            }
            for (const row of adjustments) totals.set(row.memberId, (totals.get(row.memberId) ?? 0) + (row._sum.delta ?? 0));
            let adjustmentCount = 0;
            for (const target of parsed.targetTotals) {
                const delta = target.targetTotal - (totals.get(target.memberId) ?? 0);
                if (delta === 0) continue;
                await tx.seasonPointAdjustment.create({
                    data: {
                        seasonId, memberId: target.memberId, delta,
                        reason: "기존 시즌 구조화 입력 총점 보정", enteredByUserId: actorUserId,
                    },
                });
                totals.set(target.memberId, target.targetTotal);
                adjustmentCount += 1;
            }
            return {
                competitionCount: parsed.competitions.length,
                adjustmentCount,
                totals: parsed.targetTotals.map((target) => ({
                    memberId: target.memberId, totalPoints: totals.get(target.memberId) ?? 0,
                })),
            };
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
        throw mapManualCompetitionWriteError(error);
    }
}

function mapManualCompetitionWriteError(error: unknown) {
    if (error instanceof SeasonRankingManagementError) return error;
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return new SeasonRankingManagementError(
            "MANUAL_COMPETITION_DUPLICATE",
            "같은 날짜와 유형의 수동 대회가 이미 등록되어 있습니다.",
            409,
        );
    }
    return error;
}

function serializeManualCompetition(row: {
    id: string; name: string; eventDate: Date; competitionType: string;
    createdAt?: Date; updatedAt?: Date;
    results: { memberId: string; memberDisplayName: string; finalRank: number | null; points: number }[];
}) {
    return {
        ...row,
        eventDate: row.eventDate.toISOString(),
        createdAt: row.createdAt?.toISOString(),
        updatedAt: row.updatedAt?.toISOString(),
        source: "MANUAL" as const,
    };
}

export async function listSeasonRankingImages(actorUserId: string, teamId: string, seasonId: string) {
    const access = await loadSeasonAccess(actorUserId, teamId, seasonId);
    requireMode(access, "IMAGE");
    const images = await prisma.seasonRankingImage.findMany({
        where: { seasonId }, orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
        select: { id: true, size: true, displayOrder: true, createdAt: true },
    });
    return { images: images.map((image) => ({ ...image, createdAt: image.createdAt.toISOString() })) };
}

export async function addSeasonRankingImage(
    actorUserId: string,
    teamId: string,
    seasonId: string,
    file: PostImageUpload,
) {
    const access = await loadSeasonAccess(actorUserId, teamId, seasonId);
    requireManager(access); requireMode(access, "IMAGE");
    const count = await prisma.seasonRankingImage.count({ where: { seasonId } });
    if (count >= 10) throw new SeasonRankingManagementError("TOO_MANY_IMAGES", "순위표 이미지는 최대 10장까지 등록할 수 있습니다.", 400);
    let stored: Awaited<ReturnType<typeof storePostImages>>;
    try { stored = await storePostImages([file]); } catch (error) { throw mapStorage(error); }
    try {
        const image = await prisma.seasonRankingImage.create({
            data: { seasonId, url: stored[0].url, size: stored[0].size, displayOrder: count, createdByUserId: actorUserId },
            select: { id: true, size: true, displayOrder: true, createdAt: true },
        });
        return { image: { ...image, createdAt: image.createdAt.toISOString() } };
    } catch (error) {
        await removeStoredPostImages(stored);
        throw error;
    }
}

export async function getSeasonRankingImage(actorUserId: string, teamId: string, seasonId: string, imageId: string) {
    const access = await loadSeasonAccess(actorUserId, teamId, seasonId);
    requireMode(access, "IMAGE");
    const image = await prisma.seasonRankingImage.findFirst({ where: { id: imageId, seasonId }, select: { url: true } });
    if (!image) throw new SeasonRankingManagementError("RANKING_IMAGE_NOT_FOUND", "순위표 이미지를 찾을 수 없습니다.", 404);
    try { return await readStoredPostImage(image.url); } catch (error) { throw mapStorage(error); }
}

export async function deleteSeasonRankingImage(actorUserId: string, teamId: string, seasonId: string, imageId: string) {
    const access = await loadSeasonAccess(actorUserId, teamId, seasonId);
    requireManager(access); requireMode(access, "IMAGE");
    const image = await prisma.seasonRankingImage.findFirst({ where: { id: imageId, seasonId }, select: { id: true, url: true } });
    if (!image) throw new SeasonRankingManagementError("RANKING_IMAGE_NOT_FOUND", "순위표 이미지를 찾을 수 없습니다.", 404);
    await prisma.seasonRankingImage.delete({ where: { id: imageId } });
    const path = storedPostImagePath(image.url);
    if (path) {
        try { await removeStoredPostImagesStrict([{ path }]); } catch (error) { throw mapStorage(error); }
    }
    return { deletedImageId: imageId };
}

function mapStorage(error: unknown): SeasonRankingManagementError {
    if (error instanceof PostImageStorageError) {
        return new SeasonRankingManagementError(error.code, error.message, error.status);
    }
    return new SeasonRankingManagementError("IMAGE_PROCESSING_FAILED", "순위표 이미지를 처리하지 못했습니다.", 500);
}
