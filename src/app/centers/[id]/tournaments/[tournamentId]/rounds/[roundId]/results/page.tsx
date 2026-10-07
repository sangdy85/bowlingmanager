import { getChampRoundResults } from "@/app/actions/champ-results";
import { getLeagueRoundResults } from "@/app/actions/league-results";
import RoundResultLeaderboard from "@/components/tournaments/RoundResultLeaderboard";
import LeagueRoundResultTabs from "@/components/tournaments/LeagueRoundResultTabs";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { ManagementBackLink } from "@/components/tournaments/ManagementUI";

export default async function ResultsPage({ params, searchParams }: any) {
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
                        <ManagementBackLink href={backUrl} />
                    </div>

                    <LeagueRoundResultTabs
                        round={leagueData}
                        tournamentName={tournament.name}
                        teamHandicapLimit={leagueData.teamHandicapLimit}
                        isManager={isManager}
                        centerId={centerId}
                        tournamentId={tournamentId}
                    />

                    <div className="flex justify-center pb-8 pt-6">
                        <ManagementBackLink href={backUrl} />
                    </div>
                </div>
            );
        } else {
            const resultsData = await getChampRoundResults(roundId);

            return (
                <div className="container mx-auto py-8 space-y-4 max-w-7xl">
                    <div className="flex justify-start px-4">
                        <ManagementBackLink href={backUrl} />
                    </div>

                    <RoundResultLeaderboard
                        data={resultsData}
                        title={tournament.name}
                    />

                    <div className="flex justify-center pb-8 pt-6">
                        <ManagementBackLink href={backUrl} />
                    </div>
                </div>
            );
        }
    } catch (error: any) {
        return (
            <div className="container mx-auto py-8 text-center bg-white rounded-3xl border-2 border-black p-10 m-4">
                <h1 className="text-3xl font-black text-red-600 mb-4">결과를 불러오는 중 오류가 발생했습니다.</h1>
                <p className="font-bold text-gray-500">{error.message}</p>
                <ManagementBackLink href={backUrl} />
            </div>
        );
    }
}
