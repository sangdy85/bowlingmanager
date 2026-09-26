import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { SEASON_COMPETITION_TYPES, UnifiedSeasonError } from "@/lib/mobile-api/unified-season";

const MAX_ROWS = 1_000;
const MAX_POINTS = 100_000;
const MAX_NOTE = 500;
type ImportMode = "DETAILED" | "OPENING_BALANCE";
type ParsedRow = {
    memberId: string;
    eventDate: Date | null;
    competitionType: "INDIVIDUAL" | "TEAM" | "EVENT" | null;
    placement: number | null;
    points: number;
    note: string | null;
};

export async function previewSeasonLegacyImport(
    actorUserId: string,
    teamId: string,
    seasonId: string,
    input: unknown,
) {
    const parsed = parseLegacyImport(input);
    const context = await getImportContext(prisma, actorUserId, teamId, seasonId, parsed.rows);
    validateRowsAgainstSeason(parsed.rows, context.season);
    await assertNoMixedLegacySources(prisma, seasonId, parsed.mode, parsed.rows.map((row) => row.memberId));
    const importHash = hashImport(parsed.mode, parsed.rows);
    const duplicate = await prisma.seasonLegacyImportBatch.findUnique({
        where: { seasonId_importHash: { seasonId, importHash } }, select: { id: true, reversedAt: true },
    });
    if (duplicate) {
        throw new UnifiedSeasonError("IMPORT_ALREADY_EXISTS", "이미 등록된 데이터입니다.", 409);
    }
    const totals = await currentMemberTotals(prisma, seasonId, parsed.rows.map((row) => row.memberId));
    const additions = sumByMember(parsed.rows);
    return {
        mode: parsed.mode,
        importHash,
        summary: {
            totalRows: parsed.rows.length,
            matchedRows: parsed.rows.length,
            needsConfirmation: 0,
            errors: 0,
            totalPoints: parsed.rows.reduce((sum, row) => sum + row.points, 0),
        },
        rows: parsed.rows.map((row, index) => ({
            index,
            memberId: row.memberId,
            memberName: context.members.get(row.memberId)!,
            eventDate: row.eventDate?.toISOString() ?? null,
            competitionType: row.competitionType,
            placement: row.placement,
            points: row.points,
            note: row.note,
        })),
        memberChanges: [...additions.entries()].map(([memberId, points]) => ({
            memberId,
            memberName: context.members.get(memberId)!,
            previousPoints: totals.get(memberId) ?? 0,
            importedPoints: points,
            totalPoints: (totals.get(memberId) ?? 0) + points,
        })),
    };
}

