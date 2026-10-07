import prisma from '@/lib/prisma';
import { PUBLIC_ORIGIN } from '@/lib/public-web';
import { getChampRoundResults } from '@/app/actions/champ-results';
import { getIndividualLeaderboard } from '@/app/actions/league-leaderboard';
import { BandApiError, bandErrorMessage, createPost } from './client';
import { decryptBandToken } from './token-crypto';
import { buildFinalResultPost, buildRecruitmentPost } from './content';
import type { BandPostType, BandPublishOutcome, FinalResultEntry } from './types';
import { bandAutoPublishSkipReason, bandPostDedupeKey, nextBandPostRevision } from './policy';

type PublishInput = {
    tournamentId: string;
    roundId?: string | null;
    requestedById?: string | null;
    forceRevision?: boolean;
};

function parseSettings(raw: string | null | undefined): Record<string, any> {
    try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}

function publicUrl(path: string): string {
    return `${PUBLIC_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
}

async function publishBuiltContent(input: PublishInput & {
    centerId: string;
    type: BandPostType;
    content: string;
    autoFlag: 'autoRecruitment' | 'autoFinalResult';
}): Promise<BandPublishOutcome> {
    const db = prisma as any;
    const connection = await db.bandConnection.findUnique({ where: { centerId: input.centerId } });
    const skipReason = bandAutoPublishSkipReason(connection, input.type);
    if (skipReason) return { status: 'SKIPPED', message: skipReason };
    if (!input.forceRevision && !connection[input.autoFlag]) return { status: 'SKIPPED', message: '해당 BAND 자동 게시 설정이 꺼져 있습니다.' };

    const latest = await db.bandPost.findFirst({
        where: { tournamentId: input.tournamentId, roundId: input.roundId || null, type: input.type },
        orderBy: { revision: 'desc' },
    });
    if (latest && !input.forceRevision) {
        return { status: 'SKIPPED', message: '이미 게시 이력이 있어 중복 게시하지 않았습니다.', postId: latest.id, revision: latest.revision };
    }

    const revision = nextBandPostRevision(latest?.revision);
    let history: any = null;
    try {
        history = await db.bandPost.create({
            data: {
                centerId: input.centerId,
                tournamentId: input.tournamentId,
                roundId: input.roundId || null,
                type: input.type,
                revision,
                dedupeKey: bandPostDedupeKey(input.tournamentId, input.roundId, input.type, revision),
                bandKey: connection.bandKey,
                contentSnapshot: input.content,
                requestedById: input.requestedById || null,
                status: 'PENDING',
            },
        });

        const posted = await createPost({
            accessToken: decryptBandToken(connection.accessTokenEncrypted),
            bandKey: connection.bandKey,
            content: input.content,
            doPush: connection.doPush,
        });
        await db.bandPost.update({
            where: { id: history.id },
            data: { status: 'SUCCESS', postKey: posted.postKey, postedAt: new Date(), errorCode: null, errorMessage: null },
        });
        return { status: 'SUCCESS', message: 'BAND 게시를 완료했습니다.', postId: history.id, postKey: posted.postKey, revision };
    } catch (error: any) {
        if (error?.code === 'P2002' && !history) {
            return { status: 'SKIPPED', message: '동일한 게시 요청이 이미 처리 중이거나 완료되었습니다.' };
        }
        if (history) {
            await db.bandPost.update({
                where: { id: history.id },
                data: {
                    status: 'FAILED',
                    errorCode: error instanceof BandApiError ? error.code : 'PUBLISH_FAILED',
                    errorMessage: bandErrorMessage(error),
                },
            }).catch(() => undefined);
        }
        return { status: 'FAILED', message: bandErrorMessage(error), postId: history?.id, revision };
    }
}

export async function publishTournamentRecruitment(input: PublishInput): Promise<BandPublishOutcome> {
    const tournament = await (prisma as any).tournament.findUnique({
        where: { id: input.tournamentId },
        include: {
            center: true,
            registrations: { select: { id: true } },
            leagueRounds: {
                orderBy: { roundNumber: 'asc' },
                include: { participants: { select: { id: true } } },
            },
        },
    });
    if (!tournament) return { status: 'FAILED', message: '대회를 찾을 수 없습니다.' };
    const round = input.roundId
        ? tournament.leagueRounds.find((item: any) => item.id === input.roundId)
        : null;
    if (input.roundId && !round) return { status: 'FAILED', message: '회차를 찾을 수 없습니다.' };

    const settings = parseSettings(tournament.settings);
    const participantCount = round ? round.participants.length : tournament.registrations.length;
    const maxParticipants = round
        ? settings.roundMaxParticipants?.[round.roundNumber] ?? tournament.maxParticipants
        : tournament.maxParticipants;
    const detailPath = round
        ? `/centers/${tournament.centerId}/tournaments/${tournament.id}/rounds/${round.id}`
        : `/centers/${tournament.centerId}/tournaments/${tournament.id}`;
    const content = buildRecruitmentPost({
        title: round ? `${round.roundNumber}회차 참가 모집` : '대회 참가자 모집',
        tournamentName: tournament.name,
        centerName: tournament.center.name,
        centerAddress: tournament.center.address,
        date: round?.date || tournament.startDate,
        roundNumber: round?.roundNumber,
        gameMethod: settings.gameMethod,
        participantCount,
        maxParticipants,
        entryFeeText: settings.entryFeeText || (tournament.entryFee > 0 ? `${tournament.entryFee.toLocaleString('ko-KR')}원` : null),
        detailUrl: publicUrl(detailPath),
    });
    return publishBuiltContent({ ...input, centerId: tournament.centerId, type: 'RECRUITMENT', content, autoFlag: 'autoRecruitment' });
}

async function finalResultData(tournament: any, requestedRoundId?: string | null): Promise<{
    roundId: string | null;
    roundNumber: number | null;
    results: FinalResultEntry[];
    participantCount: number;
    detailUrl: string;
} | null> {
    if (tournament.type === 'LEAGUE') {
        const round = requestedRoundId ? tournament.leagueRounds.find((item: any) => item.id === requestedRoundId) : null;
        const leaderboard = await getIndividualLeaderboard(tournament.id, round?.roundNumber);
        const players = leaderboard.teams.flatMap((team: any) => team.players);
        return {
            roundId: round?.id || null,
            roundNumber: round?.roundNumber || null,
            results: leaderboard.top30.slice(0, 3).map((entry: any) => ({
                name: entry.name,
                total: entry.totalHandicappedPins,
                average: entry.gamesCount ? entry.totalHandicappedPins / entry.gamesCount : null,
            })),
            participantCount: players.length,
            detailUrl: publicUrl(`/centers/${tournament.centerId}/tournaments/${tournament.id}/individual-leaderboard`),
        };
    }

    const round = requestedRoundId
        ? tournament.leagueRounds.find((item: any) => item.id === requestedRoundId)
        : [...tournament.leagueRounds].reverse().find((item: any) => item.individualScores.length > 0);
    if (!round) return null;
    const result = await getChampRoundResults(round.id);
    return {
        roundId: round.id,
        roundNumber: round.roundNumber,
        results: result.results.slice(0, 3).map((entry: any) => ({
            name: entry.name,
            total: entry.total,
            average: entry.playedG ? entry.total / entry.playedG : null,
        })),
        participantCount: result.results.length,
        detailUrl: publicUrl(`/centers/${tournament.centerId}/tournaments/${tournament.id}/rounds/${round.id}/results`),
    };
}

export async function publishTournamentFinalResult(input: PublishInput): Promise<BandPublishOutcome> {
    const tournament = await (prisma as any).tournament.findUnique({
        where: { id: input.tournamentId },
        include: {
            leagueRounds: {
                orderBy: { roundNumber: 'asc' },
                include: { individualScores: { select: { id: true } } },
            },
        },
    });
    if (!tournament) return { status: 'FAILED', message: '대회를 찾을 수 없습니다.' };
    const data = await finalResultData(tournament, input.roundId);
    if (!data || data.results.length === 0) return { status: 'SKIPPED', message: '게시할 확정 결과가 없습니다.' };
    const content = buildFinalResultPost({
        title: data.roundNumber ? `${data.roundNumber}회차 최종 결과` : '대회 최종 결과',
        tournamentName: tournament.name,
        roundNumber: data.roundNumber,
        results: data.results,
        participantCount: data.participantCount,
        detailUrl: data.detailUrl,
    });
    return publishBuiltContent({
        ...input,
        roundId: data.roundId,
        centerId: tournament.centerId,
        type: 'FINAL_RESULT',
        content,
        autoFlag: 'autoFinalResult',
    });
}

export async function republishBandPost(input: PublishInput & { type: BandPostType }): Promise<BandPublishOutcome> {
    const forced = { ...input, forceRevision: true };
    return input.type === 'RECRUITMENT'
        ? publishTournamentRecruitment(forced)
        : publishTournamentFinalResult(forced);
}

export async function sendBandTestPost(centerId: string): Promise<BandPublishOutcome> {
    const connection = await (prisma as any).bandConnection.findUnique({
        where: { centerId }, include: { center: { select: { name: true } } },
    });
    if (!connection?.enabled || !connection.bandKey) return { status: 'SKIPPED', message: '게시할 BAND를 먼저 선택해주세요.' };
    try {
        const posted = await createPost({
            accessToken: decryptBandToken(connection.accessTokenEncrypted),
            bandKey: connection.bandKey,
            content: `🎳 BowlingManager BAND 연동 테스트\n\n${connection.center.name}와 NAVER BAND 연결이 정상적으로 완료되었습니다.\n\nBowlingManager`,
            doPush: false,
        });
        return { status: 'SUCCESS', message: 'BAND 테스트 글을 게시했습니다.', postKey: posted.postKey };
    } catch (error) {
        return { status: 'FAILED', message: bandErrorMessage(error) };
    }
}
