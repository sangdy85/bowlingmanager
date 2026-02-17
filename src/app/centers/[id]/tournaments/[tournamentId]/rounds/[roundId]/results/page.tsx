import { getChampRoundResults } from "@/app/actions/champ-results";
import { getLeagueRoundResults } from "@/app/actions/league-results";
import RoundResultLeaderboard from "@/components/tournaments/RoundResultLeaderboard";
import LeagueRoundResultTabs from "@/components/tournaments/LeagueRoundResultTabs";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import Link from "next/link";

const { id: centerId, tournamentId, roundId } = await params;
const { from } = await searchParams;
const session = await auth();

const backUrl = from === 'recruit'
    ? `/centers/${centerId}/tournaments/${tournamentId}?mode=recruit`
    : `/centers/${centerId}/tournaments/${tournamentId}`;

const tournament = (await (prisma as any).tournament.findUnique({
    where: { id: tournamentId },
    include: {
        center: {
            include: { managers: true }
        }
    }
})) as any;

if (!tournament) notFound();

const isManager = tournament.center.managers.some((m: any) => m.id === session?.user?.id) || tournament.center.ownerId === session?.user?.id;

try {
    if (tournament.type === 'LEAGUE') {
        const leagueData = await getLeagueRoundResults(roundId);

        return (
            <div className="container mx-auto py-8 space-y-4 max-w-7xl">
                <div className="flex justify-start px-4">
                    <Link
                        href={backUrl}
                        className="btn bg-white border-2 border-black text-black flex items-center gap-2 font-black shadow-lg hover:bg-slate-50"
                    >
                        <span>←</span> 대회 상세페이지로 돌아가기
                    </Link>
                </div>

                <LeagueRoundResultTabs
                    round={leagueData}
                    tournamentName={tournament.name}
                    teamHandicapLimit={leagueData.teamHandicapLimit}
                    isManager={isManager}
                />

                <div className="flex justify-center pb-8 pt-6">
                    <Link
                        href={backUrl}
                        className="btn btn-secondary px-12 h-14 text-lg font-black shadow-xl border-2 border-black bg-slate-100 hover:bg-slate-200"
                    >
                        대회 상세페이지로 돌아가기
                    </Link>
                </div>
            </div>
        );
    } else {
        const resultsData = await getChampRoundResults(roundId);

        return (
            <div className="container mx-auto py-8 space-y-4 max-w-7xl">
                <div className="flex justify-start px-4">
                    <Link
                        href={backUrl}
                        className="btn bg-white border-2 border-black text-black flex items-center gap-2 font-black shadow-lg hover:bg-slate-50"
                    >
                        <span>←</span> 대회 상세페이지로 돌아가기
                    </Link>
                </div>

                <RoundResultLeaderboard
                    data={resultsData}
                    title={tournament.name}
                />

                <div className="flex justify-center pb-8 pt-6">
                    <Link
                        href={backUrl}
                        className="btn btn-secondary px-12 h-14 text-lg font-black shadow-xl border-2 border-black bg-slate-100 hover:bg-slate-200"
                    >
                        대회 상세페이지로 돌아가기
                    </Link>
                </div>
            </div>
        );
    }
} catch (error: any) {
    return (
        <div className="container mx-auto py-8 text-center bg-white rounded-3xl border-2 border-black p-10 m-4">
            <h1 className="text-3xl font-black text-red-600 mb-4">결과를 불러오는 중 오류가 발생했습니다.</h1>
            <p className="font-bold text-gray-500">{error.message}</p>
            <Link
                href={backUrl}
                className="btn btn-primary mt-8 px-10 border-2 border-black font-black"
            >
                대회 페이지로 돌아가기
            </Link>
        </div>
    );
}
}
