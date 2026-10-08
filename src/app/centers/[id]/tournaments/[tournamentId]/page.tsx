import { updateTournamentStatus } from "@/app/actions/tournament-center";
export const dynamic = 'force-dynamic';
import Link from "next/link";
import TournamentRegButton from "@/components/tournaments/TournamentRegButton";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { notFound, redirect } from "next/navigation";
import TournamentManager from "@/components/tournaments/TournamentManager";
import TournamentDescriptionEditor from "@/components/tournaments/TournamentDescriptionEditor";
import TournamentAttachmentManager from "@/components/tournaments/TournamentAttachmentManager";
import LeagueResultManager from "@/components/tournaments/LeagueResultManager";
import DeleteTournamentButton from "@/components/tournaments/DeleteTournamentButton";
import TournamentStatusDropdown from "@/components/tournaments/TournamentStatusDropdown";
import LeagueScheduleView from "@/components/tournaments/LeagueScheduleView";
import WeeklyResultDownloader from "@/components/tournaments/WeeklyResultDownloader";
import ChampManager from "@/components/tournaments/ChampManager";
import RoundParticipantManager from "@/components/tournaments/RoundParticipantManager";
import GrandFinaleQualifiersButton from "@/components/tournaments/GrandFinaleQualifiersButton";
import EventManager from "@/components/tournaments/EventManager";
import TournamentMemberView from "@/components/tournaments/TournamentMemberView";
import { getLeagueLeaderboard, getIndividualLeaderboard } from "@/app/actions/league-leaderboard";
import { getEffectiveRoundDate, calculateTournamentStatus } from "@/lib/tournament-utils";
import styles from "./TournamentDetail.module.css";
import BandPublishStatus from "@/components/tournaments/BandPublishStatus";

