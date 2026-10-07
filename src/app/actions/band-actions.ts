'use server';

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { verifyCenterAdmin } from "@/lib/auth-utils";
import {
    canWriteBandPost,
    createBandPost,
    fetchJoinedBands,
    isBandConfigured,
} from "@/lib/band/client";
import { decryptBandToken } from "@/lib/band/token-crypto";
import { buildLeagueWeeklyBandPost } from "@/lib/band/league-share";
import {
    getIndividualLeaderboard,
    getLeagueLeaderboard,
} from "@/app/actions/league-leaderboard";
import { getLeagueRoundResults } from "@/app/actions/league-results";

const BAND_SOURCE_LEAGUE_WEEKLY = "LEAGUE_WEEKLY_RESULT";
const MAX_CONTENT_LENGTH = 10000;

async function requireUserId(): Promise<string> {
    const session = await auth();

    if (!session?.user?.id) {
        throw new Error("로그인이 필요합니다.");
    }

    return session.user.id;
}

function safeErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        const message = error.message.trim();

        if (
            message.includes("permission")
            || message.includes("Permission")
            || message.includes("권한")
        ) {
            return "선택한 BAND에 글쓰기 권한이 없습니다.";
        }

        if (
            message.includes("token")
            || message.includes("Token")
            || message.includes("Unauthorized")
            || message.includes("expired")
        ) {
            return "BAND 연결이 만료되었습니다. 다시 연결해주세요.";
        }
    }

    return "BAND 게시 중 오류가 발생했습니다.";
}

async function getConnection(userId: string) {
    return (prisma as any).bandConnection.findUnique({
        where: { userId },
    });
}

async function getAccessToken(userId: string): Promise<string> {
    const connection = await getConnection(userId);

    if (!connection) {
        throw new Error("BAND account is not connected.");
    }

    if (
        connection.expiresAt
        && new Date(connection.expiresAt).getTime() <= Date.now()
    ) {
        throw new Error("BAND token expired.");
    }

    return decryptBandToken(connection.encryptedAccessToken);
}

async function requireLeagueAdmin(
    tournamentId: string,
): Promise<{
    userId: string;
    tournament: {
        id: string;
        centerId: string;
        name: string;
        type: string;
        reportNotice: string | null;
    };
}> {
    const tournament = await (prisma as any).tournament.findUnique({
        where: { id: tournamentId },
        select: {
            id: true,
            centerId: true,
            name: true,
            type: true,
            reportNotice: true,
        },
    });

    if (!tournament || tournament.type !== "LEAGUE") {
        throw new Error("리그 대회를 찾을 수 없습니다.");
    }

    const userId = await verifyCenterAdmin(tournament.centerId);

    return {
        userId,
        tournament,
    };
}

async function findLeagueRound(
    tournamentId: string,
    roundNumber: number,
) {
    const round = await (prisma as any).leagueRound.findFirst({
        where: {
            tournamentId,
            roundNumber,
        },
        select: {
            id: true,
            roundNumber: true,
            date: true,
        },
    });

    if (!round) {
        throw new Error("선택한 주차 정보를 찾을 수 없습니다.");
    }

    return round;
}

export async function getBandConnectionStatus() {
    const userId = await requireUserId();

    if (!isBandConfigured()) {
        return {
            configured: false,
            connected: false,
            expiresAt: null as string | null,
        };
    }

    const connection = await getConnection(userId);

    return {
        configured: true,
        connected: Boolean(connection),
        expiresAt: connection?.expiresAt
            ? new Date(connection.expiresAt).toISOString()
            : null,
    };
}

export async function disconnectBand() {
    const userId = await requireUserId();

    await (prisma as any).bandConnection.deleteMany({
        where: { userId },
    });

    return { success: true };
}

export async function getAvailableBands() {
    const userId = await requireUserId();
    const accessToken = await getAccessToken(userId);
    const bands = await fetchJoinedBands(accessToken);

    return bands.map((band) => ({
        bandKey: band.band_key,
        name: band.name,
        cover: band.cover || null,
        memberCount: band.member_count ?? null,
    }));
}

export async function previewLeagueWeeklyBandPost(
    tournamentId: string,
    roundNumber: number,
) {
    if (!Number.isInteger(roundNumber) || roundNumber < 1) {
        throw new Error("주차를 확인해주세요.");
    }

    const {
        tournament,
    } = await requireLeagueAdmin(tournamentId);

    const round = await findLeagueRound(
        tournamentId,
        roundNumber,
    );

    const [leaderboard, individual, roundResults] = await Promise.all([
        getLeagueLeaderboard(tournamentId, roundNumber),
        getIndividualLeaderboard(tournamentId, roundNumber),
        getLeagueRoundResults(round.id),
    ]);

    const content = buildLeagueWeeklyBandPost({
        tournamentName: tournament.name,
        roundNumber,
        roundDate: round.date,
        teamStandings: leaderboard.teamStandings,
        topPlayers: individual.top30,
        matchups: roundResults.matchups,
        reportNotice:
            leaderboard.metadata.reportNotice
            || individual.metadata.reportNotice
            || tournament.reportNotice,
    });

    return {
        content,
        tournamentName: tournament.name,
        roundNumber,
        existingImageReports: [
            "팀 순위 & 시상",
            "팀별 개인 순위",
            "매치 기록표",
            "개인 평균 TOP 30",
        ],
    };
}

type ShareLeagueWeeklyInput = {
    tournamentId: string;
    roundNumber: number;
    bandKey: string;
    content: string;
    doPush?: boolean;
};

