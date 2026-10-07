import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getEffectiveRoundDate, calculateTournamentStatus, formatKSTDate, parseKSTDate } from "@/lib/tournament-utils";
import TournamentListManager from "@/components/tournaments/TournamentListManager";
import JoinCenterSection from "@/components/centers/JoinCenterSection";
import styles from "./CenterDetail.module.css";

// ... (existing code, ensure imports are correct)

import ActiveTournaments from "@/components/centers/RecruitingTournaments"; // Kept filename, changed component name

// ... (existing imports)

export default async function CenterDetailPage({ params }: { params: Promise<{ id: string }> }) {
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
            const allRounds = t.leagueRounds.map((r: any) => {
                const effectiveDate = getEffectiveRoundDate(r.date, t.leagueTime);
                const status = calculateTournamentStatus(effectiveDate, r.registrationStart, null, t.status, now);
                return { ...r, effectiveDate, calculatedStatus: status };
            });

            // Filter for rounds that are currently interactive (OPEN, CLOSED, ONGOING)
            let recruitingRounds = allRounds.filter((r: any) => 
                r.calculatedStatus === 'OPEN' || r.calculatedStatus === 'CLOSED' || r.calculatedStatus === 'ONGOING'
            );

            // If no round is interactive, but future rounds exist and tournament hasn't ended,
            // show the next upcoming round in the active list.
            if (recruitingRounds.length === 0) {
                const upcomingRounds = allRounds.filter((r: any) => r.calculatedStatus === 'UPCOMING');
                if (upcomingRounds.length > 0) {
                    recruitingRounds = [upcomingRounds[0]];
                }
            }

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
                    const anyUpcoming = roundStatuses.some((s: string) => s === 'UPCOMING');

                    // Check overall tournament endDate if it exists
                    const tournamentOverallStatus = calculateTournamentStatus(t.startDate, t.registrationStart, t.endDate, t.status, now);

                    if (allFinished && tournamentOverallStatus === 'FINISHED') {
                        currentStatus = 'FINISHED';
                    } else if (anyOngoing) {
                        currentStatus = 'ONGOING';
                    } else if (anyUpcoming || tournamentOverallStatus !== 'FINISHED') {
                        currentStatus = 'UPCOMING';
                    } else {
                        currentStatus = 'FINISHED';
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
        <div className={styles.page}>
            <header className={styles.hero}>
                <div className={styles.heroMain}>
                    <div className={styles.titleRow}>
                        <h1 className={styles.title}>{center.name}</h1>
                        {isManager && <span className={styles.managerBadge}>관리 중</span>}
                    </div>
                    <div className={styles.meta}>
                        <p>{center.address}</p>
                        {center.phone && <p>📞 {center.phone}</p>}
                    </div>
                </div>

                {isManager && (
                    <div className={styles.actions}>
                        <Link href={`/centers/${id}/edit`} className={`btn btn-secondary ${styles.actionButton}`}>
                            정보 수정
                        </Link>
                        <Link href={`/centers/${id}/tournaments/new`} className={`btn btn-primary ${styles.actionButton}`}>
                            + 새 대회 개최
                        </Link>
                    </div>
                )}
            </header>

            <div className={`${styles.layout} ${!session?.user?.id ? styles.layoutFull : ''}`}>
                <main className={styles.mainColumn}>
                    {activeTournaments.length > 0 && (
                        <ActiveTournaments
                            tournaments={activeTournaments}
                            centerId={id}
                            isManager={isManager}
                        />
                    )}

                    <TournamentListManager
                        tournaments={formattedTournaments}
                        centerId={id}
                        isManager={isManager}
                    />

                    <section className={`card ${styles.introCard}`}>
                        <h2 className={styles.sectionTitle}>볼링장 안내</h2>
                        <p className={styles.description}>
                            {center.description || "등록된 소개 내용이 없습니다."}
                        </p>
                    </section>

                    {!session?.user?.id && (
                        <section className={styles.loginPrompt}>
                            <h3>대회 참가 · 결과 확인을 더 편하게</h3>
                            <p>로그인하면 센터 대회 참가 신청과 개인 참가 현황을 함께 관리할 수 있습니다.</p>
                            <Link href="/login" className="btn btn-primary">로그인하고 대회 참가하기</Link>
                        </section>
                    )}
                </main>

                {session?.user?.id && (
                    <aside className={styles.sidebar}>
                        {!isManager && (
                            <JoinCenterSection
                                centerId={id}
                                centerName={center.name}
                                teams={center.teams}
                                userId={session.user.id}
                                userName={session.user.name || "회원"}
                                currentMember={member}
                            />
                        )}

                        {isManager && (
                            <section className={`card ${styles.sideCard}`}>
                                <h3>대회 운영 관리</h3>
                                <p>대회 운영에 필요한 센터 회원과 상주 클럽을 관리합니다.</p>
                                <div className={styles.toolList}>
                                    <Link href={`/centers/${id}/teams`} className={`btn btn-secondary ${styles.toolLink}`}>
                                        클럽 관리
                                    </Link>
                                    <Link href={`/centers/${id}/members`} className={`btn btn-secondary ${styles.toolLink}`}>
                                        회원 관리
                                    </Link>
                                </div>
                            </section>
                        )}
                    </aside>
                )}
            </div>
        </div>
    );
}
