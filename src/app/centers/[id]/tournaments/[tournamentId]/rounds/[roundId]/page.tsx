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
            tournament: true,
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
    const augmentedParticipants = roundData.participants.map(p => ({
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
    const calculatedStatus = calculateTournamentStatus(effectiveDate, roundData.registrationStart, roundData.date, roundData.tournament.status, now);

    const safeRoundData = {
        ...roundData,
        date: roundData.date?.toISOString(),
        registrationStart: roundData.registrationStart?.toISOString(),
        effectiveDateStr: effectiveDate?.toISOString(),
        calculatedStatus,
        participants: augmentedParticipants,
        tournament: {
            ...roundData.tournament,
            startDate: roundData.tournament.startDate?.toISOString(),
            endDate: roundData.tournament.endDate?.toISOString(),
            registrationStart: roundData.tournament.registrationStart?.toISOString()
        }
    };

    // 2. Fetch All Rounds for navigation
    const allRoundsRaw = await prisma.leagueRound.findMany({
        where: { tournamentId },
        orderBy: { roundNumber: 'asc' },
        select: {
            id: true,
            roundNumber: true,
            date: true,
            registrationStart: true
        }
    });

    const allRounds = await Promise.all(allRoundsRaw.map(async (r: any) => {
        const participants: any[] = await prisma.$queryRaw`
            SELECT "registrationId", "lane" FROM "RoundParticipant" WHERE "roundId" = ${r.id}
        `;
        const rEffectiveDate = getEffectiveRoundDate(r.date, roundData.tournament.leagueTime);
        const rStatus = calculateTournamentStatus(rEffectiveDate, r.registrationStart, r.date, roundData.tournament.status, now);

        return {
            ...r,
            date: r.date?.toISOString(),
            registrationStart: r.registrationStart?.toISOString(),
            effectiveDateStr: rEffectiveDate?.toISOString(),
            calculatedStatus: rStatus,
            participants
        };
    }));

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
