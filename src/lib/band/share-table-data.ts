import prisma from '@/lib/prisma';
import { getRoundFinalResults } from '@/lib/round-final-results';
import { getNextRoundWinners } from '@/lib/round-previous-winners';
import { formatLane } from '@/lib/tournament-utils';
import type { BandShareTable } from './share-table';

// Called only after the sharing action verifies the center, tournament, round
// and completion state. Return display fields only, never raw account records.
export async function getBandShareTableData(tournamentId: string, roundId: string, kind: BandShareTable['kind'], centerId: string): Promise<BandShareTable> {
    const tournament = await prisma.tournament.findUnique({
        where: { id: tournamentId, centerId },
        select: { centerId: true, name: true, type: true, settings: true, maxParticipants: true, leagueRounds: {
            orderBy: { roundNumber: 'asc' },
            select: { id: true, roundNumber: true,
                participants: { select: { id: true, registrationId: true, createdAt: true, lane: true, handicap: true, isFemaleChamp: true,
                    registration: { select: { guestName: true, guestTeamName: true, handicap: true, entryGroupId: true,
                        user: { select: { name: true } }, team: { select: { name: true } } } } } },
                individualScores: { select: { registrationId: true, gameNumber: true, score: true } }
            }
        } }
    });
    const round = tournament?.leagueRounds.find(item => item.id === roundId);
    if (!tournament || tournament.centerId !== centerId || !round || !['CHAMP', 'EVENT'].includes(tournament.type)) throw Error('표를 만들 회차를 확인해주세요.');
    const settings = tournament.settings ? JSON.parse(tournament.settings) : {};
    const label = { PARTICIPANTS: '참가자 명단', LANE_ASSIGNMENT: '레인 배정', FINAL_RESULT: '결과' }[kind];
    const title = `${tournament.name} ${round.roundNumber}회차 ${label}`;
    const display = (p: typeof round.participants[number]) => [
        (p.registration.guestTeamName ?? p.registration.team?.name) || '개인',
        p.registration.guestName ?? p.registration.user?.name ?? '이름 미등록'
    ];
    const ordered = [...round.participants].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const limit = settings.roundMaxParticipants?.[round.roundNumber] ?? tournament.maxParticipants ?? 0;
    if (kind === 'PARTICIPANTS') return {
        kind, title, twoColumns: true,
        columns: [{ label: '번호', width: 48 }, { label: '팀', width: 145 }, { label: '성함', width: 160, bold: true }, { label: '구분', width: 100 }],
        rows: ordered.map((p, index) => ({ cells: [String(index + 1), ...display(p), limit > 0 && index >= limit ? '대기' : '참가'] }))
    };
    if (kind === 'LANE_ASSIGNMENT') {
        const active = limit > 0 ? ordered.slice(0, limit) : ordered;
        if (!active.length || active.some(p => !Number.isInteger(p.lane) || p.lane! < 11)) throw Error('레인 배정을 다시 확인해주세요.');
        return { kind, title, twoColumns: true,
            columns: [{ label: '번호', width: 48 }, { label: '레인-자리', width: 100, bold: true }, { label: '팀', width: 145 }, { label: '성함', width: 160, bold: true }],
            rows: [...active].sort((a, b) => a.lane! - b.lane!).map((p, index) => ({ cells: [String(index + 1), formatLane(p.lane!), ...display(p)] }))
        };
    }
    const gameCountSetting = settings.gameCount ?? 3;
    const active = limit > 0 ? ordered.slice(0, limit) : ordered;
    if (!Number.isSafeInteger(gameCountSetting) || gameCountSetting < 1 || gameCountSetting > 100 || !active.length ||
        active.some(p => Array.from({ length: gameCountSetting }, (_, i) => i + 1).some(game =>
            !round.individualScores.some(score => score.registrationId === p.registrationId && score.gameNumber === game &&
                Number.isInteger(score.score) && score.score >= 0 && score.score <= 300)))) throw Error('최신 경기 점수 입력을 다시 확인해주세요.');
    let previous: any = {};
    for (const earlier of tournament.leagueRounds) {
        if (earlier.id === round.id) break;
        previous = getNextRoundWinners(earlier, settings, previous);
    }
    const { sortedResults, gameCount, isTeamEvent } = getRoundFinalResults({ ...round, tournament, prevRoundWinners: previous });
    return { kind, title, twoColumns: !isTeamEvent && gameCount <= 6, rowUnit: isTeamEvent ? '팀' : '명',
        columns: [{ label: '순위', width: 42 }, { label: '팀', width: 112 }, { label: '성함', width: 118, bold: true },
            ...Array.from({ length: gameCount }, (_, i) => ({ label: `${i + 1}G`, width: 62 })),
            { label: '핸디', width: 64 }, { label: '총점', width: 76, bold: true }],
        rows: sortedResults.map((r: any, index: number) => ({
            cells: [String(index + 1), r.team, r.name + (r.isFemaleChamp ? ' (여챔)' : ''),
                ...r.scores.map((s: number) => s > 0 ? String(r.isTeam ? s : Math.min(s + r.handicapEach, 300)) : ''), String(r.totalHandicap), String(r.total)],
            highlight: index < 3 || r.isFemaleChamp,
            redColumns: r.hasMinusHandicap ? [3 + gameCount] : []
        }))
    };
}
