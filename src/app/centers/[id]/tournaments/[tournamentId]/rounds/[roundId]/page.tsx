import { auth } from "@/auth";
import { notFound, redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import Link from "next/link";
import RoundDetailPageContent from "@/components/tournaments/RoundDetailPageContent";

export default async function RoundDetailPage({ params }: { params: { id: string, tournamentId: string, roundId: string } }) {
    const { id: centerId, tournamentId, roundId } = await params;
    const session = await auth();

    // 1. Fetch Round with relations
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

    // Augment current round participants with isManual (bypass Prisma Client issue)
    const manualStatus: any[] = await prisma.$queryRaw`
        SELECT "id", "isManual" FROM "RoundParticipant" WHERE "roundId" = ${roundId}
    `;

    // Merge manual status into participants
    const augmentedParticipants = roundData.participants.map(p => ({
        ...p,
        isManual: manualStatus.find(m => m.id === p.id)?.isManual === 1 || manualStatus.find(m => m.id === p.id)?.isManual === true
    }));

    const finalRoundData = {
        ...roundData,
        participants: augmentedParticipants
    };

    // 2. Fetch All Rounds for navigation (lightweight)
    const allRoundsRaw = await prisma.leagueRound.findMany({
        where: { tournamentId },
        orderBy: { roundNumber: 'asc' },
        select: {
            id: true,
            roundNumber: true
        }
    });

    const allRounds = await Promise.all(allRoundsRaw.map(async (r: any) => {
        const participants: any[] = await prisma.$queryRaw`
            SELECT "registrationId", "lane", "isManual" 
            FROM "RoundParticipant" 
            WHERE "roundId" = ${r.id}
        `;
        return {
            ...r,
            participants
        };
    }));

    // 3. Check Manager (Optimized)
    const center = await prisma.bowlingCenter.findUnique({
        where: { id: centerId },
        select: { ownerId: true, managers: { select: { id: true } } }
    });

    const isManager = center?.ownerId === session?.user?.id ||
        center?.managers.some((m: any) => m.id === session?.user?.id);

    // 4. Assemble final object to match expected structure
    // We need to inject 'rounds' into tournament object
    const round = {
        ...finalRoundData,
        tournament: {
            ...finalRoundData.tournament,
            rounds: allRounds
        }
    };

    return <RoundDetailPageContent round={round} userId={session?.user?.id} isManager={isManager} centerId={centerId} />;
}
