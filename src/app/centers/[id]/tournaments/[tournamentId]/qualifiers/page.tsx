import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import GrandFinaleQualifiersList from "@/components/tournaments/GrandFinaleQualifiersList";
import { auth } from "@/auth";

export default async function QualifiersPage({ params }: { params: { id: string, tournamentId: string } }) {
    const { id: centerId, tournamentId } = await params;
    const session = await auth();

    const tournament = (await (prisma.tournament as any).findUnique({
        where: { id: tournamentId },
        include: {
            center: true,
            registrations: {
                include: { user: true, team: true }
            },
            leagueRounds: {
                orderBy: { roundNumber: 'asc' },
                include: {
                    participants: {
                        include: { registration: { include: { user: true, team: true } } }
                    },
                    individualScores: {
                        include: { registration: { include: { user: true, team: true } } }
                    }
                }
            }
        }
    })) as any;

    if (!tournament) notFound();

    const settings = tournament.settings ? JSON.parse(tournament.settings) : {};
    const qualifierIds = settings.grandFinalistIds || [];

    return (
        <main className="min-h-screen bg-slate-950 text-white">
            <GrandFinaleQualifiersList
                tournament={tournament}
                rounds={tournament.leagueRounds}
                registrations={tournament.registrations}
                qualifierIds={qualifierIds}
                centerId={centerId}
            />
        </main>
    );
}
