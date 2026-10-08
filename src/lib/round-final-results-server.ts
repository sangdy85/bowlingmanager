import prisma from '@/lib/prisma';
import { getRoundFinalResults } from '@/lib/round-final-results';

type PreviousWinner = { name: string; team: string };
type PreviousWinners = {
    rank1?: PreviousWinner;
    rank2?: PreviousWinner;
    rank3?: PreviousWinner;
    femaleChamp?: PreviousWinner;
};

function parseSettings(raw: string | null | undefined): Record<string, any> {
    try {
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

// Mirrors the sequential winner tracking used by the round detail page.
// The returned previous-winner context is then consumed by getRoundFinalResults,
// so BAND final-result posts use the same scoring rules as the visible result tab.
export function getPreviousWinnersForRound(
    rounds: ReadonlyArray<any>,
    targetRoundId: string,
    settings: Record<string, any>,
): PreviousWinners {
    let runningPrevWinners: PreviousWinners = {};
    const gameCount = settings.gameCount || 3;

    for (const round of rounds) {
        const currentRoundPrevWinners = { ...runningPrevWinners };
        if (round.id === targetRoundId) {
            return currentRoundPrevWinners;
        }

        const roundHandicaps = settings.roundMinusHandicaps?.[round.roundNumber] || {
            rank1: settings.minusHandicapRank1 || 0,
            rank2: settings.minusHandicapRank2 || 0,
            rank3: settings.minusHandicapRank3 || 0,
            female: settings.minusHandicapFemale || 0,
        };

        const rankings = round.participants
            .map((participant: any) => {
                const participantScores = round.individualScores.filter(
                    (score: any) => score.registrationId === participant.registrationId,
                );
                const scoreList: number[] = [];
                let totalWithPlusHandicap = 0;
                let gamesPlayed = 0;

                const currentRoundHandicap =
                    participant.handicap ?? participant.registration?.handicap ?? 0;
                const plusHandicap = currentRoundHandicap > 0 ? currentRoundHandicap : 0;

                for (let game = 1; game <= gameCount; game++) {
                    const score =
                        participantScores.find((item: any) => item.gameNumber === game)?.score || 0;
                    scoreList.push(score);
                    if (score > 0) {
                        totalWithPlusHandicap += Math.min(score + plusHandicap, 300);
                        gamesPlayed++;
                    }
                }

                const handicap = currentRoundHandicap;
                const name =
                    participant.registration?.guestName ??
                    participant.registration?.user?.name ??
                    'Unknown';
                const team =
                    (participant.registration?.guestTeamName ??
                        participant.registration?.team?.name) ||
                    '개인';

                let minusApplied = 0;
                let rankCap = 0;

                if (gamesPlayed === gameCount) {
                    const matchWinner = (winner?: PreviousWinner) =>
                        winner && winner.name === name && winner.team === team;

                    if (matchWinner(currentRoundPrevWinners.rank1)) {
                        minusApplied += Math.abs(roundHandicaps.rank1);
                        rankCap = Math.abs(roundHandicaps.rank1);
                    } else if (matchWinner(currentRoundPrevWinners.rank2)) {
                        minusApplied += Math.abs(roundHandicaps.rank2);
                        rankCap = Math.abs(roundHandicaps.rank2);
                    } else if (matchWinner(currentRoundPrevWinners.rank3)) {
                        minusApplied += Math.abs(roundHandicaps.rank3);
                        rankCap = Math.abs(roundHandicaps.rank3);
                    }

                    if (matchWinner(currentRoundPrevWinners.femaleChamp)) {
                        minusApplied += Math.abs(roundHandicaps.female);
                        if (rankCap === 0) rankCap = Math.abs(roundHandicaps.female);
                    }

                    if (minusApplied > rankCap && rankCap > 0) {
                        minusApplied = rankCap;
                    }
                }

                const manualPenaltyTotal = handicap < 0 ? Math.abs(handicap) : 0;
                const finalPenaltyTotal = Math.max(manualPenaltyTotal, minusApplied);
                const total = totalWithPlusHandicap - finalPenaltyTotal;

                const validScores = scoreList.filter(score => score > 0);
                const hiLow =
                    validScores.length > 1
                        ? Math.max(...validScores) - Math.min(...validScores)
                        : 0;

                return {
                    name,
                    team,
                    total,
                    handicap,
                    hiLow,
                    isFemaleChamp: participant.isFemaleChamp,
                };
            })
            .filter((entry: any) => entry.total > 0)
            .sort((a: any, b: any) => {
                if (b.total !== a.total) return b.total - a.total;
                if (a.handicap !== b.handicap) return a.handicap - b.handicap;
                return a.hiLow - b.hiLow;
            });

        runningPrevWinners = {};
        if (rankings.length > 0) {
            runningPrevWinners.rank1 = {
                name: rankings[0].name,
                team: rankings[0].team,
            };
        }
        if (rankings.length > 1) {
            runningPrevWinners.rank2 = {
                name: rankings[1].name,
                team: rankings[1].team,
            };
        }
        if (rankings.length > 2) {
            runningPrevWinners.rank3 = {
                name: rankings[2].name,
                team: rankings[2].team,
            };
        }

        const femaleWinner = rankings.find((entry: any) => entry.isFemaleChamp);
        if (femaleWinner) {
            runningPrevWinners.femaleChamp = {
                name: femaleWinner.name,
                team: femaleWinner.team,
            };
        }
    }

    throw new Error('결과를 계산할 회차를 찾을 수 없습니다.');
}

export async function getRoundFinalResultSnapshot(roundId: string) {
    const target = await prisma.leagueRound.findUnique({
        where: { id: roundId },
        include: {
            tournament: true,
            participants: {
                include: {
                    registration: {
                        include: {
                            user: true,
                            team: true,
                        },
                    },
                },
            },
            individualScores: true,
        },
    });

    if (!target) {
        throw new Error('회차를 찾을 수 없습니다.');
    }

    const rounds = await prisma.leagueRound.findMany({
        where: { tournamentId: target.tournamentId },
        orderBy: { roundNumber: 'asc' },
        include: {
            participants: {
                include: {
                    registration: {
                        include: {
                            user: true,
                            team: true,
                        },
                    },
                },
            },
            individualScores: true,
        },
    });

    const settings = parseSettings(target.tournament.settings);
    const prevRoundWinners = getPreviousWinnersForRound(rounds, roundId, settings);

    const roundForResult = {
        ...target,
        prevRoundWinners,
    };

    const finalResult = getRoundFinalResults(roundForResult);
    const maxParticipants =
        settings.roundMaxParticipants?.[target.roundNumber] ??
        target.tournament.maxParticipants ??
        settings.maxParticipants ??
        0;
    const activeParticipantCount =
        ['CHAMP', 'EVENT'].includes(target.tournament.type) && maxParticipants > 0
            ? Math.min(target.participants.length, maxParticipants)
            : target.participants.length;

    return {
        ...finalResult,
        roundNumber: target.roundNumber,
        tournamentId: target.tournamentId,
        tournamentName: target.tournament.name,
        centerId: target.tournament.centerId,
        participantCount: activeParticipantCount,
    };
}
