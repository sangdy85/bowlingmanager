import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getEffectiveRoundDate, calculateTournamentStatus } from "@/lib/tournament-utils";
import TournamentListManager from "@/components/tournaments/TournamentListManager";
import JoinCenterSection from "@/components/centers/JoinCenterSection";

// ... (existing code, ensure imports are correct)

import ActiveTournaments from "@/components/centers/RecruitingTournaments"; // Kept filename, changed component name

// ... (existing imports)

export default async function CenterDetailPage({ params }: { params: { id: string } }) {
    // ... (existing code: params, session, center fetch)
    const { id } = await params;
    const session = await auth();

    const center = await prisma.bowlingCenter.findUnique({
        where: { id },
        include: {
            managers: true,
            teams: {
                select: { id: true, name: true }
            },
            tournaments: {
                orderBy: { startDate: 'desc' },
                select: {
                    id: true,
                    name: true,
                    type: true,
                    status: true,
                    startDate: true,
                    endDate: true,
                    settings: true,
                    maxParticipants: true,
                    leagueRounds: {
                        orderBy: { roundNumber: 'asc' },
                        select: {
                            id: true,
                            roundNumber: true,
                            date: true,
                            registrationStart: true,
                            _count: {
                                select: { participants: true }
                            }
                        }
                    },
                    registrations: {
                        where: { userId: session?.user?.id || 'none' },
                        select: { id: true }
                    },
                    _count: {
                        select: { registrations: true }
                    }
                }
            }
        }
    });

    if (!center) notFound();

    const isManager = center.managers.some(m => m.id === session?.user?.id);

    // Check if user is a member
    let isMember = false;
    if (session?.user?.id) {
        const member = await prisma.centerMember.findUnique({
            where: {
                userId_centerId: {
                    userId: session.user.id,
                    centerId: id
                }
            }
        });
        isMember = !!member;
    }

    // 1. Map to include registrationStart (as Date object)
    const now = new Date();
    const tournamentsWithRegDate = center.tournaments.map(t => {
        let registrationStart = null;
        if (t.settings) {
            try {
                const parsed = JSON.parse(t.settings);
                if (parsed.registrationStart) {
                    registrationStart = new Date(parsed.registrationStart);
                }
            } catch (e) {
                // ignore json error
            }
        }
        return { ...t, registrationStart };
    });

    // 2. Filter raw tournaments based on strictly date-based logic
    // Criteria:
    // - NOT a league
    // - NOT finished (Next day of startDate hasn't arrived)
    // - For EVENT: Current status is OPEN, CLOSED, or ONGOING
    // - For CHAMP: Current status of any round is OPEN, CLOSED, or ONGOING
    const activeTournamentsRaw = tournamentsWithRegDate.flatMap(t => {
        if (t.type === 'LEAGUE' || t.status === 'FINISHED') return [];

        if (t.type === 'CHAMP') {
            // Check individual rounds for CHAMP
            const recruitingRounds = t.leagueRounds.filter(r => {
                const effectiveDate = getEffectiveRoundDate(r.date, t.settings ? JSON.parse(t.settings).leagueTime : null);
                const status = calculateTournamentStatus(effectiveDate, r.registrationStart, t.endDate, t.status);
                return status === 'OPEN' || status === 'CLOSED' || status === 'ONGOING';
            });

            if (recruitingRounds.length > 0) {
                // Show the earliest recruiting round
                const nextRound = recruitingRounds[0];
                return [{
                    ...t,
                    name: `${t.name} (${nextRound.roundNumber}회차)`,
                    startDate: nextRound.date || t.startDate, // Use round date if available, fallback to tournament start date
                    participantCount: (nextRound as any)._count.participants
                }];
            }
            return [];
        }

        // Default: EVENT / CUSTOM
        const status = calculateTournamentStatus(t.startDate, t.registrationStart, t.endDate, t.status);
        if (status === 'OPEN' || status === 'CLOSED' || status === 'ONGOING') {
            return [t];
        }

        return [];
    });

    // 3. Format for display in client components
    const formattedTournaments = tournamentsWithRegDate.map(t => {
        let currentStatus = t.status; // Start with DB status

        if (t.type === 'EVENT' || t.type === 'CHAMP') {
            const startDate = t.type === 'CHAMP' && t.leagueRounds?.[0] ? getEffectiveRoundDate(t.leagueRounds[0].date, t.settings ? JSON.parse(t.settings).leagueTime : null) : t.startDate;
            currentStatus = calculateTournamentStatus(startDate, t.registrationStart, t.endDate, t.status);
        }

        return {
            ...t,
            status: currentStatus, // Use calculated status
            startDate: t.startDate.toLocaleString('ko-KR', {
                year: 'numeric',
                month: 'numeric',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            }),
            endDate: t.endDate.toLocaleDateString(),
        };
    });

    // 4. Prepare activeTournaments for RecruitingTournaments component
    const activeTournaments = activeTournamentsRaw.map((t: any) => ({
        ...t,
        isRegistered: t.registrations.length > 0,
        rawStartDate: (t.startDate || new Date()) as Date,
        startDate: (t.startDate || new Date()).toLocaleString('ko-KR', {
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        }),
        endDate: (t.endDate as Date).toLocaleDateString(),
    }));

    return (
        <div className="max-w-5xl mx-auto">
            <div className="flex justify-between items-start mb-8">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <h1 className="text-4xl font-bold">{center.name}</h1>
                        {isManager && (
                            <span className="px-2 py-1 bg-yellow-500/10 text-yellow-500 text-xs font-bold rounded border border-yellow-500/20">
                                관리 중
                            </span>
                        )}
                    </div>
                    <p className="text-secondary-foreground">{center.address}</p>
                    {center.phone && <p className="text-secondary-foreground text-sm mt-1">📞 {center.phone}</p>}
                </div>

                {isManager && (
                    <div className="flex gap-2">
                        <Link href={`/centers/${id}/edit`} className="btn btn-secondary text-sm h-10">정보 수정</Link>
                        <Link href={`/centers/${id}/tournaments/new`} className="btn btn-primary text-sm h-10">+ 새 대회 개최</Link>
                    </div>
                )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                <div className="md:col-span-2 mb-24 md:mb-0">


                    <section className="card p-8 mb-8">
                        <h2 className="text-2xl font-bold mb-4">볼링장 소개</h2>
                        <p className="text-secondary-foreground whitespace-pre-wrap">
                            {center.description || "등록된 소개 내용이 없습니다."}
                        </p>
                    </section>

                    {/* Active Tournaments Section (Recruiting + Ongoing) */}
                    {(isMember || isManager) && activeTournaments.length > 0 && (
                        <ActiveTournaments
                            tournaments={activeTournaments.map(t => ({
                                ...t,
                                participantCount: t.type === 'CHAMP' ? (t as any).participantCount : (t as any)._count.registrations,
                                isRegistered: (t as any).isRegistered
                            }))}
                            isManager={isManager}
                        />
                    )}

                    {(isMember || isManager) ? (
                        <TournamentListManager
                            tournaments={formattedTournaments}
                            centerId={id}
                            isManager={isManager}
                        />
                    ) : (
                        <div className="card p-12 text-center text-secondary-foreground border-dashed">
                            <h3 className="text-lg font-semibold mb-2">회원 전용 공간</h3>
                            <p>대회 및 리그 정보는 센터 회원가입 후 확인하실 수 있습니다.</p>
                        </div>
                    )}
                    {/* Mobile Spacer */}
                    <div className="h-24 md:h-0" />
                </div>

                <div className="space-y-6">
                    {session?.user?.id && !isMember && !isManager && (
                        <JoinCenterSection
                            centerId={id}
                            centerName={center.name}
                            teams={center.teams}
                            userId={session.user.id}
                            userName={session.user.name || "회원"}
                        />
                    )}

                    {!isManager && (isMember || !session?.user?.id) && (
                        <div className="card p-6 bg-primary/5 border-primary/20">
                            <h3 className="font-bold mb-2">방문 및 예약</h3>
                            <p className="text-sm text-secondary-foreground mb-4">
                                센터에 직접 방문하시거나 전화로 레인을 예약하실 수 있습니다.
                            </p>
                            <button className="btn btn-primary w-full" disabled>센터 연락하기</button>
                        </div>
                    )}

                    {isManager && (
                        <div className="card p-6 bg-secondary/20">
                            <h3 className="font-bold mb-2">관리자 도구</h3>
                            <div className="flex flex-col gap-2 mt-4">
                                <Link href={`/centers/${id}/teams`} className="btn btn-secondary text-xs h-9 justify-start">클럽 관리</Link>
                                <Link href={`/centers/${id}/members`} className="btn btn-secondary text-xs h-9 justify-start">회원 관리</Link>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div >
    );
}
