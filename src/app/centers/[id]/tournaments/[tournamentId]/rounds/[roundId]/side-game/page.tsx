import { auth } from "@/auth";
import { notFound, redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import Link from "next/link";
import SideGameManager from "@/components/tournaments/SideGameManager";

export default async function MemberSideGameResultPage({ params, searchParams }: { params: { id: string, tournamentId: string, roundId: string }, searchParams: { from?: string } }) {
    const { id: centerId, tournamentId, roundId } = await params;
    const { from } = await searchParams;
    const session = await auth();

    // 1. Fetch Round with necessary relations for SideGameManager
    const roundData = await prisma.leagueRound.findUnique({
        where: { id: roundId },
        include: {
            tournament: {
                include: {
                    registrations: {
                        include: {
                            user: true
                        }
                    }
                }
            },
            participants: {
                include: {
                    registration: {
                        include: {
                            user: true
                        }
                    }
                }
            },
            individualScores: true,
            matchups: {
                include: {
                    teamA: true,
                    teamB: true,
                    individualScores: true
                }
            }
        }
    });

    if (!roundData) notFound();

    const isEvent = roundData.tournament?.type === 'EVENT';
    const backUrl = isEvent
        ? `/centers/${centerId}`
        : (from === 'recruit'
            ? `/centers/${centerId}/tournaments/${tournamentId}?mode=recruit`
            : `/centers/${centerId}/tournaments/${tournamentId}`);

    // 2. Fetch Center info for manager check
    const center = await prisma.bowlingCenter.findUnique({
        where: { id: centerId },
        select: { ownerId: true, managers: { select: { id: true } } }
    });

    const isManager = center?.ownerId === session?.user?.id ||
        center?.managers.some((m: any) => m.id === session?.user?.id);

    const settings = roundData.tournament?.settings ? JSON.parse(roundData.tournament.settings) : {};
    const gameCount = settings.gameCount || 3;

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
            {/* Header / Back Link */}
            <div className="flex flex-col gap-4">
                <Link
                    href={backUrl}
                    className="flex items-center gap-1 text-slate-400 hover:text-primary transition-colors mb-2 w-fit group"
                >
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-primary/10 transition-colors border border-slate-200">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </div>
                    <span className="font-bold">대회 정보로 돌아가기</span>
                </Link>

                <div className="space-y-2">
                    <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3 italic">
                        <span className="bg-primary text-white text-xs px-3 py-1 rounded-lg not-italic shadow-lg border-2 border-black">LIVE</span>
                        볼사이드 및 사이드 결과
                    </h1>
                    <p className="text-slate-500 font-bold flex items-center gap-2">
                        <span className="text-lg">🎳</span> {roundData.tournament?.name} - {roundData.roundNumber}회차
                    </p>
                </div>
            </div>

            {/* Side Game Content */}
            <div className="bg-slate-50/50 rounded-3xl p-2 md:p-6 border-2 border-dashed border-slate-200">
                <SideGameManager
                    matchups={roundData.matchups}
                    participants={roundData.participants}
                    allIndividualScores={roundData.individualScores}
                    roundId={roundData.id}
                    isManager={isManager}
                    tournamentType={roundData.tournament?.type}
                    gameCount={gameCount}
                    tournamentRegistrations={roundData.tournament?.registrations}
                />
            </div>

            {/* Footer Note */}
            <div className="p-6 bg-blue-50 border-2 border-blue-200 rounded-2xl">
                <p className="text-blue-900 font-bold text-sm flex items-center gap-2">
                    <span className="text-xl">ℹ️</span>
                    관리자가 명단을 저장하고 점수를 입력하면 실시간으로 순위가 업데이트됩니다.
                </p>
            </div>
        </div>
    );
}
