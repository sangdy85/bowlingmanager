import GrandFinaleLeaderboardView from "@/components/tournaments/GrandFinaleLeaderboardView";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";

export default async function GrandFinaleLeaderboardPage({ params }: { params: { id: string, tournamentId: string } }) {
    // ... (fetch logic remains same)
    const { id: centerId, tournamentId } = await params;

    const tournament = (await (prisma.tournament as any).findUnique({
        where: { id: tournamentId },
        include: {
            registrations: {
                include: { user: true, team: true }
            },
            leagueRounds: {
                orderBy: { roundNumber: 'asc' },
                include: {
                    participants: {
                        include: { registration: true }
                    },
                    individualScores: {
                        include: {
                            registration: {
                                include: { user: true, team: true }
                            }
                        }
                    }
                }
            }
        }
    })) as any;

    if (!tournament) notFound();

    const settings = tournament.settings ? JSON.parse(tournament.settings) : {};
    const hasGrandFinale = settings.hasGrandFinale || 'NONE';
    const grandFinalePoints = settings.grandFinalePoints || {};

    const finishedRounds = tournament.leagueRounds.filter((r: any) => r.individualScores.length > 0);

    return (
        <GrandFinaleLeaderboardView
            centerId={centerId}
            tournamentId={tournamentId}
            tournament={tournament}
            finishedRounds={finishedRounds}
            pointConfig={grandFinalePoints}
            hasGrandFinale={hasGrandFinale}
        />
    );
}
