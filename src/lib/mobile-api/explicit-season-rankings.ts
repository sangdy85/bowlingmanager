import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { seasonLifecycleStatus } from "@/lib/mobile-api/season-lifecycle";

export type HistoricalRankingEntryInput = {
    rank: number;
    participantType: "MEMBER" | "MANUAL";
    memberId: string | null;
    displayName: string | null;
};

export class ExplicitSeasonRankingError extends Error {
    constructor(public readonly code: string, message: string, public readonly status: number) {
        super(message);
        this.name = "ExplicitSeasonRankingError";
    }
}

export function parseHistoricalRankingEntries(value: unknown): HistoricalRankingEntryInput[] {
    if (!Array.isArray(value) || value.length < 1 || value.length > 200) {
        throw new ExplicitSeasonRankingError("INVALID_RANKING_ENTRIES", "순위 입력 내용을 확인해주세요.", 400);
    }
    const memberIds = new Set<string>();
    return value.map((raw, index) => {
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
            throw new ExplicitSeasonRankingError("INVALID_RANKING_ENTRY", "순위별 참가자 정보를 확인해주세요.", 400);
        }
        const item = raw as Record<string, unknown>;
        const rank = item.rank;
        const participantType = item.participantType;
        if (rank !== index + 1 || (participantType !== "MEMBER" && participantType !== "MANUAL")) {
            throw new ExplicitSeasonRankingError("INVALID_RANK_CONTINUITY", "순위는 1위부터 빠짐없이 입력해주세요.", 400);
        }
        if (participantType === "MEMBER") {
            if (typeof item.memberId !== "string" || !item.memberId.trim() || memberIds.has(item.memberId)) {
                throw new ExplicitSeasonRankingError("DUPLICATE_OR_INVALID_MEMBER", "같은 회원을 순위에 중복 지정할 수 없습니다.", 400);
            }
            memberIds.add(item.memberId);
            return { rank, participantType, memberId: item.memberId, displayName: null };
        }
        const displayName = typeof item.displayName === "string" ? item.displayName.trim() : "";
        if (!displayName || displayName.length > 100 || item.memberId != null) {
            throw new ExplicitSeasonRankingError("INVALID_MANUAL_NAME", "직접 입력 참가자 이름을 확인해주세요.", 400);
        }
        return { rank, participantType, memberId: null, displayName };
    });
}

const snapshotSelect = {
    id: true,
    revision: true,
    savedAt: true,
    savedBy: { select: { id: true, name: true } },
    entries: {
        orderBy: [{ rank: "asc" as const }, { id: "asc" as const }],
        select: {
            id: true, participantType: true, memberId: true, displayName: true, rank: true,
            member: { select: { blindAt: true } },
        },
    },
};

type SnapshotValue = {
    id: string;
    revision: number;
    savedAt: Date;
    savedBy: { id: string; name: string };
    entries: {
        id: string; participantType: string; memberId: string | null; displayName: string; rank: number;
        member: { blindAt: Date | null } | null;
    }[];
};

function serializeSnapshot(value: SnapshotValue, hideBlinded: boolean) {
    const entries = value.entries
        .filter((entry) => !hideBlinded || entry.member?.blindAt == null)
        .map(({ member: _member, ...entry }, index) => ({
            ...entry,
            rank: hideBlinded ? index + 1 : entry.rank,
            participantType: entry.participantType === "MEMBER" ? "MEMBER" as const : "MANUAL" as const,
        }));
    return {
        id: value.id,
        revision: value.revision,
        savedAt: value.savedAt.toISOString(),
        savedBy: value.savedBy,
        entries,
    };
}

async function loadAccess(actorUserId: string, teamId: string, seasonId: string) {
    const team = await prisma.team.findFirst({
        where: { id: teamId, isActive: true, members: { some: { userId: actorUserId } } },
        select: { id: true, ownerId: true, User: { select: { id: true } } },
    });
    if (!team) throw new ExplicitSeasonRankingError("TEAM_NOT_FOUND", "동호회를 찾을 수 없습니다.", 404);
    const season = await prisma.teamSeason.findFirst({
        where: { id: seasonId, teamId },
        select: { id: true, rankingMode: true, status: true, startDate: true, endDate: true },
    });
    if (!season) throw new ExplicitSeasonRankingError("SEASON_NOT_FOUND", "시즌을 찾을 수 없습니다.", 404);
    const canManage = team.ownerId === actorUserId || team.User.some((user) => user.id === actorUserId);
    return { season, canManage };
}

export async function getExplicitSeasonRanking(actorUserId: string, teamId: string, seasonId: string) {
    const access = await loadAccess(actorUserId, teamId, seasonId);
    const value = await prisma.seasonRankingSnapshot.findFirst({
        where: { seasonId }, orderBy: [{ revision: "desc" }], select: snapshotSelect,
    });
    return value
        ? serializeSnapshot(value, seasonLifecycleStatus(access.season) === "ACTIVE")
        : null;
}

export async function saveExplicitSeasonRanking(
    actorUserId: string,
    teamId: string,
    seasonId: string,
    input: unknown,
) {
    const access = await loadAccess(actorUserId, teamId, seasonId);
    if (!access.canManage) throw new ExplicitSeasonRankingError("FORBIDDEN", "시즌 순위를 관리할 권한이 없습니다.", 403);
    if (access.season.rankingMode !== "IMAGE") {
        throw new ExplicitSeasonRankingError("SEASON_RANKING_MODE_MISMATCH", "이미지 관리 시즌에서만 직접 순위를 지정할 수 있습니다.", 409);
    }
    const body = input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : {};
    const entries = parseHistoricalRankingEntries(body.entries);
    try {
        const created = await prisma.$transaction(async (tx) => {
            const memberIds = entries.flatMap((entry) => entry.memberId ? [entry.memberId] : []);
            const members = memberIds.length === 0 ? [] : await tx.teamMember.findMany({
                where: { teamId, id: { in: memberIds } },
                select: { id: true, alias: true, user: { select: { name: true } } },
            });
            if (members.length !== memberIds.length) {
                throw new ExplicitSeasonRankingError("INVALID_MEMBER", "다른 동호회 회원은 순위에 지정할 수 없습니다.", 400);
            }
            const memberById = new Map(members.map((member) => [member.id, member]));
            const latest = await tx.seasonRankingSnapshot.findFirst({
                where: { seasonId }, orderBy: [{ revision: "desc" }], select: { revision: true },
            });
            return tx.seasonRankingSnapshot.create({
                data: {
                    seasonId,
                    revision: (latest?.revision ?? 0) + 1,
                    savedByUserId: actorUserId,
                    entries: { create: entries.map((entry) => {
                        const member = entry.memberId ? memberById.get(entry.memberId)! : null;
                        return {
                            participantType: entry.participantType,
                            memberId: entry.memberId,
                            displayName: member ? member.alias || member.user.name : entry.displayName!,
                            rank: entry.rank,
                        };
                    }) },
                },
                select: snapshotSelect,
            });
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
        return serializeSnapshot(created, false);
    } catch (error) {
        if (error instanceof ExplicitSeasonRankingError) throw error;
        if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2002" || error.code === "P2034")) {
            throw new ExplicitSeasonRankingError("RANKING_SAVE_CONFLICT", "순위가 동시에 변경되었습니다. 다시 시도해주세요.", 409);
        }
        throw error;
    }
}
