import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getEffectiveRoundDate, calculateTournamentStatus, formatKSTDate, parseKSTDate } from "@/lib/tournament-utils";
import TournamentListManager from "@/components/tournaments/TournamentListManager";
import JoinCenterSection from "@/components/centers/JoinCenterSection";
import CenterManageButtons from "@/components/centers/CenterManageButtons";

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
                    leagueTime: true,
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
                            },
                            participants: {
                                where: {
                                    registration: {
                                        userId: session?.user?.id || 'none'
                                    }
                                },
                                select: { id: true }
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

    const isManager = center.managers.some((m: any) => m.id === session?.user?.id) || center.ownerId === session?.user?.id;

    // Check if user is a member
    let member = null;
    if (session?.user?.id) {
        member = await prisma.centerMember.findUnique({
            where: {
                userId_centerId: {
                    userId: session.user.id,
                    centerId: id
                }
            },
            include: { Team: { select: { name: true } } }
        });
    }
    const isMember = !!member;

    // 1. Map to include registrationStart (as Date object)
    const now = new Date();
    const tournamentsWithRegDate = center.tournaments.map((t: any) => {
        let registrationStart = null;
        if (t.settings) {
            try {
                const parsed = JSON.parse(t.settings);
                if (parsed.registrationStart) {
                    registrationStart = parseKSTDate(parsed.registrationStart);
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
    const activeTournamentsRawUnfiltered = tournamentsWithRegDate.flatMap((t: any) => {
        if (t.type === 'LEAGUE' || t.status === 'FINISHED') return [];

        if (t.type === 'CHAMP') {
            const recruitingRounds = t.leagueRounds
                .map((r: any) => {
                    const effectiveDate = getEffectiveRoundDate(r.date, t.leagueTime);
                    const status = calculateTournamentStatus(effectiveDate, r.registrationStart, null, t.status, now);
                    return { ...r, effectiveDate, calculatedStatus: status };
                })
                .filter((r: any) => r.calculatedStatus === 'OPEN' || r.calculatedStatus === 'CLOSED' || r.calculatedStatus === 'ONGOING')
                .sort((a: any, b: any) => {
                    const statusPriority: Record<string, number> = { OPEN: 0, ONGOING: 1, CLOSED: 2 };
                    if (statusPriority[a.calculatedStatus] !== statusPriority[b.calculatedStatus]) {
                        return statusPriority[a.calculatedStatus] - statusPriority[b.calculatedStatus];
                    }
                    return a.roundNumber - b.roundNumber;
                });

            if (recruitingRounds.length > 0) {
                const nextRound = recruitingRounds[0];
                return [{
                    ...t,
                    name: `${t.name} (${nextRound.roundNumber}회차)`,
                    startDate: nextRound.effectiveDate || nextRound.date || t.startDate,
                    roundId: nextRound.id,
                    participantCount: (nextRound as any)._count.participants,
                    calculatedStatus: nextRound.calculatedStatus,
                    isRegisteredInRound: nextRound.participants.length > 0
                }];
            }
            return [];
        }

        const status = calculateTournamentStatus(t.startDate, t.registrationStart, t.endDate, t.status, now);

        // EVENT의 경우 OPEN, CLOSED 상태 외에도 ONGOING(경기 시작됨)까지 '모집 중' 섹션에 표시
        if (status === 'OPEN' || status === 'CLOSED' || status === 'ONGOING') {
            return [{
                ...t,
                participantCount: (t as any)._count.registrations,
                calculatedStatus: status
            }];
        }

        return [];
    });

    // Deduplicate active tournaments by name to avoid duplicate cards
    const activeTournamentsRaw = Array.from(
        activeTournamentsRawUnfiltered.reduce((map: Map<string, any>, t: any) => {
            const existing = map.get(t.name);
            if (!existing || (t.leagueRounds?.length || 0) > (existing.leagueRounds?.length || 0)) {
                map.set(t.name, t);
            }
            return map;
        }, new Map<string, any>()).values()
    );

    // 3.5 Deduplicate raw tournaments by name (prioritize those with data)
    const dedupedRaw = Array.from(
        tournamentsWithRegDate.reduce((map: Map<string, typeof tournamentsWithRegDate[number]>, t: typeof tournamentsWithRegDate[number]) => {
            const existing = map.get(t.name);
            if (!existing) {
                map.set(t.name, t);
            } else {
                // Score based on data content: rounds and settings
                const tScore = (t.leagueRounds?.length || 0) + (t.settings ? 10 : 0);
                const existingScore = (existing.leagueRounds?.length || 0) + (existing.settings ? 10 : 0);

                if (tScore > existingScore) {
                    map.set(t.name, t);
                } else if (tScore === existingScore) {
                    // If scores are equal, prefer the one with the later start date
                    if (t.startDate.getTime() > existing.startDate.getTime()) {
                        map.set(t.name, t);
                    }
                }
            }
            return map;
        }, new Map<string, any>()).values()
    );

    // 4. Format the deduplicated list for display
    const formattedTournamentsRaw = dedupedRaw.map((t: any) => {
        let currentStatus = t.status;

        if (t.type === 'EVENT' || t.type === 'CHAMP' || t.type === 'LEAGUE') {
            if ((t.type === 'CHAMP' || t.type === 'LEAGUE') && t.leagueRounds && t.leagueRounds.length > 0) {
                // For long-term tournaments, status is FINISHED only if ALL rounds are FINISHED
                // UNLESS the DB status is explicitly set to FINISHED
                if (t.status === 'FINISHED') {
                    currentStatus = 'FINISHED';
                } else {
                    const roundStatuses = t.leagueRounds.map((r: any) => {
                        const effectiveDate = getEffectiveRoundDate(r.date, t.leagueTime);
                        return calculateTournamentStatus(effectiveDate, r.registrationStart, null, t.status);
                    });

                    const allFinished = roundStatuses.every((s: string) => s === 'FINISHED');
                    const anyOngoing = roundStatuses.some((s: string) => s === 'ONGOING' || s === 'OPEN' || s === 'CLOSED');

                    if (allFinished) {
                        currentStatus = 'FINISHED';
                    } else if (anyOngoing) {
                        currentStatus = 'ONGOING';
                    } else {
                        currentStatus = 'UPCOMING';
                    }
                }
            } else {
                currentStatus = calculateTournamentStatus(t.startDate, t.registrationStart, t.endDate, t.status);
            }
        }

        return {
            ...t,
            status: currentStatus,
            startDate: formatKSTDate(t.startDate),
            endDate: formatKSTDate(t.endDate),
        };
    });

    const formattedTournaments = JSON.parse(JSON.stringify(formattedTournamentsRaw));

    // 4. Prepare activeTournaments for RecruitingTournaments component
    // Pre-calculate ALL formatting and status on the SERVER to prevent client exceptions
    const activeTournaments = activeTournamentsRaw.map((t: any) => {
        const rawStart = (t.startDate || new Date());

        return {
            id: t.id,
            name: t.name,
            type: t.type,
            status: (t as any).calculatedStatus, // Use the status we already calculated!
            maxParticipants: t.maxParticipants,
            participantCount: t.participantCount,
            isRegistered: t.type === 'CHAMP' ? (t as any).isRegisteredInRound : (t.registrations.length > 0),
            roundId: (t as any).roundId,
            startDateLabel: formatKSTDate(rawStart)
        };
    });

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
                    <CenterManageButtons centerId={id} />
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
                            tournaments={activeTournaments}
                            centerId={id}
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
                    {session?.user?.id && !isManager && (
                        <JoinCenterSection
                            centerId={id}
                            centerName={center.name}
                            teams={center.teams}
                            userId={session.user.id}
                            userName={session.user.name || "회원"}
                            currentMember={member}
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
