import prisma from '@/lib/prisma';
import { PUBLIC_ORIGIN } from '@/lib/public-web';
import { getChampRoundResults } from '@/app/actions/champ-results';
import { getIndividualLeaderboard, getLeagueLeaderboard } from '@/app/actions/league-leaderboard';
import { formatLane } from '@/lib/tournament-utils';
import { BandApiError, bandErrorMessage, createPost, getPermissions } from './client';
import { decryptBandToken } from './token-crypto';
import {
    buildFinalResultPost,
    buildLaneAssignmentPost,
    buildLeagueWeeklyResultPost,
    buildParticipantListPost,
    buildRecruitmentPost,
} from './content';
import type {
    BandPostPreview,
    BandPostType,
    BandPublishOutcome,
    FinalResultEntry,
} from './types';
import { bandPostDedupeKey, nextBandPostRevision } from './policy';

type PublishInput = {
    tournamentId: string;
    roundId?: string | null;
    requestedById?: string | null;
    type: BandPostType;
};

function parseSettings(raw: string | null | undefined): Record<string, any> {
    try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}

function publicUrl(path: string): string {
    return `${PUBLIC_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
}

function playerName(registration: any) {
    return registration?.user?.name || registration?.guestName || '이름 미등록';
}

function playerTeam(registration: any) {
    return registration?.guestTeamName || registration?.team?.name || '개인';
}

async function buildRecruitmentPreview(tournament: any, roundId?: string | null): Promise<BandPostPreview> {
    const round = roundId
        ? tournament.leagueRounds.find((item: any) => item.id === roundId)
        : null;
    if (roundId && !round) throw new Error('회차를 찾을 수 없습니다.');

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
    return {
        type: 'RECRUITMENT',
        label: '모집 안내',
        content,
        centerId: tournament.centerId,
        tournamentId: tournament.id,
        roundId: round?.id || null,
    };
}

async function buildParticipantsPreview(tournament: any, roundId: string): Promise<BandPostPreview> {
    if (!['CHAMP', 'EVENT'].includes(tournament.type)) throw new Error('참가자 명단 공유는 챔프전·이벤트전에서 사용합니다.');
    const round = tournament.leagueRounds.find((item: any) => item.id === roundId);
    if (!round) throw new Error('회차를 찾을 수 없습니다.');

    const settings = parseSettings(tournament.settings);
    const maxParticipants = settings.roundMaxParticipants?.[round.roundNumber] ?? tournament.maxParticipants ?? 0;
    const ordered = [...round.participants].sort((a: any, b: any) =>
        new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
    );
    const participants = ordered.map((participant: any, index: number) => ({
        name: playerName(participant.registration),
        team: playerTeam(participant.registration),
        waitlisted: maxParticipants > 0 && index >= maxParticipants,
    }));

    return {
        type: 'PARTICIPANTS',
        label: '참가자 모집 현황',
        content: buildParticipantListPost({
            tournamentName: tournament.name,
            roundNumber: round.roundNumber,
            participants,
            detailUrl: publicUrl(`/centers/${tournament.centerId}/tournaments/${tournament.id}/rounds/${round.id}?tab=participants`),
        }),
        centerId: tournament.centerId,
        tournamentId: tournament.id,
        roundId: round.id,
    };
}

async function buildLanePreview(tournament: any, roundId: string): Promise<BandPostPreview> {
    if (!['CHAMP', 'EVENT'].includes(tournament.type)) throw new Error('레인 배정 공유는 챔프전·이벤트전에서 사용합니다.');
    const round = tournament.leagueRounds.find((item: any) => item.id === roundId);
    if (!round) throw new Error('회차를 찾을 수 없습니다.');

    const settings = parseSettings(tournament.settings);
    const maxParticipants = settings.roundMaxParticipants?.[round.roundNumber] ?? tournament.maxParticipants ?? 0;
    const active = [...round.participants]
        .sort((a: any, b: any) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime())
        .slice(0, maxParticipants > 0 ? maxParticipants : undefined);
    const entries = active
        .filter((participant: any) => Number.isInteger(participant.lane) && participant.lane >= 11)
        .sort((a: any, b: any) => a.lane - b.lane)
        .map((participant: any) => ({
            name: playerName(participant.registration),
            team: playerTeam(participant.registration),
            lane: formatLane(participant.lane),
        }));

    return {
        type: 'LANE_ASSIGNMENT',
        label: '레인 배정',
        content: buildLaneAssignmentPost({
            tournamentName: tournament.name,
            roundNumber: round.roundNumber,
            entries,
            detailUrl: publicUrl(`/centers/${tournament.centerId}/tournaments/${tournament.id}/rounds/${round.id}?tab=lanes`),
        }),
        centerId: tournament.centerId,
        tournamentId: tournament.id,
        roundId: round.id,
    };
}

async function buildFinalPreview(tournament: any, roundId?: string | null): Promise<BandPostPreview> {
    if (!roundId) throw new Error('결과를 공유할 회차가 필요합니다.');
    if (!['CHAMP', 'EVENT'].includes(tournament.type)) throw new Error('이 결과 공유 형식은 챔프전·이벤트전에서 사용합니다.');

    const result = await getChampRoundResults(roundId);
    const results: FinalResultEntry[] = result.results.map((entry: any) => ({
        name: entry.name,
        team: entry.team,
        total: entry.total,
        average: entry.playedG ? entry.total / entry.playedG : null,
    }));

    return {
        type: 'FINAL_RESULT',
        label: '최종 결과',
        content: buildFinalResultPost({
            title: result.roundNumber ? `${result.roundNumber}회차 최종 결과` : '대회 최종 결과',
            tournamentName: tournament.name,
            roundNumber: result.roundNumber,
            results,
            participantCount: result.results.length,
            detailUrl: publicUrl(`/centers/${tournament.centerId}/tournaments/${tournament.id}/rounds/${roundId}/results`),
        }),
        centerId: tournament.centerId,
        tournamentId: tournament.id,
        roundId,
    };
}

async function buildLeagueWeeklyPreview(tournament: any, roundId: string): Promise<BandPostPreview> {
    if (tournament.type !== 'LEAGUE') throw new Error('주차 결과 공유는 상주리그에서 사용합니다.');
    const round = tournament.leagueRounds.find((item: any) => item.id === roundId);
    if (!round) throw new Error('주차 정보를 찾을 수 없습니다.');

    const [leaderboard, individual] = await Promise.all([
        getLeagueLeaderboard(tournament.id, round.roundNumber),
        getIndividualLeaderboard(tournament.id, round.roundNumber),
    ]);

    const allPlayers = individual.teams.flatMap((team: any) =>
        team.players.map((person: any) => ({ ...person, teamName: team.teamName }))
    );
    const individualStandings = allPlayers
        .filter((person: any) => person.gamesCount > 0)
        .sort((a: any, b: any) => b.totalHandicappedPins - a.totalHandicappedPins)
        .map((person: any) => ({
            name: person.name,
            teamName: person.teamName,
            average: person.totalHandicappedPins / person.gamesCount,
            totalPins: person.totalHandicappedPins,
        }));

    const matchResults = round.matchups
        .filter((match: any) => match.status === 'FINISHED')
        .map((match: any) => ({
            teamA: match.teamASquad ? `${match.teamA?.name || '팀A'} (${match.teamASquad})` : (match.teamA?.name || '팀A'),
            teamB: match.teamBSquad ? `${match.teamB?.name || '팀B'} (${match.teamBSquad})` : (match.teamB?.name || '팀B'),
            pointsA: match.pointsA || 0,
            pointsB: match.pointsB || 0,
        }));

    const averageTop = individual.top30.map((person: any) => ({
        name: person.name,
        teamName: person.teamName,
        average: person.gamesCount ? person.totalHandicappedPins / person.gamesCount : 0,
    }));

    return {
        type: 'LEAGUE_WEEKLY_RESULT',
        label: `${round.roundNumber}주차 결과`,
        content: buildLeagueWeeklyResultPost({
            tournamentName: tournament.name,
            roundNumber: round.roundNumber,
            teamStandings: leaderboard.teamStandings,
            individualStandings,
            matchResults,
            averageTop,
            detailUrl: publicUrl(`/centers/${tournament.centerId}/tournaments/${tournament.id}/rounds/${round.id}?tab=finalResults`),
        }),
        centerId: tournament.centerId,
        tournamentId: tournament.id,
        roundId: round.id,
    };
}

export async function buildBandPostPreview(input: Pick<PublishInput, 'tournamentId' | 'roundId' | 'type'>): Promise<BandPostPreview> {
    const tournament = await (prisma as any).tournament.findUnique({
        where: { id: input.tournamentId },
        include: {
            center: true,
            registrations: { include: { user: true, team: true } },
            leagueRounds: {
                orderBy: { roundNumber: 'asc' },
                include: {
                    participants: {
                        include: {
                            registration: { include: { user: true, team: true } },
                        },
                    },
                    matchups: {
                        include: { teamA: true, teamB: true },
                    },
                },
            },
        },
    });
    if (!tournament) throw new Error('대회를 찾을 수 없습니다.');

    switch (input.type) {
        case 'PARTICIPANTS':
            if (!input.roundId) throw new Error('참가자 명단을 공유할 회차가 필요합니다.');
            return buildParticipantsPreview(tournament, input.roundId);
        case 'LANE_ASSIGNMENT':
            if (!input.roundId) throw new Error('레인 배정을 공유할 회차가 필요합니다.');
            return buildLanePreview(tournament, input.roundId);
        case 'LEAGUE_WEEKLY_RESULT':
            if (!input.roundId) throw new Error('주차 결과를 공유할 회차가 필요합니다.');
            return buildLeagueWeeklyPreview(tournament, input.roundId);
        case 'FINAL_RESULT':
            return buildFinalPreview(tournament, input.roundId);
        case 'RECRUITMENT':
            return buildRecruitmentPreview(tournament, input.roundId);
        default:
            throw new Error('지원하지 않는 BAND 게시 유형입니다.');
    }
}

async function publishPreview(preview: BandPostPreview, requestedById?: string | null): Promise<BandPublishOutcome> {
    const db = prisma as any;
    const connection = await db.bandConnection.findUnique({ where: { centerId: preview.centerId } });
    if (!connection?.enabled || !connection.bandKey) {
        return { status: 'SKIPPED', message: '볼링장 설정에서 게시할 BAND를 먼저 연결해주세요.' };
    }

    const latest = await db.bandPost.findFirst({
        where: { tournamentId: preview.tournamentId, roundId: preview.roundId, type: preview.type },
        orderBy: { revision: 'desc' },
    });
    const revision = nextBandPostRevision(latest?.revision);
    let history: any = null;

    try {
        history = await db.bandPost.create({
            data: {
                centerId: preview.centerId,
                tournamentId: preview.tournamentId,
                roundId: preview.roundId,
                type: preview.type,
                revision,
                dedupeKey: bandPostDedupeKey(preview.tournamentId, preview.roundId, preview.type, revision),
                bandKey: connection.bandKey,
                contentSnapshot: preview.content,
                requestedById: requestedById || null,
                status: 'PENDING',
            },
        });

        const accessToken = decryptBandToken(connection.accessTokenEncrypted);
        const permissions = await getPermissions(accessToken, connection.bandKey);
        if (!permissions.includes('posting')) {
            throw new BandApiError('BAND posting permission denied.', 'POSTING_PERMISSION_DENIED', 403);
        }

        const posted = await createPost({
            accessToken,
            bandKey: connection.bandKey,
            content: preview.content,
            doPush: connection.doPush === true,
        });

        await db.bandPost.update({
            where: { id: history.id },
            data: {
                status: 'SUCCESS',
                postKey: posted.postKey,
                postedAt: new Date(),
                errorCode: null,
                errorMessage: null,
            },
        });

        return {
            status: 'SUCCESS',
            message: 'BAND 게시를 완료했습니다.',
            postId: history.id,
            postKey: posted.postKey,
            revision,
        };
    } catch (error: any) {
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
        return {
            status: 'FAILED',
            message: bandErrorMessage(error),
            postId: history?.id,
            revision,
        };
    }
}

export async function publishPreparedBandPost(
    preview: BandPostPreview,
    requestedById?: string | null,
): Promise<BandPublishOutcome> {
    return publishPreview(preview, requestedById);
}

export async function publishManualBandPost(input: PublishInput): Promise<BandPublishOutcome> {
    const preview = await buildBandPostPreview(input);
    return publishPreparedBandPost(preview, input.requestedById);
}

// Legacy entry points remain available for existing callers/tests, but no status transition calls them.
export async function publishTournamentRecruitment(input: Omit<PublishInput, 'type'>): Promise<BandPublishOutcome> {
    return publishManualBandPost({ ...input, type: 'RECRUITMENT' });
}

export async function publishTournamentFinalResult(input: Omit<PublishInput, 'type'>): Promise<BandPublishOutcome> {
    return publishManualBandPost({ ...input, type: 'FINAL_RESULT' });
}

export async function republishBandPost(input: PublishInput): Promise<BandPublishOutcome> {
    return publishManualBandPost(input);
}

export async function sendBandTestPost(centerId: string): Promise<BandPublishOutcome> {
    const connection = await (prisma as any).bandConnection.findUnique({
        where: { centerId },
        include: { center: { select: { name: true } } },
    });
    if (!connection?.enabled || !connection.bandKey) {
        return { status: 'SKIPPED', message: '게시할 BAND를 먼저 선택해주세요.' };
    }
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
