import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getMobileSeasonRanking } from "@/lib/mobile-api/club-expansion";
import { serializeSeasonPointTable, serializeSeasonSummary } from "@/lib/mobile-api/unified-season";
import { seasonLifecycleStatus, seasonYearRange } from "@/lib/mobile-api/season-lifecycle";

export class SeasonHistoryError extends Error {
    constructor(public readonly code: string, message: string, public readonly status: number) { super(message); }
}

function dateKey(value: unknown, endOfDay: boolean) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const parsed = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}+09:00`);
    if (Number.isNaN(parsed.getTime())) return null;
    const kst = new Date(parsed.getTime() + 9 * 60 * 60 * 1000);
    const roundTrip = [
        kst.getUTCFullYear(),
        String(kst.getUTCMonth() + 1).padStart(2, "0"),
        String(kst.getUTCDate()).padStart(2, "0"),
    ].join("-");
    return roundTrip === value ? parsed : null;
}

async function loadTeamAccess(actorUserId: string, teamId: string) {
    const team = await prisma.team.findFirst({
        where: { id: teamId, isActive: true, members: { some: { userId: actorUserId } } },
        select: {
            id: true, ownerId: true, bowlerHiddenEnabled: true, seasonRankingEnabled: true,
            User: { select: { id: true } },
        },
    });
    if (!team) throw new SeasonHistoryError("TEAM_NOT_FOUND", "동호회를 찾을 수 없습니다.", 404);
    return { team, canManage: team.ownerId === actorUserId || team.User.some((user) => user.id === actorUserId) };
}

function requireManager(access: Awaited<ReturnType<typeof loadTeamAccess>>) {
    if (!access.canManage) throw new SeasonHistoryError("FORBIDDEN", "시즌 관리 권한이 없습니다.", 403);
}

const finalRankingSelect = {
    id: true, revision: true, rankingMode: true, finalizedAt: true,
    finalizedBy: { select: { id: true, name: true } },
    entries: { orderBy: [{ rank: "asc" as const }, { id: "asc" as const }], select: {
        id: true, memberId: true, displayName: true, rank: true, totalPoints: true,
    } },
};

function serializeFinalRanking(value: {
    id: string; revision: number; rankingMode: string; finalizedAt: Date;
    finalizedBy: { id: string; name: string };
    entries: { id: string; memberId: string | null; displayName: string; rank: number; totalPoints: number }[];
}) {
    return {
        id: value.id, revision: value.revision,
        rankingMode: value.rankingMode === "IMAGE" ? "IMAGE" : "DATA",
        finalizedAt: value.finalizedAt.toISOString(), finalizedBy: value.finalizedBy,
        entries: value.entries,
    };
}

export async function listTeamSeasons(actorUserId: string, teamId: string, now = new Date(), year?: number) {
    const access = await loadTeamAccess(actorUserId, teamId);
    const range = year === undefined ? null : seasonYearRange(year);
    const seasons = await prisma.teamSeason.findMany({
        where: {
            teamId,
            ...(range ? { startDate: { lte: range.end }, endDate: { gte: range.start } } : {}),
        },
        orderBy: [{ startDate: "desc" }, { id: "asc" }],
        include: { finalRankings: { orderBy: [{ revision: "desc" }], take: 1, select: finalRankingSelect } },
    });
    const serialized = seasons.map((season) => ({
        ...serializeSeasonSummary(season),
        lifecycleStatus: seasonLifecycleStatus(season, now),
        finalRanking: season.finalRankings[0] ? serializeFinalRanking(season.finalRankings[0]) : null,
    }));
    return {
        enabled: access.team.seasonRankingEnabled || access.team.bowlerHiddenEnabled,
        bowlerHiddenEnabled: access.team.bowlerHiddenEnabled,
        canManage: access.canManage,
        currentSeason: serialized.find((season) => season.lifecycleStatus === "ACTIVE") ?? null,
        seasons: serialized,
    };
}

export async function createTeamSeason(actorUserId: string, teamId: string, input: unknown, now = new Date()) {
    const access = await loadTeamAccess(actorUserId, teamId); requireManager(access);
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw new SeasonHistoryError("INVALID_SEASON", "시즌 정보를 확인해주세요.", 400);
    }
    const body = input as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const startDate = dateKey(body.startDate, false);
    const endDate = dateKey(body.endDate, true);
    const rankingMode = body.rankingMode === "IMAGE" && access.team.bowlerHiddenEnabled ? "IMAGE" : "DATA";
    if (!name || name.length > 80 || !startDate || !endDate || startDate >= endDate ||
        (body.rankingMode !== undefined && body.rankingMode !== "DATA" && body.rankingMode !== "IMAGE")) {
        throw new SeasonHistoryError("INVALID_SEASON", "시즌 이름과 시작일·종료일을 확인해주세요.", 400);
    }
    if (body.rankingMode === "IMAGE" && !access.team.bowlerHiddenEnabled) {
        throw new SeasonHistoryError("FEATURE_DISABLED", "Bowler Hidden 팀에서만 이미지 순위 방식을 사용할 수 있습니다.", 403);
    }
    const defaultTable = serializeSeasonPointTable([{ rank: 1, points: 5 }, { rank: 2, points: 3 }, { rank: 3, points: 1 }]);
    const status = now < startDate ? "DRAFT" : now > endDate ? "COMPLETED" : "ACTIVE";
    let season;
    try {
        season = await prisma.$transaction(async (tx) => {
            const overlap = await tx.teamSeason.findFirst({
                where: { teamId, startDate: { lte: endDate }, endDate: { gte: startDate } }, select: { id: true, name: true },
            });
            if (overlap) throw new SeasonHistoryError("SEASON_DATE_OVERLAP", `${overlap.name}과 시즌 기간이 겹칩니다.`, 409);
            const latest = await tx.teamSeason.findFirst({ where: { teamId }, orderBy: [{ startDate: "desc" }, { id: "asc" }] });
            return tx.teamSeason.create({ data: {
                teamId, name, startDate, endDate, enabled: status !== "COMPLETED", status,
                scoringMode: access.team.bowlerHiddenEnabled ? "FULL_RANK" : latest?.scoringMode ?? "PODIUM",
                pointsConfig: latest?.pointsConfig ?? "[5,3,1]",
                individualPointsConfig: latest?.individualPointsConfig || defaultTable,
                teamPointsConfig: latest?.teamPointsConfig || defaultTable,
                eventPointsConfig: latest?.eventPointsConfig || defaultTable,
                rankingMode,
            } });
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
        if (error instanceof SeasonHistoryError) throw error;
        if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2002" || error.code === "P2034")) {
            throw new SeasonHistoryError("SEASON_CREATE_CONFLICT", "시즌이 동시에 변경되었습니다. 다시 시도해주세요.", 409);
        }
        throw error;
    }
    return { ...serializeSeasonSummary(season), lifecycleStatus: seasonLifecycleStatus(season, now), finalRanking: null };
}

export async function getTeamSeason(actorUserId: string, teamId: string, seasonId: string, now = new Date()) {
    const access = await loadTeamAccess(actorUserId, teamId);
    const season = await prisma.teamSeason.findFirst({
        where: { id: seasonId, teamId },
        include: { finalRankings: { orderBy: [{ revision: "desc" }], take: 1, select: finalRankingSelect } },
    });
    if (!season) throw new SeasonHistoryError("SEASON_NOT_FOUND", "시즌을 찾을 수 없습니다.", 404);
    return {
        canManage: access.canManage,
        season: { ...serializeSeasonSummary(season), lifecycleStatus: seasonLifecycleStatus(season, now) },
        finalRanking: season.finalRankings[0] ? serializeFinalRanking(season.finalRankings[0]) : null,
    };
}

function orderedRankingRows(rows: { id: string; name: string; points: number }[], input: unknown) {
    if (input === undefined || input === null) return rows;
    if (!Array.isArray(input) || input.some((value) => typeof value !== "string")) {
        throw new SeasonHistoryError("INVALID_FINAL_RANKING", "최종 순위 순서를 확인해주세요.", 400);
    }
    const ids = input as string[];
    const expected = new Map(rows.map((row) => [row.id, row]));
    if (ids.length !== rows.length || new Set(ids).size !== rows.length || ids.some((id) => !expected.has(id))) {
        throw new SeasonHistoryError("INVALID_FINAL_RANKING", "모든 참가자를 중복 없이 최종 순위에 포함해주세요.", 400);
    }
    return ids.map((id) => expected.get(id)!);
}

export async function finalizeTeamSeason(actorUserId: string, teamId: string, seasonId: string, input: unknown) {
    const access = await loadTeamAccess(actorUserId, teamId); requireManager(access);
    const season = await prisma.teamSeason.findFirst({ where: { id: seasonId, teamId } });
    if (!season) throw new SeasonHistoryError("SEASON_NOT_FOUND", "시즌을 찾을 수 없습니다.", 404);
    const body = input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : {};
    let entries: { memberId: string; displayName: string; totalPoints: number }[] = [];
    if (season.rankingMode === "IMAGE") {
        if (body.orderedMemberIds !== undefined) throw new SeasonHistoryError("SEASON_RANKING_MODE_MISMATCH", "이미지 시즌은 포인트 최종 순위를 만들지 않습니다.", 409);
        const imageCount = await prisma.seasonRankingImage.count({ where: { seasonId } });
        if (imageCount < 1) throw new SeasonHistoryError("RANKING_IMAGE_REQUIRED", "최종 순위표 이미지를 먼저 등록해주세요.", 409);
    } else {
        const ranking = await getMobileSeasonRanking(actorUserId, teamId, { seasonId, competitionType: "ALL" });
        const ordered = orderedRankingRows(ranking.rankings, body.orderedMemberIds);
        entries = ordered.map((row) => ({ memberId: row.id, displayName: row.name, totalPoints: row.points }));
    }
    try {
        const created = await prisma.$transaction(async (tx) => {
            const latest = await tx.seasonFinalRanking.findFirst({ where: { seasonId }, orderBy: [{ revision: "desc" }] });
            const finalRanking = await tx.seasonFinalRanking.create({ data: {
                seasonId, revision: (latest?.revision ?? 0) + 1, rankingMode: season.rankingMode,
                finalizedByUserId: actorUserId,
                entries: { create: entries.map((entry, index) => ({ ...entry, rank: index + 1 })) },
            }, select: finalRankingSelect });
            await tx.teamSeason.update({ where: { id: seasonId }, data: { status: "COMPLETED", enabled: false } });
            return finalRanking;
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
        return serializeFinalRanking(created);
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            throw new SeasonHistoryError("FINALIZATION_CONFLICT", "최종 순위가 동시에 변경되었습니다. 다시 시도해주세요.", 409);
        }
        throw error;
    }
}

export async function getLatestSeasonFinalRanking(actorUserId: string, teamId: string, seasonId: string) {
    await loadTeamAccess(actorUserId, teamId);
    const season = await prisma.teamSeason.findFirst({ where: { id: seasonId, teamId }, select: { id: true } });
    if (!season) throw new SeasonHistoryError("SEASON_NOT_FOUND", "시즌을 찾을 수 없습니다.", 404);
    const value = await prisma.seasonFinalRanking.findFirst({
        where: { seasonId }, orderBy: [{ revision: "desc" }], select: finalRankingSelect,
    });
    return value ? serializeFinalRanking(value) : null;
}
