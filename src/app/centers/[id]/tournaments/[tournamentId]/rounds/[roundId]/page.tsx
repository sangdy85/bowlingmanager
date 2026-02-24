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

    // CHAMP - Calculate previous round winners automatically for negative handicap
    let prevRoundWinners: any = {};
    if (roundData.tournament.type === 'CHAMP' && roundData.roundNumber > 1) {
        const prevRound = await prisma.leagueRound.findFirst({
            where: { tournamentId, roundNumber: roundData.roundNumber - 1 },
            include: {
                participants: {
                    include: {
                        registration: { include: { user: true, team: true } }
                    }
                },
                individualScores: true,
                tournament: true
            }
        });

        if (prevRound) {
            const pSettings = prevRound.tournament.settings ? JSON.parse(prevRound.tournament.settings) : {};
            const gameCount = pSettings.gameCount || 3;

            const results = prevRound.participants.map((p: any) => {
                const pScores = prevRound.individualScores.filter((s: any) => s.registrationId === p.registrationId);
                let totalRaw = 0;
                let gamesPlayed = 0;
                const scores = [];
                for (let g = 1; g <= gameCount; g++) {
                    const s = pScores.find((sc: any) => sc.gameNumber === g)?.score || 0;
                    totalRaw += s;
                    scores.push(s);
                    if (s > 0) gamesPlayed++;
                }

                const validScores = scores.filter(s => s > 0);
                const hiLow = validScores.length > 1 ? (Math.max(...validScores) - Math.min(...validScores)) : 0;
                const handicap = p.registration.handicap || 0;

                // Treated consistently with RoundDetailPageContent.tsx:
                // Positive is per game, Negative is a fixed total subtraction.
                const positiveHandicapTotal = (handicap > 0 ? handicap : 0) * gamesPlayed;
                const negativeHandicapTotal = handicap < 0 ? Math.abs(handicap) : 0;
                const total = totalRaw + positiveHandicapTotal - negativeHandicapTotal;

                return {
                    name: p.registration.user?.name || p.registration.guestName || 'Unknown',
                    team: p.registration.guestTeamName || p.registration.team?.name || '개인회원',
                    total,
                    handicap,
                    hiLow,
                    isFemaleChamp: p.isFemaleChamp
                };
            });

            // Sort with User's requested tie-breakers: Lower Handicap -> Lower Hi-Low
            const sorted = results.sort((a: any, b: any) => {
                if (b.total !== a.total) return b.total - a.total;
                if (a.handicap !== b.handicap) return a.handicap - b.handicap;
                return a.hiLow - b.hiLow;
            });

            if (sorted.length > 0) prevRoundWinners.rank1 = { name: sorted[0].name, team: sorted[0].team };
            if (sorted.length > 1) prevRoundWinners.rank2 = { name: sorted[1].name, team: sorted[1].team };
            if (sorted.length > 2) prevRoundWinners.rank3 = { name: sorted[2].name, team: sorted[2].team };

            const femaleWinner = sorted.find((r: any) => r.isFemaleChamp);
            if (femaleWinner) prevRoundWinners.femaleChamp = { name: femaleWinner.name, team: femaleWinner.team };
        }
    }

    const safeRoundData = JSON.parse(JSON.stringify({
        ...roundData,
        date: roundData.date?.toISOString(),
        registrationStart: roundData.registrationStart?.toISOString(),
        effectiveDateStr: effectiveDate?.toISOString(),
        calculatedStatus,
        participants: augmentedParticipants,
        prevRoundWinners, // Add winners here
        tournament: {
            ...roundData.tournament,
            startDate: roundData.tournament.startDate?.toISOString(),
            endDate: roundData.tournament.endDate?.toISOString(),
            registrationStart: roundData.tournament.registrationStart?.toISOString()
        }
    }));

    // 2. Fetch All Rounds for navigation and tabs
    const allRoundsRaw = await prisma.leagueRound.findMany({
        where: { tournamentId },
        orderBy: { roundNumber: 'asc' },
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

    const allRounds = allRoundsRaw.map((r: any) => {
        const rEffectiveDate = getEffectiveRoundDate(r.date, roundData.tournament.leagueTime);
        const rStatus = calculateTournamentStatus(rEffectiveDate, r.registrationStart, r.date, roundData.tournament.status, now);

        return {
            ...r,
            date: r.date?.toISOString(),
            registrationStart: r.registrationStart?.toISOString(),
            effectiveDateStr: rEffectiveDate?.toISOString(),
            calculatedStatus: rStatus,
            participants: r.participants.map((p: any) => ({
                ...p,
                isManual: p.isManual === 1 || p.isManual === true
            }))
        };
    });

    // 3. Check Manager
    const center = await prisma.bowlingCenter.findUnique({
        where: { id: centerId },
        select: { ownerId: true, managers: { select: { id: true } } }
    });

    const isManager = center?.ownerId === session?.user?.id ||
        center?.managers.some((m: any) => m.id === session?.user?.id);

    // 4. Assemble final object and DEEP SERIALIZE to avoid Date objects in client props
    const finalRoundRaw = {
        ...safeRoundData,
        tournament: {
            ...safeRoundData.tournament,
            rounds: allRounds
        }
    };

    const finalRound = JSON.parse(JSON.stringify(finalRoundRaw));

    return <RoundDetailPageContent round={finalRound} userId={session?.user?.id} isManager={isManager} centerId={centerId} />;
}