export default async function TournamentDetailPage({ params }: { params: Promise<{ id: string, tournamentId: string }> }) {
    const { id: centerId, tournamentId } = await params;
    const session = await auth();

    const tournament = (await (prisma.tournament as any).findUnique({
        where: { id: tournamentId },
        include: {
            center: {
                include: {
                    managers: true,
                    bandConnection: { select: { enabled: true, bandKey: true } }
                }
            },
            bandPosts: { orderBy: { createdAt: 'desc' } },
            attachments: {
                orderBy: { createdAt: 'desc' }
            },
            registrations: {
                include: { user: true, team: true }
            },
            leagueRounds: {
                include: {
                    matchups: {
                        include: {
                            teamA: true,
                            teamB: true,
                            individualScores: {
                                include: { User: true }
                            }
                        }
                    },
                    individualScores: true,
                    participants: {
                        include: {
                            registration: {
                                include: {
                                    user: true,
                                    team: true
                                }
                            }
                        }
                    }
                },
                orderBy: { roundNumber: 'asc' }
            }
        }
    })) as any;

    if (!tournament) notFound();

    const now = new Date();

    // Safe settings parsing
    let tournamentSettings: any = {};
    try {
        if (tournament.settings) tournamentSettings = JSON.parse(tournament.settings);
    } catch (e) {
        console.error("Failed to parse tournament settings", e);
    }

    const isManager = tournament.center.managers.some((m: any) => m.id === session?.user?.id) || tournament.center.ownerId === session?.user?.id;
    const isRegAtTournament = tournament.registrations.some((r: any) => r.userId === session?.user?.id);

    // If user is manager and it's an EVENT, redirect to the only round's management page
    if (isManager && tournament.type === 'EVENT' && tournament.leagueRounds.length > 0) {
        redirect(`/centers/${centerId}/tournaments/${tournament.id}/rounds/${tournament.leagueRounds[0].id}`);
    }

    // Fetch resident teams for the center to allow scheduling
    const centerTeams = await prisma.team.findMany({
        where: {
            centerId: tournament.centerId,
            isActive: true
        } as any
    });

    const statusMap: Record<string, { label: string, color: string }> = {
        PLANNING: { label: "준비 중", color: "bg-gray-500" },
        OPEN: { label: "모집 중", color: "bg-green-500" },
        JOINING: { label: "모집 중", color: "bg-green-500" },
        ONGOING: { label: "진행 중", color: "bg-blue-500" },
        FINISHED: { label: "종료", color: "bg-red-600" },
    };

    const typeMap: Record<string, { label: string, color: string }> = {
        LEAGUE: { label: "상주리그", color: "bg-purple-600" },
        CHAMP: { label: "챔프전", color: "bg-yellow-600" },
        EVENT: { label: "이벤트전", color: "bg-blue-600" },
    };

    // Calculate if league has started (safety check for schedule generation)
    const hasStarted = tournament.leagueRounds.some((r: any) =>
        r.matchups.some((m: any) => m.status !== 'PENDING' || m.scoreA1 !== null)
    );

    // For Member-only view (Non-managers in League tournaments)
    let leaderboardData = null;
    let individualData = null;
    let userProfile = null;

    if (!isManager) {
        try {
            if (tournament.type === 'LEAGUE') {
                leaderboardData = await getLeagueLeaderboard(tournamentId);
                individualData = await getIndividualLeaderboard(tournamentId);
            }

            // Fetch user profile for matching (name/team)
            if (session?.user?.id) {
                const member = await prisma.centerMember.findUnique({
                    where: {
                        userId_centerId: {
                            userId: session.user.id,
                            centerId: centerId
                        }
                    },
                    include: {
                        User: { select: { name: true } },
                        Team: { select: { name: true } }
                    }
                });
                if (member) {
                    userProfile = {
                        name: (member as any).User.name,
                        teamName: (member as any).Team?.name || null
                    };
                }
            }
        } catch (e) {
            console.error("Failed to fetch member view data", e);
        }
    }

    // Pre-calculate round statuses and effective dates on the server
    const processedRounds = tournament.leagueRounds.map((r: any) => {
        const effectiveDate = getEffectiveRoundDate(r.date, tournament.leagueTime);
        const status = calculateTournamentStatus(
            effectiveDate,
            r.registrationStart || tournamentSettings.registrationStart,
            null,
            undefined, // Don't force round status based on tournament status
            now
        );
        return {
            ...r,
            effectiveDate,
            calculatedStatus: status,
            // Serialize for client components
            date: r.date?.toISOString(),
            registrationStart: r.registrationStart?.toISOString(),
            effectiveDateStr: effectiveDate?.toISOString()
        };
    });

    // Calculate display name and initial round for CHAMP tournaments
    let displayName = tournament.name;
    let initialRound = null;

    if (tournament.type === 'CHAMP') {
        const recruitingRounds = processedRounds.filter((r: any) =>
            r.calculatedStatus === 'OPEN' || r.calculatedStatus === 'CLOSED' || r.calculatedStatus === 'ONGOING'
        );

        if (recruitingRounds.length > 0) {
            initialRound = recruitingRounds[0];
            displayName = `${tournament.name} (${initialRound.roundNumber}회차)`;
        }
    }

    // Default round calculation logic (fallback or for non-CHAMP)
    if (!initialRound) {
        // 1. Current recruiting/ongoing round
        initialRound = processedRounds.find((r: any) =>
            r.calculatedStatus === 'OPEN' || r.calculatedStatus === 'CLOSED' || r.calculatedStatus === 'ONGOING'
        );

        // 2. Next upcoming round
        if (!initialRound) {
            initialRound = [...processedRounds].sort((a, b) => {
                const timeA = a.effectiveDate ? a.effectiveDate.getTime() : Infinity;
                const timeB = b.effectiveDate ? b.effectiveDate.getTime() : Infinity;
                return timeA - timeB;
            }).find((r: any) => r.effectiveDate && r.effectiveDate > now);
        }

        // 3. Fallback to latest round
        if (!initialRound && processedRounds.length > 0) {
            initialRound = processedRounds[processedRounds.length - 1];
        }
    }

    // Determine if user is registered in the SPECIFIC round (for accurate button state)
    let isRegisteredInRound = isRegAtTournament;
    if (initialRound) {
        isRegisteredInRound = initialRound.participants?.some((p: any) => p.registration?.userId === session?.user?.id);
    }

    // 5. Calculate overall display status for header
    let currentStatus = tournament.status;
    if (tournament.type === 'CHAMP' || tournament.type === 'LEAGUE') {
        const roundStatuses = processedRounds.map((r: any) => r.calculatedStatus);
        const allFinished = roundStatuses.every((s: string) => s === 'FINISHED');
        const anyOngoing = roundStatuses.some((s: string) => s === 'ONGOING' || s === 'OPEN' || s === 'CLOSED');
        const anyUpcoming = roundStatuses.some((s: string) => s === 'UPCOMING');
        
        const tournamentOverallStatus = calculateTournamentStatus(tournament.startDate, tournamentSettings.registrationStart, tournament.endDate, tournament.status, now);

        if (allFinished && tournamentOverallStatus === 'FINISHED') {
            currentStatus = 'FINISHED';
        } else if (anyOngoing || hasStarted) {
            currentStatus = 'ONGOING';
        } else if (anyUpcoming || tournamentOverallStatus !== 'FINISHED') {
            currentStatus = 'UPCOMING';
        } else {
            currentStatus = 'FINISHED';
        }
    }

    // Merge processed rounds back into tournament for passing to client components
    const safeTournamentRaw = {
        ...tournament,
        leagueRounds: processedRounds,
        startDate: tournament.startDate?.toISOString(),
        endDate: tournament.endDate?.toISOString(),
        registrationStart: tournament.registrationStart?.toISOString(),
        center: {
            ...tournament.center,
        }
    };

    const safeTournament = JSON.parse(JSON.stringify(safeTournamentRaw));
    const safeBandPosts = (safeTournament.bandPosts || []).map((post: any) => ({
        id: post.id,
        type: post.type,
        status: post.status,
        revision: post.revision,
        createdAt: post.createdAt,
        postedAt: post.postedAt,
        errorMessage: post.errorMessage,
    }));

    return (
        <div className={styles.page}>
            <Link href={`/centers/${centerId}`} className={styles.back}>
                <span className={styles.backIcon} aria-hidden="true">←</span>
                <span>볼링장 · 대회로 돌아가기</span>
            </Link>

            <header className={styles.hero}>
                <div className={styles.heroMain}>
                    <div className={styles.badges}>
                        <span className={`${styles.typeBadge} ${typeMap[safeTournament.type]?.color || 'bg-gray-500'}`}>
                            {typeMap[safeTournament.type]?.label || safeTournament.type}
                        </span>
                        <span className={styles.statusBadge}>
                            <span className={`${styles.statusDot} ${currentStatus === 'FINISHED' ? styles.statusDotFinished :
                                (currentStatus === 'ONGOING' || hasStarted) ? styles.statusDotOngoing : ''
                                }`} />
                            {currentStatus === 'FINISHED' ? '종료' :
                                (currentStatus === 'ONGOING' || hasStarted ? '진행 중' : (currentStatus === 'OPEN' ? '모집 중' : (currentStatus === 'CLOSED' ? '마감' : (statusMap[currentStatus]?.label || currentStatus))))}
                        </span>
                    </div>

                    <h1 className={styles.title}>
                        {displayName}
                        {safeTournament.type === 'EVENT' && ' (이벤트전)'}
                    </h1>

                    <div className={styles.meta}>
                        <span className={styles.metaItem}>📅 {new Date(safeTournament.startDate).toLocaleDateString('ko-KR')} ~ {new Date(safeTournament.endDate).toLocaleDateString('ko-KR')}</span>
                        <span className={styles.metaItem}>💰 {safeTournament.entryFee.toLocaleString()}원</span>
                        <span className={styles.metaItem}>🏠 {safeTournament.center.name}</span>
                    </div>
                </div>

                {isManager && (
                    <div className={styles.heroActions}>
                        <DeleteTournamentButton tournamentId={safeTournament.id} />
                        <TournamentStatusDropdown
                            tournamentId={safeTournament.id}
                            currentStatus={safeTournament.status}
                            statusMap={statusMap}
                        />
                    </div>
                )}
            </header>

            {/* Content Logic: Manager vs Member */}
            {!isManager ? (
                <TournamentMemberView
                    tournament={safeTournament}
                    centerId={centerId}
                    centerName={safeTournament.center.name}
                    centerAddress={safeTournament.center.address}
                    leaderboardData={leaderboardData}
                    individualData={individualData}
                    currentUserId={session?.user?.id}
                    isRegistered={isRegisteredInRound}
                    hasStarted={hasStarted}
                    initialRoundId={initialRound?.id}
                    userProfile={userProfile}
                />
            ) : (
                <div className={styles.managerGrid}>
                    <div className={styles.mainColumn}>
                        {/* 대회 개요 (Overview) section at the TOP */}
                        <section className={styles.section}>
                            <div className={styles.sectionHeader}>
                                <div>
                                    <h2 className={styles.sectionTitle}>📝 대회 요강 및 개요</h2>
                                    <p className={styles.sectionHint}>대회 안내와 세부 설정을 한곳에서 확인합니다.</p>
                                </div>
                            </div>
                            <div className={styles.sectionBody}>
                                <TournamentDescriptionEditor
                                    tournamentId={safeTournament.id}
                                    initialDescription={safeTournament.description}
                                    isManager={isManager}
                                />

                                {(safeTournament.type === 'CHAMP' || safeTournament.type === 'EVENT') && safeTournament.settings && (
                                    <div style={{ marginTop: '1rem' }}>
                                        <h3 className={styles.sectionTitle}>📋 상세 요강 안내</h3>
                                        <div className={styles.infoGrid}>
                                            {(() => {
                                                const s = tournamentSettings; // use the safe parsed settings
                                                const items = [
                                                    {
                                                        label: '일시',
                                                        value: (() => {
                                                            if (safeTournament.type !== 'EVENT') return s.startDateText;
                                                            const d = new Date(safeTournament.startDate);
                                                            return isNaN(d.getTime()) ? '일정 미정' : d.toLocaleString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
                                                        })(),
                                                        icon: '📅'
                                                    },
                                                    { label: '대회 시간', value: safeTournament.type === 'EVENT' ? null : safeTournament.leagueTime, icon: '⏰' },
                                                    {
                                                        label: '접수 시작',
                                                        value: (() => {
                                                            if (!s.registrationStart) return null;
                                                            const d = new Date(s.registrationStart);
                                                            return isNaN(d.getTime()) ? null : d.toLocaleString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
                                                        })(),
                                                        icon: '📝'
                                                    },
                                                    {
                                                        label: '진행 모드',
                                                        value: s.gameMode === 'INDIVIDUAL' ? '개인전' :
                                                            s.gameMode?.startsWith('TEAM_') ? `${s.gameMode.split('_')[1]}인조 전` : null,
                                                        icon: '🎮'
                                                    },
                                                    { label: '경기 방식', value: s.gameMethod, icon: '🎳' },
                                                    { label: '참가 대상', value: s.target, icon: '👥' },
                                                    { label: '참가비', value: s.entryFeeText, icon: '💵' },
                                                    { label: '입금계좌', value: s.bankAccount, icon: '🏦' },
                                                    { label: '핸디 적용', value: s.handicapInfo, icon: '⚖️' },
                                                    { label: '마이너스 핸디', value: s.minusHandicapInfo, icon: '📉' },
                                                    { label: '대회 패턴', value: s.pattern, icon: '🗺️' },
                                                    {
                                                        label: '왕중왕전',
                                                        value: s.hasGrandFinale === 'CUMULATIVE' ? '있음 (포인트 누적)' :
                                                            s.hasGrandFinale === 'WINNERS' ? '있음 (입상자 선정)' : null,
                                                        icon: '🏆'
                                                    },
                                                ];
                                                return items.filter(item => item.value).map((item, idx) => (
                                                    <div key={idx} className={styles.infoItem}>
                                                        <div className={styles.infoLabel}><span>{item.icon}</span> {item.label}</div>
                                                        <div className={styles.infoValue}>{item.value}</div>
                                                    </div>
                                                ));
                                            })()}
                                        </div>
                                    </div>
                                )}

                                <TournamentAttachmentManager
                                    tournamentId={safeTournament.id}
                                    attachments={safeTournament.attachments}
                                    isManager={isManager}
                                />
                            </div>
                        </section>

                        {/* 🏆 Leaderboard (Grand Finale) section moved UP for consistency */}
                        <section className={`${styles.section} ${styles.leaderboardCard}`}>
                            <div className={styles.sectionHeader}>
                                <div>
                                    <h3 className={styles.sectionTitle}>🏆 리더보드 · 왕중왕전</h3>
                                    <p className={styles.sectionHint}>대회 진행에 따라 실시간 순위 데이터가 집계됩니다.</p>
                                </div>
                            </div>
                            <div className={`${styles.sectionBody} ${styles.linkStack}`}>
                                {(() => {
                                    const s = tournamentSettings;

                                    return (
                                        <>
                                            {s.hasGrandFinale === 'WINNERS' && (
                                                <GrandFinaleQualifiersButton
                                                    centerId={centerId}
                                                    tournamentId={tournamentId}
                                                />
                                            )}
                                            {s.hasGrandFinale === 'CUMULATIVE' && (
                                                <Link
                                                    href={`/centers/${centerId}/tournaments/${tournamentId}/grand-finale-leaderboard`}
                                                    className={`btn btn-primary ${styles.compactButton}`}
                                                >
                                                    🎖️ 왕중왕전 포인트 현황
                                                </Link>
                                            )}
                                        </>
                                    );
                                })()}

                                {safeTournament.type === 'LEAGUE' && (
                                    <>
                                        <Link
                                            href={`/centers/${centerId}/tournaments/${tournamentId}/leaderboard`}
                                            className={`btn btn-primary ${styles.compactButton}`}
                                        >
                                            순위표 열기
                                        </Link>
                                        <Link
                                            href={`/centers/${centerId}/tournaments/${tournamentId}/individual-leaderboard`}
                                            className={`btn btn-primary ${styles.compactButton}`}
                                        >
                                            개인 순위표
                                        </Link>
                                        <Link
                                            href={`/centers/${centerId}/tournaments/${tournamentId}/top30`}
                                            className={`btn btn-primary ${styles.compactButton}`}
                                        >
                                            개인 평균 Top
                                        </Link>
                                    </>
                                )}
                            </div>
                        </section>

                        {safeTournament.type === 'LEAGUE' && isManager && (
                            <div className="space-y-4">
                                <TournamentManager
                                    tournament={safeTournament}
                                    centerId={centerId}
                                    availableTeams={centerTeams}
                                    hasExistingSchedule={safeTournament.leagueRounds.length > 0}
                                    hasStarted={hasStarted}
                                />
                            </div>
                        )}

                        {safeTournament.type === 'CHAMP' && isManager && (
                            <div className="space-y-4">
                                <ChampManager
                                    tournament={safeTournament}
                                    centerId={centerId}
                                    isManager={isManager}
                                />
                            </div>
                        )}

                        {safeTournament.type === 'EVENT' && isManager && (
                            <div className="space-y-4">
                                <EventManager
                                    tournament={safeTournament}
                                    centerId={centerId}
                                    isManager={isManager}
                                />
                            </div>
                        )}

                        {safeTournament.type === 'LEAGUE' && safeTournament.leagueRounds.length > 0 && (
                            <LeagueScheduleView
                                tournamentName={safeTournament.name}
                                leagueRounds={safeTournament.leagueRounds}
                                isManager={isManager}
                            />
                        )}

                        {safeTournament.type === 'LEAGUE' && safeTournament.leagueRounds.length > 0 && (
                            <WeeklyResultDownloader
                                tournamentId={safeTournament.id}
                                tournamentName={safeTournament.name}
                                rounds={safeTournament.leagueRounds}
                                teamHandicapLimit={safeTournament.teamHandicapLimit}
                                awardMinGames={safeTournament.awardMinGames}
                                reportNotice={safeTournament.reportNotice}
                            />
                        )}

                        {safeTournament.type === 'LEAGUE' && safeTournament.leagueRounds.length > 0 && (
                            <LeagueResultManager
                                centerId={centerId}
                                tournamentId={tournamentId}
                                rounds={safeTournament.leagueRounds}
                                isManager={isManager}
                            />
                        )}

                        {safeTournament.type !== 'LEAGUE' && (
                            <section className={styles.section}>
                                <div className={styles.sectionHeader}>
                                    <div>
                                        <h2 className={styles.sectionTitle}>👥 참가자 명단</h2>
                                        <p className={styles.sectionHint}>
                                            현재 {safeTournament.registrations.length}명 / 정원 {safeTournament.maxParticipants}명
                                        </p>
                                    </div>
                                    {!isManager && (
                                        <div className="w-full">
                                            <TournamentRegButton
                                                tournament={safeTournament}
                                                isRegistered={isRegisteredInRound}
                                                canJoin={safeTournament.status !== 'FINISHED'}
                                            />
                                        </div>
                                    )}
                                </div>

                                {(() => {
                                    const rounds = safeTournament.leagueRounds || [];
                                    return (
                                        <RoundParticipantManager
                                            rounds={rounds}
                                            initialRoundId={initialRound?.id}
                                            allRegistrations={safeTournament.registrations}
                                            isManager={isManager}
                                            maxParticipants={safeTournament.maxParticipants}
                                            isEvent={safeTournament.type === 'EVENT'}
                                            hideRoundTabs={safeTournament.type === 'EVENT' || !isManager}
                                            currentUserId={session?.user?.id}
                                            centerId={centerId}
                                        />
                                    );
                                })()}
                            </section>
                        )}
                    </div>

                    <aside className={styles.sidebar}>
                        {isManager && (
                            <BandPublishStatus
                                centerId={centerId}
                                tournamentId={tournamentId}
                                connected={Boolean(safeTournament.center.bandConnection?.enabled && safeTournament.center.bandConnection?.bandKey)}
                                posts={safeBandPosts}
                            />
                        )}

                        <section className={`card ${styles.sideCard}`}>
                            <h3 className={styles.sideTitle}>📍 참여 볼링장</h3>
                            <p className={styles.sideText}>{safeTournament.center.name}</p>
                            <p className={styles.sideText}>{safeTournament.center.address}</p>
                            <Link
                                href={`/centers/${centerId}`}
                                className={`btn btn-secondary ${styles.compactButton}`}
                                style={{ marginTop: '0.75rem' }}
                            >
                                볼링장 정보 더보기
                            </Link>
                        </section>

                    </aside>
                </div>
            )
            }
        </div >
    );
}
