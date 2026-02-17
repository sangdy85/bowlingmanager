import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import GrandFinalePointSettings from "@/components/tournaments/GrandFinalePointSettings";
import GrandFinaleWinnersManager from "@/components/tournaments/GrandFinaleWinnersManager";
import { auth } from "@/auth";

export default async function GrandFinalePage({ params }: { params: { id: string, tournamentId: string } }) {
    const { id: centerId, tournamentId } = await params;
    const session = await auth();

    const tournament = (await (prisma.tournament as any).findUnique({
        where: { id: tournamentId },
        include: {
            center: {
                include: { managers: true }
            },
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

    const isManager = tournament.center.managers.some((m: any) => m.id === session?.user?.id) || tournament.center.ownerId === session?.user?.id;
    if (!isManager) {
        return (
            <div className="container mx-auto py-20 text-center">
                <h1 className="text-2xl font-bold text-red-500">대회 관리자만 접근할 수 있습니다.</h1>
                <Link href={tournament.type === 'EVENT' ? `/centers/${centerId}` : `/centers/${centerId}/tournaments/${tournamentId}`} className="btn btn-secondary mt-4 inline-block">돌아가기</Link>
            </div>
        );
    }

    const settings = tournament.settings ? JSON.parse(tournament.settings) : {};
    const hasGrandFinale = settings.hasGrandFinale || 'NONE';
    const grandFinalePoints = settings.grandFinalePoints || {};
    const grandFinalistIds = settings.grandFinalistIds || [];

    // For status check
    const now = new Date();
    const visibleRounds = tournament.leagueRounds.filter((round: any) => {
        const effectiveDate = (() => {
            if (!round.date) return null;
            const d = new Date(round.date);
            if (!tournament.leagueTime) return d;
            const [h, m] = tournament.leagueTime.split(':').map(Number);
            const res = new Date(d);
            res.setHours(h, m, 0, 0);
            return res;
        })();

        const start = round.registrationStart ? new Date(round.registrationStart) : null;

        // "종료" (Date passed) OR "진행중" (Registration started)
        const isClosed = effectiveDate && now > effectiveDate;
        const isInProgress = start && now >= start;
        const noStartButDateSet = !start && round.date && now >= new Date(round.date);
        const autoOpenIfNoStart = !start && round.date;

        return isClosed || isInProgress || noStartButDateSet || autoOpenIfNoStart;
    });

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b-2 border-primary/20">
                <div className="space-y-4">
                    <div className="flex justify-start">
                        <Link
                            href={tournament.type === 'EVENT' ? `/centers/${centerId}` : `/centers/${centerId}/tournaments/${tournamentId}`}
                            className="flex items-center gap-2 text-sm font-bold text-secondary-foreground hover:text-primary transition-colors group"
                        >
                            <span className="text-lg group-hover:-translate-x-1 transition-transform">←</span>
                            대회 상세페이지로 돌아가기
                        </Link>
                    </div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-4xl font-black tracking-tight">{tournament.name} 왕중왕전 관리</h1>
                    </div>
                </div>
            </div>

            {hasGrandFinale === 'CUMULATIVE' ? (
                <div className="space-y-10">
                    <GrandFinalePointSettings
                        tournamentId={tournament.id}
                        initialPoints={grandFinalePoints}
                    />
                </div>
            ) : hasGrandFinale === 'WINNERS' ? (
                <GrandFinaleWinnersManager
                    tournamentId={tournament.id}
                    rounds={visibleRounds}
                    selectedIds={grandFinalistIds}
                />
            ) : (
                <div className="card p-20 text-center border-2 border-dashed">
                    <div className="text-6xl mb-6">🚫</div>
                    <h2 className="text-2xl font-black mb-2">왕중왕전 설정이 비활성화되어 있습니다.</h2>
                    <p className="text-secondary-foreground mb-8">대회 설정에서 왕중왕전 포인트 누적 또는 입상자 선정을 선택해 주세요.</p>
                    <Link href={tournament.type === 'EVENT' ? `/centers/${centerId}` : `/centers/${centerId}/tournaments/${tournamentId}`} className="btn btn-primary px-10">대회 정보로 돌아가기</Link>
                </div>
            )}
        </div>
    );
}
