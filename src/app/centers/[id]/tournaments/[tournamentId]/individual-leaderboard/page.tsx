import { getIndividualLeaderboard } from "@/app/actions/league-leaderboard";
export const dynamic = 'force-dynamic';
import IndividualLeaderboard from "@/components/tournaments/IndividualLeaderboard";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { ManagementBackLink } from "@/components/tournaments/ManagementUI";

export default async function IndividualLeaderboardPage({ params }: { params: Promise<{ id: string, tournamentId: string }> }) {
    const { id: centerId, tournamentId } = await params;

    const tournament = await prisma.tournament.findUnique({
        where: { id: tournamentId },
        select: { name: true }
    });

    if (!tournament) notFound();

    try {
        const leaderboardData = await getIndividualLeaderboard(tournamentId);

        return (
            <div className="container mx-auto py-8 space-y-4">
                <div className="flex justify-start px-4">
                    <ManagementBackLink href={`/centers/${centerId}/tournaments/${tournamentId}`} />
                </div>

                <IndividualLeaderboard
                    data={leaderboardData}
                    title={tournament.name}
                />

                <div className="flex justify-center pb-8">
                    <ManagementBackLink href={`/centers/${centerId}/tournaments/${tournamentId}`} />
                </div>
            </div>
        );
    } catch (error: any) {
        return (
            <div className="container mx-auto py-8 text-center">
                <h1 className="text-2xl font-bold text-red-500 mb-4">순위표를 불러오는 중 오류가 발생했습니다.</h1>
                <p>{error.message}</p>
            </div>
        );
    }
}
