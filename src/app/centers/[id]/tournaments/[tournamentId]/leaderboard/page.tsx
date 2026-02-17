import { getLeagueLeaderboard } from "@/app/actions/league-leaderboard";
import LeagueLeaderboard from "@/components/tournaments/LeagueLeaderboard";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import Link from "next/link";

export default async function LeaderboardPage({ params }: { params: { id: string, tournamentId: string } }) {
    const { id: centerId, tournamentId } = await params;

    const tournament = await prisma.tournament.findUnique({
        where: { id: tournamentId },
        select: { name: true }
    });

    if (!tournament) notFound();

    try {
        const leaderboardData = await getLeagueLeaderboard(tournamentId);

        return (
            <div className="container mx-auto py-8 space-y-4">
                <div className="flex justify-start px-4">
                    <Link
                        href={`/centers/${centerId}/tournaments/${tournamentId}`}
                        className="btn btn-secondary flex items-center gap-2 font-bold"
                    >
                        <span>←</span> 대회 상세페이지로 돌아가기
                    </Link>
                </div>
                <LeagueLeaderboard
                    data={leaderboardData}
                    title={tournament.name}
                />
                <div className="flex justify-center pb-8">
                    <Link
                        href={`/centers/${centerId}/tournaments/${tournamentId}`}
                        className="btn btn-secondary px-12 h-14 text-lg font-black shadow-xl border-2 border-black"
                    >
                        대회 상세페이지로 돌아가기
                    </Link>
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