async function createShareLog(input: {
    userId: string;
    bandKey: string;
    bandName: string;
    tournamentId: string | null;
    roundNumber: number | null;
    content: string;
    status: "SUCCESS" | "FAILED";
    postKey?: string | null;
    errorCode?: string | null;
    errorMessage?: string | null;
    retryOfId?: string | null;
}) {
    return (prisma as any).bandShareLog.create({
        data: {
            userId: input.userId,
            bandKey: input.bandKey,
            bandName: input.bandName,
            sourceType: BAND_SOURCE_LEAGUE_WEEKLY,
            sourceTournamentId: input.tournamentId,
            sourceRoundNumber: input.roundNumber,
            content: input.content,
            postKey: input.postKey || null,
            status: input.status,
            errorCode: input.errorCode || null,
            errorMessage: input.errorMessage || null,
            retryOfId: input.retryOfId || null,
        },
    });
}

async function publishToBand(input: {
    userId: string;
    bandKey: string;
    content: string;
    doPush: boolean;
    tournamentId: string | null;
    roundNumber: number | null;
    retryOfId?: string | null;
}) {
    const content = input.content.trim();

    if (!content || content.length > MAX_CONTENT_LENGTH) {
        throw new Error("게시글 본문 길이를 확인해주세요.");
    }

    const accessToken = await getAccessToken(input.userId);
    const bands = await fetchJoinedBands(accessToken);
    const band = bands.find(
        (item) => item.band_key === input.bandKey,
    );

    if (!band) {
        throw new Error("선택한 BAND에 접근할 수 없습니다.");
    }

    const canPost = await canWriteBandPost(
        accessToken,
        band.band_key,
    );

    if (!canPost) {
        throw new Error("선택한 BAND에 글쓰기 권한이 없습니다.");
    }

    try {
        const result = await createBandPost({
            accessToken,
            bandKey: band.band_key,
            content,
            doPush: input.doPush,
        });

        const log = await createShareLog({
            userId: input.userId,
            bandKey: band.band_key,
            bandName: band.name,
            tournamentId: input.tournamentId,
            roundNumber: input.roundNumber,
            content,
            status: "SUCCESS",
            postKey: result.post_key,
            retryOfId: input.retryOfId,
        });

        return {
            success: true as const,
            postKey: result.post_key,
            historyId: log.id as string,
            message: "BAND 게시가 완료되었습니다.",
        };
    } catch (error) {
        const message = safeErrorMessage(error);

        await createShareLog({
            userId: input.userId,
            bandKey: band.band_key,
            bandName: band.name,
            tournamentId: input.tournamentId,
            roundNumber: input.roundNumber,
            content,
            status: "FAILED",
            errorCode: "POST_FAILED",
            errorMessage: message,
            retryOfId: input.retryOfId,
        });

        return {
            success: false as const,
            message,
        };
    }
}

export async function shareLeagueWeeklyResultToBand(
    input: ShareLeagueWeeklyInput,
) {
    if (
        typeof input.tournamentId !== "string"
        || !input.tournamentId
        || !Number.isInteger(input.roundNumber)
        || input.roundNumber < 1
        || typeof input.bandKey !== "string"
        || !input.bandKey
        || typeof input.content !== "string"
    ) {
        return {
            success: false as const,
            message: "공유 요청을 확인해주세요.",
        };
    }

    try {
        const { userId } = await requireLeagueAdmin(
            input.tournamentId,
        );

        await findLeagueRound(
            input.tournamentId,
            input.roundNumber,
        );

        return publishToBand({
            userId,
            bandKey: input.bandKey,
            content: input.content,
            doPush: Boolean(input.doPush),
            tournamentId: input.tournamentId,
            roundNumber: input.roundNumber,
        });
    } catch (error) {
        return {
            success: false as const,
            message: safeErrorMessage(error),
        };
    }
}

export async function getBandShareHistory(limit = 10) {
    const userId = await requireUserId();
    const safeLimit = Number.isInteger(limit)
        ? Math.min(30, Math.max(1, limit))
        : 10;

    const rows = await (prisma as any).bandShareLog.findMany({
        where: {
            userId,
            sourceType: BAND_SOURCE_LEAGUE_WEEKLY,
        },
        orderBy: {
            createdAt: "desc",
        },
        take: safeLimit,
    });

    return rows.map((row: any) => ({
        id: row.id as string,
        bandName: row.bandName as string,
        tournamentId: row.sourceTournamentId as string | null,
        roundNumber: row.sourceRoundNumber as number | null,
        status: row.status as string,
        postKey: row.postKey as string | null,
        errorMessage: row.errorMessage as string | null,
        createdAt: new Date(row.createdAt).toISOString(),
    }));
}

export async function retryBandShare(historyId: string) {
    const userId = await requireUserId();

    const history = await (prisma as any).bandShareLog.findFirst({
        where: {
            id: historyId,
            userId,
            sourceType: BAND_SOURCE_LEAGUE_WEEKLY,
        },
    });

    if (!history) {
        return {
            success: false as const,
            message: "재게시할 이력을 찾을 수 없습니다.",
        };
    }

    try {
        if (history.sourceTournamentId) {
            await requireLeagueAdmin(
                history.sourceTournamentId,
            );
        }

        return publishToBand({
            userId,
            bandKey: history.bandKey,
            content: history.content,
            doPush: false,
            tournamentId: history.sourceTournamentId,
            roundNumber: history.sourceRoundNumber,
            retryOfId: history.id,
        });
    } catch (error) {
        return {
            success: false as const,
            message: safeErrorMessage(error),
        };
    }
}
