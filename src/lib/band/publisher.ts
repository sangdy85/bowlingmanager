import prisma from '@/lib/prisma';
import { PUBLIC_ORIGIN } from '@/lib/public-web';
import { formatLane } from '@/lib/tournament-utils';
import { getChampRoundResults } from '@/app/actions/champ-results';
import { getIndividualLeaderboard, getWeeklyLeagueReport } from '@/app/actions/league-leaderboard';
import { BandApiError, bandErrorMessage, createPost, getPermissions } from './client';
import { decryptBandToken } from './token-crypto';
import { bandPostContentIssue, bandPostContentSize, BAND_POST_MAX_UTF8_BYTES } from './content-guard';
import { createBandPreviewApproval, verifyBandPreviewApproval } from './preview-signature';
import { getLeagueMatchTeamReport } from '@/lib/league-report';
import { buildLeagueWeeklyPost, isLeagueWeekReady } from './league-weekly-content';
import { buildFinalResultPost, buildLaneAssignmentPost, buildParticipantPost, buildRecruitmentPost } from './content';
import type { BandPostType, BandPublishOutcome, FinalResultEntry } from './types';
import { bandAutoPublishSkipReason, bandPostDedupeKey, nextBandPostRevision } from './policy';
import { isBandConfigured, BAND_NOT_CONFIGURED_MESSAGE } from './config';

