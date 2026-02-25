export const dynamic = 'force-dynamic';
export const revalidate = 0;

import GrandFinaleLeaderboardView from "@/components/tournaments/GrandFinaleLeaderboardView";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";

export default async function GrandFinaleLeaderboardPage({ params }: { params: { id: string, tournamentId: string } }) {
    const { id: centerId, tournamentId } = await params;

    // 1. Fetch Tournament
    const tournamentData = await prisma.tournament.findUnique({
        where: { id: tournamentId },
        include: {
            registrations: {
                include: { user: true, team: true }
            }
        }
    });

    if (!tournamentData) notFound();

    // 2. Fetch ALL Rounds to match RoundDetailPage logic
    const allRoundsRaw = await prisma.leagueRound.findMany({
        where: { tournamentId },
        orderBy: { roundNumber: 'asc' },
        include: {
            participants: {
                include: {
                    registration: {
                        include: { user: true, team: true }
                    }
                }
            },
            individualScores: {
                include: {
                    registration: {
                        include: { user: true, team: true }
                    }
                }
            }
        }
    });

    const settings = tournamentData.settings ? JSON.parse(tournamentData.settings) : {};
    const hasGrandFinale = settings.hasGrandFinale || 'NONE';
    const grandFinalePoints = settings.grandFinalePoints || {};

    // 3. Explicit Serialization (Standardize data for client components)
    // This is crucial to prevent Date objects from causing serialization errors or stale data
    const serializedRounds = JSON.parse(JSON.stringify(allRoundsRaw));
    const serializedTournament = JSON.parse(JSON.stringify(tournamentData));

    // Filter rounds that have at least one score
    const finishedRounds = serializedRounds.filter((r: any) => r.individualScores && r.individualScores.length > 0);

    // Merge rounds into tournament object for GrandFinaleCumulativeManager
    const tournamentWithRounds = {
        ...serializedTournament,
        leagueRounds: serializedRounds
    };

    return (
        <GrandFinaleLeaderboardView
            centerId={centerId}
            tournamentId={tournamentId}
            tournament={tournamentWithRounds}
            finishedRounds={finishedRounds}
            pointConfig={grandFinalePoints}
            hasGrandFinale={hasGrandFinale}
        />
    );
}
