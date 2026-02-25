import { auth } from "@/auth";
import { notFound, redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import Link from "next/link";
import RoundDetailPageContent from "@/components/tournaments/RoundDetailPageContent";

import { calculateTournamentStatus, getEffectiveRoundDate } from "@/lib/tournament-utils";

export default async function RoundDetailPage({ params }: { params: { id: string, tournamentId: string, roundId: string } }) {
    const { id: centerId, tournamentId, roundId } = await params;
    const session = await auth();
    const now = new Date();

    // 1. Fetch Round with relations
    // ... (rest of the fetch logic stays same but we process results)
    const roundData = await prisma.leagueRound.findUnique({
        where: { id: roundId },
        include: {
            tournament: {
                include: {
                    registrations: {
                        include: {
                            user: true,
                            team: true
                        }
                    }
                }
            },
            participants: {
                include: {
                    registration: {
                        include: {
                            user: true,
                            team: true
                        }
                    }
                }
            },
            individualScores: true,
            matchups: {
                include: {
                    teamA: true,
                    teamB: true
                }
            },
            rawScores: true
        }
    });

    if (!roundData) notFound();

    // Parse tournament settings
    let tournamentSettings: any = {};
    try {
        if (roundData.tournament.settings) tournamentSettings = JSON.parse(roundData.tournament.settings);
    } catch (e) {
        console.error("Failed to parse settings", e);
    }

    // Augment current round participants with isManual
    const manualStatus: any[] = await prisma.$queryRaw`
        SELECT "id", "isManual" FROM "RoundParticipant" WHERE "roundId" = ${roundId}
    `;

    // Merge manual status into participants
    const augmentedParticipants = roundData.participants.map((p: any) => ({
        ...p,
        isManual: manualStatus.find(m => m.id === p.id)?.isManual === 1 || manualStatus.find(m => m.id === p.id)?.isManual === true,
        // Serialize Dates inside participants
        registration: {
            ...p.registration,
            createdAt: p.registration.createdAt?.toISOString(),
            updatedAt: p.registration.updatedAt?.toISOString()
        }
    }));

    // Calculate current round status
    const effectiveDate = getEffectiveRoundDate(roundData.date, roundData.tournament.leagueTime);
    const calculatedStatus = calculateTournamentStatus(
        effectiveDate,
        roundData.registrationStart || tournamentSettings.registrationStart,
        roundData.date,
        roundData.tournament.status,
        now
    );

    // 2. Fetch All Rounds for sequential winner tracking & navigation
    const allRoundsRaw = await prisma.leagueRound.findMany({
        orderBy: { roundNumber: 'asc' },
        where: { tournamentId },
        include: {
            participants: {
                include: {
                    registration: {
                        include: {
                            user: true,
                            team: true
                        }
                    }
                }
            },
            individualScores: true
        }
    });

    // 3. Sequential winner tracking (CHAMP type logic)
    let runningPrevWinners: any = {};
    const processedRounds = [];
    const gameCount = tournamentSettings.gameCount || 3;

    for (const r of allRoundsRaw) {
        const currentRoundPrevWinners = { ...runningPrevWinners };

        // Even for non-CHAMP, we track but only CHAMP uses it for handicap
        const roundHandicaps = tournamentSettings.roundMinusHandicaps?.[r.roundNumber] || {
            rank1: tournamentSettings.minusHandicapRank1 || 0,
            rank2: tournamentSettings.minusHandicapRank2 || 0,
            rank3: tournamentSettings.minusHandicapRank3 || 0,
            female: tournamentSettings.minusHandicapFemale || 0
        };

        const rankings = r.participants.map((p: any) => {
            const pScores = r.individualScores.filter((s: any) => s.registrationId === p.registrationId);
            const scoreList: number[] = [];
            let totalRaw = 0;
            let gamesPlayed = 0;
            for (let g = 1; g <= gameCount; g++) {
                const s = pScores.find((sc: any) => sc.gameNumber === g)?.score || 0;
                scoreList.push(s);
                totalRaw += s;
                if (s > 0) gamesPlayed++;
            }

            const handicap = p.registration.handicap || 0;
            const pName = p.registration.user?.name || p.registration.guestName || 'Unknown';
            const pTeam = p.registration.guestTeamName || p.registration.team?.name || '개인';

            let minusApplied = 0;
            let rankCap = 0;
            // Negative handicap logic (Capped by rank winner)
            if (gamesPlayed === gameCount) {
                const matchWinner = (winner: any) => winner && winner.name === pName && winner.team === pTeam;
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
                if (minusApplied > rankCap && rankCap > 0) minusApplied = rankCap;
            }

            const manualPenaltyTotal = handicap < 0 ? Math.abs(handicap) : 0;
            const finalPenaltyTotal = Math.max(manualPenaltyTotal, minusApplied);
            const positiveHandicapTotal = (handicap > 0 ? handicap : 0) * gamesPlayed;
            const total = totalRaw + positiveHandicapTotal - finalPenaltyTotal;

            const validScores = scoreList.filter(s => s > 0);
            const hiLow = validScores.length > 1 ? (Math.max(...validScores) - Math.min(...validScores)) : 0;

            return {
                name: pName,
                team: pTeam,
                total,
                handicap,
                hiLow,
                isFemaleChamp: p.isFemaleChamp
            };
        })
            .filter(entry => entry.total > 0)
            .sort((a: any, b: any) => {
                if (b.total !== a.total) return b.total - a.total;
                if (a.handicap !== b.handicap) return a.handicap - b.handicap;
                return a.hiLow - b.hiLow;
            });

        // Set winners for NEXT round
        runningPrevWinners = {};
        if (rankings.length > 0) runningPrevWinners.rank1 = { name: rankings[0].name, team: rankings[0].team };
        if (rankings.length > 1) runningPrevWinners.rank2 = { name: rankings[1].name, team: rankings[1].team };
        if (rankings.length > 2) runningPrevWinners.rank3 = { name: rankings[2].name, team: rankings[2].team };
        const fWinner = rankings.find(r => r.isFemaleChamp);
        if (fWinner) runningPrevWinners.femaleChamp = { name: fWinner.name, team: fWinner.team };

        // Prepare for client serialization
        const rEffectiveDate = getEffectiveRoundDate(r.date, roundData.tournament.leagueTime);
        const rStatus = calculateTournamentStatus(rEffectiveDate, r.registrationStart, r.date, roundData.tournament.status, now);

        processedRounds.push({
            ...r,
            date: r.date?.toISOString(),
            registrationStart: r.registrationStart?.toISOString(),
            effectiveDateStr: rEffectiveDate?.toISOString(),
            calculatedStatus: rStatus,
            prevRoundWinners: currentRoundPrevWinners, // History attached to each round
            participants: r.participants.map((p: any) => ({
                ...p,
                isManual: p.isManual === 1 || p.isManual === true
            }))
        });
    }

    // 4. Augment current round specifically
    const currentProcessedRound = processedRounds.find(r => r.id === roundId);
    if (!currentProcessedRound) notFound();

    const finalParticipants = roundData.participants.map((p: any) => ({
        ...p,
        isManual: processedRounds.find(r => r.id === roundId)?.participants.find((rp: any) => rp.id === p.id)?.isManual || false,
        registration: {
            ...p.registration,
            createdAt: p.registration.createdAt?.toISOString(),
            updatedAt: p.registration.updatedAt?.toISOString()
        }
    }));

    // Assemble final object
    const finalRoundRaw = {
        ...currentProcessedRound,
        participants: finalParticipants,
        matchups: roundData.matchups, // Carry over matchups
        rawScores: roundData.rawScores, // Carry over raw scores
        tournament: {
            ...roundData.tournament,
            startDate: roundData.tournament.startDate?.toISOString(),
            endDate: roundData.tournament.endDate?.toISOString(),
            registrationStart: roundData.tournament.registrationStart?.toISOString(),
            rounds: processedRounds
        }
    };

    // 5. Final deep serialization
    const finalRound = JSON.parse(JSON.stringify(finalRoundRaw));

    // 6. Check Manager status
    const center = await prisma.bowlingCenter.findUnique({
        where: { id: centerId },
        select: { ownerId: true, managers: { select: { id: true } } }
    });
    const isManager = center?.ownerId === session?.user?.id ||
        center?.managers.some((m: any) => m.id === session?.user?.id);

    return <RoundDetailPageContent round={finalRound} userId={session?.user?.id} isManager={isManager} centerId={centerId} />;
}