type PublishInput = {
    tournamentId: string;
    roundId?: string | null;
    requestedById?: string | null;
    forceRevision?: boolean;
    previewOnly?: boolean;
    previewToken?: string;
    week?: number;
    doPush?: boolean;
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
    if (!isBandConfigured()) return { status: 'SKIPPED', message: BAND_NOT_CONFIGURED_MESSAGE };
    const contentIssue = bandPostContentIssue(input.content);
    if (contentIssue) return { status: 'SKIPPED', message: contentIssue };

    const db = prisma as any;
    const connection = await db.bandConnection.findUnique({ where: { centerId: input.centerId } });
    if (!connection?.enabled || !connection.bandKey) {
        return { status: 'SKIPPED', message: '연결된 BAND가 없어 게시하지 않았습니다.' };
    }
    if (!input.forceRevision && !input.previewOnly) {
        const skipReason = bandAutoPublishSkipReason(connection, input.type);
        if (skipReason) return { status: 'SKIPPED', message: skipReason };
    }

    const doPush = typeof input.doPush === 'boolean' ? input.doPush : connection.doPush === true;
    const latest = await db.bandPost.findFirst({
        where: { tournamentId: input.tournamentId, roundId: input.roundId || null, type: input.type },
        orderBy: { revision: 'desc' },
    });
    // Signed server-side: the client cannot mint or alter the confirmation.
    // This binds the exact body, target, history revision and actor for 15 minutes.
    const approvalPayload = JSON.stringify({
        centerId: input.centerId,
        tournamentId: input.tournamentId,
        roundId: input.roundId || null,
        type: input.type,
        bandKey: connection.bandKey,
        bandName: connection.bandName || '',
        doPush,
        content: input.content,
        latestRevision: latest?.revision ?? 0,
        latestStatus: latest?.status ?? null,
    });

    if (input.previewOnly) {
        return {
            status: 'SUCCESS',
            message: '게시 전 미리보기가 준비되었습니다. 아직 BAND에 게시하지 않았습니다.',
            preview: {
                bandName: connection.bandName || '이름 미등록 BAND',
                bandKey: connection.bandKey,
                doPush,
                content: input.content,
                contentBytes: bandPostContentSize(input.content),
                maxContentBytes: BAND_POST_MAX_UTF8_BYTES,
                nextRevision: nextBandPostRevision(latest?.revision),
                latestStatus: latest?.status ?? null,
                previewToken: createBandPreviewApproval(approvalPayload, input.requestedById || ''),
            },
        };
    }
    if (input.previewToken !== undefined &&
        !verifyBandPreviewApproval(input.previewToken, approvalPayload, input.requestedById || '')) {
        return { status: 'SKIPPED', message: '미리보기 승인 정보가 만료되었거나 게시 내용·대상·이력이 변경되었습니다. 다시 미리보기 해주세요.' };
    }
    if (latest?.status === 'PENDING' || latest?.status === 'UNKNOWN') {
        return { status: 'SKIPPED', message: '이전 BAND 게시 결과가 미확인 상태입니다. BAND에서 실제 게시 여부를 확인한 뒤 관리 조치가 필요합니다.', postId: latest.id, revision: latest.revision };
    }
    if (latest && !input.forceRevision) {
        return { status: 'SKIPPED', message: '이미 게시 이력이 있어 중복 게시하지 않았습니다.', postId: latest.id, revision: latest.revision };
    }

    const revision = nextBandPostRevision(latest?.revision);
    let history: any = null;
    let externalPostStarted = false;
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

        const accessToken = decryptBandToken(connection.accessTokenEncrypted);
        const permissions = await getPermissions(accessToken, connection.bandKey);
        if (!permissions.includes('posting')) {
            throw new BandApiError('BAND posting permission denied.', 'POSTING_PERMISSION_DENIED', 403);
        }

        // Once the outbound request starts, a timeout does not prove the post
        // failed. Prevent a blind retry until someone verifies the BAND itself.
        externalPostStarted = true;
        const posted = await createPost({
            accessToken,
            bandKey: connection.bandKey,
            content: input.content,
            doPush,
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
        const ambiguousMessage = 'BAND 게시 결과를 확인할 수 없습니다. BAND에서 글이 올라갔는지 확인하기 전에는 재게시하지 마세요.';
        const message = externalPostStarted ? ambiguousMessage : bandErrorMessage(error);
        if (history) {
            await db.bandPost.update({
                where: { id: history.id },
                data: {
                    status: externalPostStarted ? 'UNKNOWN' : 'FAILED',
                    errorCode: externalPostStarted ? 'PUBLISH_UNCONFIRMED' : error instanceof BandApiError ? error.code : 'PUBLISH_FAILED',
                    errorMessage: message,
                },
            }).catch(() => undefined);
        }
        return { status: 'FAILED', message, postId: history?.id, revision };
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


function roundParticipantLimit(tournament: any, round: any): number {
    const settings = parseSettings(tournament.settings);
    return settings.roundMaxParticipants?.[round.roundNumber] ?? tournament.maxParticipants ?? 0;
}

function orderedRoundParticipants(round: any): any[] {
    return [...(round.participants || [])].sort((a, b) => {
        const aTime = new Date(a.createdAt || a.registration?.createdAt || 0).getTime();
        const bTime = new Date(b.createdAt || b.registration?.createdAt || 0).getTime();
        return aTime - bTime;
    });
}

function participantDisplayName(participant: any): string {
    return participant.registration?.guestName ?? participant.registration?.user?.name ?? '이름 미등록';
}

function participantTeamName(participant: any): string | null {
    return participant.registration?.guestTeamName ?? participant.registration?.team?.name ?? null;
}

async function findRoundForBandPost(tournamentId: string, roundId: string | null | undefined) {
    const tournament = await (prisma as any).tournament.findUnique({
        where: { id: tournamentId },
        include: {
            leagueRounds: {
                orderBy: { roundNumber: 'asc' },
                include: {
                    participants: {
                        include: {
                            registration: {
                                include: {
                                    user: { select: { name: true } },
                                    team: { select: { name: true } },
                                },
                            },
                        },
                    },
                },
            },
        },
    });
    if (!tournament) return { tournament: null, round: null };
    const round = roundId ? tournament.leagueRounds.find((item: any) => item.id === roundId) : null;
    return { tournament, round };
}

export async function publishRoundParticipants(input: PublishInput): Promise<BandPublishOutcome> {
    if (!input.roundId) return { status: 'FAILED', message: '회차 정보가 필요합니다.' };
    const { tournament, round } = await findRoundForBandPost(input.tournamentId, input.roundId);
    if (!tournament) return { status: 'FAILED', message: '대회를 찾을 수 없습니다.' };
    if (!round) return { status: 'FAILED', message: '회차를 찾을 수 없습니다.' };
    if (!['CHAMP', 'EVENT'].includes(tournament.type)) {
        return { status: 'SKIPPED', message: '참가자 명단 BAND 게시 기능은 챔프전·이벤트전에서 사용합니다.' };
    }

    const ordered = orderedRoundParticipants(round);
    const limit = roundParticipantLimit(tournament, round);
    const activeCount = limit > 0 ? Math.min(limit, ordered.length) : ordered.length;
    const waitlistCount = Math.max(0, ordered.length - activeCount);
    const content = buildParticipantPost({
        title: `${round.roundNumber}회차 참가자 명단`,
        tournamentName: tournament.name,
        roundNumber: round.roundNumber,
        participants: ordered.map((participant, index) => ({
            name: participantDisplayName(participant),
            team: participantTeamName(participant),
            waitlisted: limit > 0 && index >= limit,
        })),
        activeCount,
        waitlistCount,
        detailUrl: publicUrl(`/centers/${tournament.centerId}/tournaments/${tournament.id}/rounds/${round.id}?tab=participants`),
    });

    return publishBuiltContent({
        ...input,
        centerId: tournament.centerId,
        type: 'PARTICIPANTS',
        content,
        autoFlag: 'autoRecruitment',
    });
}

export async function publishRoundLaneAssignment(input: PublishInput): Promise<BandPublishOutcome> {
    if (!input.roundId) return { status: 'FAILED', message: '회차 정보가 필요합니다.' };
    const { tournament, round } = await findRoundForBandPost(input.tournamentId, input.roundId);
    if (!tournament) return { status: 'FAILED', message: '대회를 찾을 수 없습니다.' };
    if (!round) return { status: 'FAILED', message: '회차를 찾을 수 없습니다.' };
    if (!['CHAMP', 'EVENT'].includes(tournament.type)) {
        return { status: 'SKIPPED', message: '레인 배정 BAND 게시 기능은 챔프전·이벤트전에서 사용합니다.' };
    }

    const ordered = orderedRoundParticipants(round);
    const limit = roundParticipantLimit(tournament, round);
    const active = limit > 0 ? ordered.slice(0, limit) : ordered;
    if (active.length === 0) return { status: 'SKIPPED', message: '게시할 참가자가 없습니다.' };
    const incomplete = active.some(participant => !Number.isInteger(participant.lane) || participant.lane < 11);
    if (incomplete) return { status: 'SKIPPED', message: '실제 참가자 전원의 레인 배정이 완료된 뒤 게시할 수 있습니다.' };

    const content = buildLaneAssignmentPost({
        title: `${round.roundNumber}회차 레인 배정`,
        tournamentName: tournament.name,
        roundNumber: round.roundNumber,
        entries: [...active]
            .sort((a, b) => a.lane - b.lane)
            .map(participant => ({
                name: participantDisplayName(participant),
                team: participantTeamName(participant),
                lane: formatLane(participant.lane),
            })),
        detailUrl: publicUrl(`/centers/${tournament.centerId}/tournaments/${tournament.id}/rounds/${round.id}?tab=participants`),
    });

    return publishBuiltContent({
        ...input,
        centerId: tournament.centerId,
        type: 'LANE_ASSIGNMENT',
        content,
        autoFlag: 'autoRecruitment',
    });
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


export async function publishLeagueWeeklyResult(input: PublishInput): Promise<BandPublishOutcome> {
    if (!input.roundId) return { status: 'FAILED', message: '게시할 주차를 지정해주세요.' };

    const tournament = await (prisma as any).tournament.findUnique({
        where: { id: input.tournamentId },
        select: {
            id: true,
            centerId: true,
            name: true,
            type: true,
            iteration: true,
            leagueRounds: {
                where: { id: input.roundId },
                select: {
                    id: true,
                    roundNumber: true,
                    matchups: {
                        select: {
                            status: true,
                            pointsA: true,
                            pointsB: true,
                            scoreA1: true,
                            scoreA2: true,
                            scoreA3: true,
                            scoreB1: true,
                            scoreB2: true,
                            scoreB3: true,
                            teamASquad: true,
                            teamBSquad: true,
                            teamA: { select: { name: true } },
                            teamB: { select: { name: true } },
                        },
                    },
                },
            },
        },
    });

    if (!tournament) return { status: 'FAILED', message: '대회를 찾을 수 없습니다.' };
    if (tournament.type !== 'LEAGUE') return { status: 'SKIPPED', message: '상주리그 주차 결과에만 게시할 수 있습니다.' };
    const round = tournament.leagueRounds[0];
    if (!round) return { status: 'FAILED', message: '선택한 주차가 존재하지 않습니다.' };
    if (!isLeagueWeekReady(round.matchups)) {
        return { status: 'SKIPPED', message: '해당 주차의 모든 경기가 완료된 후 BAND에 게시할 수 있습니다.' };
    }

    if (input.week !== undefined && (!Number.isSafeInteger(input.week) || input.week !== round.roundNumber)) {
        return { status: 'FAILED', message: '선택한 주차와 경기 정보가 일치하지 않습니다.' };
    }
    const { leaderboard, individual, roundInfo } = await getWeeklyLeagueReport(tournament.id, round.roundNumber);
    if (roundInfo.id !== input.roundId || !isLeagueWeekReady(roundInfo.matchups)) {
        return { status: 'SKIPPED', message: '선택한 주차의 모든 경기가 완료된 후 게시할 수 있습니다.' };
    }
    const results = buildLeagueWeeklyPost({
        tournamentName: tournament.name, iteration: tournament.iteration, week: round.roundNumber,
        teams: leaderboard.teamStandings, awards: leaderboard.awards,
        awardMinGames: leaderboard.metadata.awardMinGames, reportNotice: leaderboard.metadata.reportNotice,
        avgTopRankCount: individual.metadata.avgTopRankCount || 30,
        individualByTeam: individual.teams,
        matches: roundInfo.matchups.map((match: any) => {
            const a = getLeagueMatchTeamReport(match, true, roundInfo.tournamentTeamHandicapLimit);
            const b = getLeagueMatchTeamReport(match, false, roundInfo.tournamentTeamHandicapLimit);
            return {
                teamA: `${match.teamA?.name || '부전승'}${match.teamASquad ? ` (${match.teamASquad})` : ''}`,
                teamB: `${match.teamB?.name || '부전승'}${match.teamBSquad ? ` (${match.teamBSquad})` : ''}`,
                pointsA: match.pointsA ?? 0, pointsB: match.pointsB ?? 0,
                scoresA: [a.g1, a.g2, a.g3], scoresB: [b.g1, b.g2, b.g3],
                playersA: a.scores, playersB: b.scores, lanes: match.lanes,
            };
        }),
        averageTop: individual.top30,
        detailUrl: publicUrl(`/centers/${tournament.centerId}/tournaments/${tournament.id}?week=${round.roundNumber}`),
    });

    return publishBuiltContent({
        ...input,
        centerId: tournament.centerId,
        type: 'LEAGUE_WEEKLY_RESULT',
        content: results,
        autoFlag: 'autoFinalResult',
    });
}

export async function republishBandPost(input: PublishInput & { type: BandPostType }): Promise<BandPublishOutcome> {
    const forced = { ...input, forceRevision: true };
    switch (input.type) {
        case 'RECRUITMENT':
            return publishTournamentRecruitment(forced);
        case 'PARTICIPANTS':
            return publishRoundParticipants(forced);
        case 'LANE_ASSIGNMENT':
            return publishRoundLaneAssignment(forced);
        case 'FINAL_RESULT':
            return publishTournamentFinalResult(forced);
        case 'LEAGUE_WEEKLY_RESULT':
            return publishLeagueWeeklyResult(forced);
    }
}

export async function sendBandTestPost(centerId: string): Promise<BandPublishOutcome> {
    if (!isBandConfigured()) return { status: 'SKIPPED', message: BAND_NOT_CONFIGURED_MESSAGE };
    const connection = await (prisma as any).bandConnection.findUnique({
        where: { centerId }, include: { center: { select: { name: true } } },
    });
    if (!connection?.enabled || !connection.bandKey) return { status: 'SKIPPED', message: '게시할 BAND를 먼저 선택해주세요.' };
    try {
        const accessToken = decryptBandToken(connection.accessTokenEncrypted);
        const permissions = await getPermissions(accessToken, connection.bandKey);
        if (!permissions.includes('posting')) {
            throw new BandApiError('BAND posting permission denied.', 'POSTING_PERMISSION_DENIED', 403);
        }

        const posted = await createPost({
            accessToken,
            bandKey: connection.bandKey,
            content: `🎳 BowlingManager BAND 연동 테스트\n\n${connection.center.name}와 NAVER BAND 연결이 정상적으로 완료되었습니다.\n\nBowlingManager`,
            doPush: false,
        });
        return { status: 'SUCCESS', message: 'BAND 테스트 글을 게시했습니다.', postKey: posted.postKey };
    } catch (error) {
        return { status: 'FAILED', message: bandErrorMessage(error) };
    }
}