export async function createSeasonLegacyImport(
    actorUserId: string,
    teamId: string,
    seasonId: string,
    input: unknown,
) {
    const body = input && typeof input === "object" && !Array.isArray(input)
        ? input as Record<string, unknown> : {};
    const expectedHash = typeof body.importHash === "string" ? body.importHash.trim() : "";
    const parsed = parseLegacyImport(body);
    const importHash = hashImport(parsed.mode, parsed.rows);
    if (!expectedHash || expectedHash !== importHash) {
        throw new UnifiedSeasonError("IMPORT_PREVIEW_REQUIRED", "미리보기 후 변경되지 않은 데이터를 등록해주세요.", 409);
    }
    try {
        return await prisma.$transaction(async (tx) => {
            const context = await getImportContext(tx, actorUserId, teamId, seasonId, parsed.rows);
            validateRowsAgainstSeason(parsed.rows, context.season);
            await assertNoMixedLegacySources(tx, seasonId, parsed.mode, parsed.rows.map((row) => row.memberId));
            const duplicate = await tx.seasonLegacyImportBatch.findUnique({
                where: { seasonId_importHash: { seasonId, importHash } }, select: { id: true },
            });
            if (duplicate) throw new UnifiedSeasonError("IMPORT_ALREADY_EXISTS", "이미 등록된 데이터입니다.", 409);
            const batch = await tx.seasonLegacyImportBatch.create({
                data: {
                    seasonId, mode: parsed.mode, importHash, note: parsed.note,
                    enteredByUserId: actorUserId,
                    entries: { create: parsed.rows.map((row) => ({ seasonId, ...row })) },
                },
                select: { id: true, mode: true, createdAt: true, _count: { select: { entries: true } } },
            });
            return {
                batch: { id: batch.id, mode: batch.mode, createdAt: batch.createdAt.toISOString() },
                rowCount: batch._count.entries,
                totalPoints: parsed.rows.reduce((sum, row) => sum + row.points, 0),
            };
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            throw new UnifiedSeasonError("IMPORT_ALREADY_EXISTS", "이미 등록된 데이터입니다.", 409);
        }
        throw error;
    }
}

export async function listSeasonLegacyImports(actorUserId: string, teamId: string, seasonId: string) {
    await getImportContext(prisma, actorUserId, teamId, seasonId, []);
    const batches = await prisma.seasonLegacyImportBatch.findMany({
        where: { seasonId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
            id: true, mode: true, note: true, createdAt: true, reversedAt: true, reversalReason: true,
            enteredBy: { select: { name: true } }, reversedBy: { select: { name: true } },
            _count: { select: { entries: true } }, entries: { select: { points: true } },
        },
    });
    return { batches: batches.map((batch) => ({
        id: batch.id, mode: batch.mode, note: batch.note,
        rowCount: batch._count.entries,
        totalPoints: batch.entries.reduce((sum, entry) => sum + entry.points, 0),
        enteredByName: batch.enteredBy.name, createdAt: batch.createdAt.toISOString(),
        reversedAt: batch.reversedAt?.toISOString() ?? null,
        reversedByName: batch.reversedBy?.name ?? null,
        reversalReason: batch.reversalReason,
    })) };
}

export async function reverseSeasonLegacyImport(
    actorUserId: string,
    teamId: string,
    seasonId: string,
    batchId: string,
    input: unknown,
) {
    const reason = parseReason(input, "취소 사유를 1~500자로 입력해주세요.");
    return prisma.$transaction(async (tx) => {
        await getImportContext(tx, actorUserId, teamId, seasonId, []);
        const updated = await tx.seasonLegacyImportBatch.updateMany({
            where: { id: batchId, seasonId, reversedAt: null },
            data: { reversedAt: new Date(), reversedByUserId: actorUserId, reversalReason: reason },
        });
        if (updated.count !== 1) {
            throw new UnifiedSeasonError("IMPORT_NOT_FOUND", "취소할 활성 이관 내역을 찾을 수 없습니다.", 404);
        }
        return { batchId, reversed: true };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

function parseLegacyImport(value: unknown): { mode: ImportMode; rows: ParsedRow[]; note: string | null } {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new UnifiedSeasonError("INVALID_IMPORT", "기존 시즌 데이터를 확인해주세요.", 400);
    }
    const body = value as Record<string, unknown>;
    const mode = body.mode;
    const rawRows = body.rows;
    const note = optionalText(body.note);
    if ((mode !== "DETAILED" && mode !== "OPENING_BALANCE") || !Array.isArray(rawRows) || rawRows.length < 1 || rawRows.length > MAX_ROWS) {
        throw new UnifiedSeasonError("INVALID_IMPORT", `이관 방식과 1~${MAX_ROWS}개의 행을 확인해주세요.`, 400);
    }
    const rows = rawRows.map((raw) => parseRow(mode, raw));
    if (mode === "OPENING_BALANCE") {
        const members = new Set(rows.map((row) => row.memberId));
        if (members.size !== rows.length) {
            throw new UnifiedSeasonError("DUPLICATE_IMPORT_MEMBER", "현재 포인트 입력에는 회원을 한 번만 포함해주세요.", 400);
        }
    }
    return { mode, rows, note };
}

function parseRow(mode: ImportMode, value: unknown): ParsedRow {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new UnifiedSeasonError("INVALID_IMPORT_ROW", "이관 행을 확인해주세요.", 400);
    }
    const row = value as Record<string, unknown>;
    const memberId = typeof row.memberId === "string" ? row.memberId.trim() : "";
    const points = row.points;
    const note = optionalText(row.note);
    if (!memberId || !Number.isSafeInteger(points) || (points as number) <= 0 || (points as number) > MAX_POINTS) {
        throw new UnifiedSeasonError("INVALID_IMPORT_ROW", "회원과 1 이상의 포인트를 확인해주세요.", 400);
    }
    if (mode === "OPENING_BALANCE") {
        return { memberId, points: points as number, eventDate: null, competitionType: null, placement: null, note };
    }
    const eventDate = parseDate(row.eventDate ?? row.month);
    const competitionType = row.competitionType;
    const placement = row.placement;
    if (!eventDate || !SEASON_COMPETITION_TYPES.includes(competitionType as never) ||
        !Number.isSafeInteger(placement) || (placement as number) < 1) {
        throw new UnifiedSeasonError("INVALID_IMPORT_ROW", "날짜, 경기 종류와 순위를 확인해주세요.", 400);
    }
    return {
        memberId, eventDate, competitionType: competitionType as ParsedRow["competitionType"],
        placement: placement as number, points: points as number, note,
    };
}

async function getImportContext(
    db: Prisma.TransactionClient | typeof prisma,
    actorUserId: string,
    teamId: string,
    seasonId: string,
    rows: readonly ParsedRow[],
) {
    const memberIds = [...new Set(rows.map((row) => row.memberId))];
    const team = await db.team.findFirst({
        where: { id: teamId, isActive: true, members: { some: { userId: actorUserId } } },
        select: {
            ownerId: true, bowlerHiddenEnabled: true,
            User: { where: { id: actorUserId }, select: { id: true } },
            seasons: { where: { id: seasonId }, take: 1, select: { id: true, startDate: true, endDate: true } },
            members: {
                where: memberIds.length ? { id: { in: memberIds } } : undefined,
                select: { id: true, alias: true, user: { select: { name: true } } },
            },
        },
    });
    if (!team) throw new UnifiedSeasonError("TEAM_NOT_FOUND", "동호회를 찾을 수 없습니다.", 404);
    if (!team.bowlerHiddenEnabled) throw new UnifiedSeasonError("FEATURE_DISABLED", "Bowler Hidden 기능이 활성화되지 않은 팀입니다.", 404);
    if (team.ownerId !== actorUserId && !team.User.some((manager) => manager.id === actorUserId)) {
        throw new UnifiedSeasonError("FORBIDDEN", "기존 시즌 데이터를 관리할 권한이 없습니다.", 403);
    }
    const season = team.seasons[0];
    if (!season) throw new UnifiedSeasonError("SEASON_NOT_FOUND", "시즌을 찾을 수 없습니다.", 404);
    const members = new Map(team.members.map((member) => [member.id, member.alias || member.user.name]));
    if (memberIds.some((id) => !members.has(id))) {
        throw new UnifiedSeasonError("MEMBER_NOT_FOUND", "이관 대상은 현재 동호회 회원이어야 합니다.", 404);
    }
    return { season, members };
}

async function assertNoMixedLegacySources(
    db: Prisma.TransactionClient | typeof prisma,
    seasonId: string,
    mode: ImportMode,
    memberIds: string[],
) {
    const conflicting = await db.seasonLegacyPointEntry.findFirst({
        where: {
            seasonId, memberId: { in: [...new Set(memberIds)] },
            batch: {
                reversedAt: null,
                ...(mode === "DETAILED" ? { mode: "OPENING_BALANCE" } : {}),
            },
        },
        select: { id: true },
    });
    if (conflicting) {
        throw new UnifiedSeasonError(
            "LEGACY_SOURCE_CONFLICT",
            "같은 회원에게 상세 이관과 현재 포인트를 함께 적용할 수 없습니다. 기존 batch를 취소한 뒤 다시 시도해주세요.",
            409,
        );
    }
}

async function currentMemberTotals(db: Prisma.TransactionClient | typeof prisma, seasonId: string, memberIds: string[]) {
    const ids = [...new Set(memberIds)];
    const [automatic, adjustments, legacy] = await Promise.all([
        db.seasonPointEntry.groupBy({
            by: ["memberId"], where: { seasonId, memberId: { in: ids }, publication: { revokedAt: null } }, _sum: { points: true },
        }),
        db.seasonPointAdjustment.groupBy({ by: ["memberId"], where: { seasonId, memberId: { in: ids } }, _sum: { delta: true } }),
        db.seasonLegacyPointEntry.groupBy({
            by: ["memberId"], where: { seasonId, memberId: { in: ids }, batch: { reversedAt: null } }, _sum: { points: true },
        }),
    ]);
    const totals = new Map(ids.map((id) => [id, 0]));
    for (const row of automatic) totals.set(row.memberId, (totals.get(row.memberId) ?? 0) + (row._sum.points ?? 0));
    for (const row of adjustments) totals.set(row.memberId, (totals.get(row.memberId) ?? 0) + (row._sum.delta ?? 0));
    for (const row of legacy) totals.set(row.memberId, (totals.get(row.memberId) ?? 0) + (row._sum.points ?? 0));
    return totals;
}

function validateRowsAgainstSeason(rows: readonly ParsedRow[], season: { startDate: Date; endDate: Date }) {
    if (rows.some((row) => row.eventDate && (row.eventDate < season.startDate || row.eventDate > season.endDate))) {
        throw new UnifiedSeasonError("IMPORT_OUTSIDE_SEASON", "이관 날짜는 시즌 기간 안이어야 합니다.", 400);
    }
}

function hashImport(mode: ImportMode, rows: readonly ParsedRow[]) {
    const canonical = rows.map((row) => ({
        memberId: row.memberId, eventDate: row.eventDate?.toISOString() ?? null,
        competitionType: row.competitionType, placement: row.placement, points: row.points, note: row.note,
    })).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
    return createHash("sha256").update(JSON.stringify({ mode, rows: canonical })).digest("hex");
}

function sumByMember(rows: readonly ParsedRow[]) {
    const result = new Map<string, number>();
    for (const row of rows) result.set(row.memberId, (result.get(row.memberId) ?? 0) + row.points);
    return result;
}

function optionalText(value: unknown) {
    if (value === undefined || value === null || value === "") return null;
    if (typeof value !== "string") throw new UnifiedSeasonError("INVALID_IMPORT", "메모를 확인해주세요.", 400);
    const text = value.trim();
    if (!text || text.length > MAX_NOTE) throw new UnifiedSeasonError("INVALID_IMPORT", "메모는 1~500자로 입력해주세요.", 400);
    return text;
}

function parseReason(value: unknown, message: string) {
    const reason = value && typeof value === "object" && !Array.isArray(value) && typeof (value as Record<string, unknown>).reason === "string"
        ? ((value as Record<string, unknown>).reason as string).trim() : "";
    if (!reason || reason.length > MAX_NOTE) throw new UnifiedSeasonError("INVALID_REVERSAL_REASON", message, 400);
    return reason;
}

function parseDate(value: unknown) {
    if (typeof value !== "string") return null;
    const raw = /^\d{4}-\d{2}$/.test(value) ? `${value}-01` : value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
    const date = new Date(`${raw}T00:00:00+09:00`);
    if (Number.isNaN(date.getTime())) return null;
    const [year, month, day] = raw.split("-").map(Number);
    const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
    return kst.getUTCFullYear() === year && kst.getUTCMonth() + 1 === month && kst.getUTCDate() === day
        ? date : null;
}
