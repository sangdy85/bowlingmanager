import prisma from '@/lib/prisma';
import { PUBLIC_ORIGIN } from '@/lib/public-web';
import { formatLane } from '@/lib/tournament-utils';
import { getChampRoundResults } from '@/app/actions/champ-results';
import { getIndividualLeaderboard, getWeeklyLeagueReport } from '@/app/actions/league-leaderboard';
import { getLeagueMatchTeamReport } from '@/lib/league-report';
import { buildLeagueWeeklyPost, isLeagueWeekReady } from './league-weekly-content';
import { buildFinalResultPost, buildLaneAssignmentPost, buildParticipantPost, buildRecruitmentPost } from './content';
import type { BandPostType, FinalResultEntry } from './types';

// Content generation never reads OAuth tokens, contacts BAND or writes post history.
export type BandAnnouncementInput = { tournamentId: string; roundId?: string | null; week?: number; allFinalResults?: boolean };
type PublishInput = BandAnnouncementInput;
export type BandAnnouncementOutcome = { status: 'SUCCESS'; message: string; centerId: string; type: BandPostType; content: string; roundId?: string | null }
    | { status: 'FAILED' | 'SKIPPED'; message: string };
function builtAnnouncement(input: BandAnnouncementInput & { centerId: string; type: BandPostType; content: string; autoFlag: string }): BandAnnouncementOutcome {
    return { status: 'SUCCESS', message: '공지 내용이 준비되었습니다.', centerId: input.centerId, roundId: input.roundId, type: input.type, content: input.content };
}
function parseSettings(raw: string | null | undefined): Record<string, any> {
    try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}
function publicUrl(path: string): string {
    return PUBLIC_ORIGIN + (path.startsWith('/') ? path : '/' + path);
}

async function buildTournamentRecruitment(input: PublishInput): Promise<BandAnnouncementOutcome> {
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
    return builtAnnouncement({ ...input, centerId: tournament.centerId, type: 'RECRUITMENT', content, autoFlag: 'autoRecruitment' });
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

async function buildRoundParticipants(input: PublishInput): Promise<BandAnnouncementOutcome> {
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

    return builtAnnouncement({
        ...input,
        centerId: tournament.centerId,
        type: 'PARTICIPANTS',
        content,
        autoFlag: 'autoRecruitment',
    });
}

async function buildRoundLaneAssignment(input: PublishInput): Promise<BandAnnouncementOutcome> {
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

    return builtAnnouncement({
        ...input,
        centerId: tournament.centerId,
        type: 'LANE_ASSIGNMENT',
        content,
        autoFlag: 'autoRecruitment',
    });
}

async function finalResultData(tournament: any, requestedRoundId?: string | null, allResults = false): Promise<{
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
        results: result.results.slice(0, allResults ? result.results.length : 3).map((entry: any) => ({
            name: entry.name,
            total: entry.total,
            average: entry.playedG ? entry.total / entry.playedG : null,
        })),
        participantCount: result.results.length,
        detailUrl: publicUrl(`/centers/${tournament.centerId}/tournaments/${tournament.id}/rounds/${round.id}/results`),
    };
}

async function buildTournamentFinalResult(input: PublishInput): Promise<BandAnnouncementOutcome> {
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
    const data = await finalResultData(tournament, input.roundId, input.allFinalResults);
    if (!data || data.results.length === 0) return { status: 'SKIPPED', message: '게시할 확정 결과가 없습니다.' };
    const content = buildFinalResultPost({
        title: data.roundNumber ? `${data.roundNumber}회차 최종 결과` : '대회 최종 결과',
        tournamentName: tournament.name,
        roundNumber: data.roundNumber,
        results: data.results,
        participantCount: data.participantCount,
        detailUrl: data.detailUrl,
        showAllResults: input.allFinalResults,
    });
    return builtAnnouncement({
        ...input,
        roundId: data.roundId,
        centerId: tournament.centerId,
        type: 'FINAL_RESULT',
        content,
        autoFlag: 'autoFinalResult',
    });
}


async function buildLeagueWeeklyResult(input: PublishInput): Promise<BandAnnouncementOutcome> {
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
                playersA: a.scores, playersB: b.scores, lanes: match.lanes, useStoredTeamTotals: match.useStoredTeamTotals === true,
            };
        }),
        averageTop: individual.top30,
        detailUrl: publicUrl(`/centers/${tournament.centerId}/tournaments/${tournament.id}?week=${round.roundNumber}`),
    });

    return builtAnnouncement({
        ...input,
        centerId: tournament.centerId,
        type: 'LEAGUE_WEEKLY_RESULT',
        content: results,
        autoFlag: 'autoFinalResult',
    });
}

export async function prepareBandAnnouncement(input: BandAnnouncementInput & { type: BandPostType }): Promise<BandAnnouncementOutcome> {
    switch (input.type) {
        case 'RECRUITMENT': return buildTournamentRecruitment(input);
        case 'PARTICIPANTS': return buildRoundParticipants(input);
        case 'LANE_ASSIGNMENT': return buildRoundLaneAssignment(input);
        case 'FINAL_RESULT': return buildTournamentFinalResult(input);
        case 'LEAGUE_WEEKLY_RESULT': return buildLeagueWeeklyResult(input);
    }
}
