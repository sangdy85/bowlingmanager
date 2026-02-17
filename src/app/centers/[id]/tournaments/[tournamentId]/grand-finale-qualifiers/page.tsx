import GrandFinaleQualifiersStatus from "@/components/tournaments/GrandFinaleQualifiersStatus";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function GrandFinaleQualifiersPage({ params }: { params: { id: string, tournamentId: string } }) {
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
                        include: { registration: { include: { user: true } } }
                    }
                }
            }
        }
    })) as any;

    if (!tournament) notFound();

    const settings = tournament.settings ? JSON.parse(tournament.settings) : {};
    const qualifierIds = settings.grandFinalistIds || [];

    return (
        <div className="min-h-screen bg-slate-50 py-12 px-4">
            <div className="max-w-4xl mx-auto space-y-8">
                <div className="flex justify-start">
                    <Link
                        href={`/centers/${centerId}/tournaments/${tournamentId}`}
                        className="flex items-center gap-2 text-sm font-black text-slate-500 hover:text-primary transition-colors"
                    >
                        <span>←</span> 대회 홈으로 돌아가기
                    </Link>
                </div>

                <div className="bg-slate-900 rounded-3xl p-8 shadow-2xl border-4 border-black">
                    <div className="mb-8">
                        <h1 className="text-3xl font-black text-white italic mb-2">🏆 왕중왕전 진출자 명단</h1>
                        <p className="text-slate-400 font-bold">{tournament.name}</p>
                    </div>

                    <GrandFinaleQualifiersStatus
                        rounds={tournament.leagueRounds}
                        registrations={tournament.registrations}
                        qualifierIds={qualifierIds}
                        onClose={() => { }}
                    />
                </div>
            </div>
        </div>
    );
}
