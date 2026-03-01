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

export default async function TournamentDetailPage({ params }: { params: { id: string, tournamentId: string } }) {
    const { id: centerId, tournamentId } = await params;
    const session = await auth();

    const tournament = (await (prisma.tournament as any).findUnique({
        where: { id: tournamentId },
        include: {
            center: {
                include: { managers: true }
            },
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
                    individualScores: true
                },
                orderBy: { roundNumber: 'asc' }
            }
        }
    })) as any;

    if (!tournament) notFound();

    // Raw fetch for round participants to check user join status (Prisma Client issue workaround)
    for (const round of tournament.leagueRounds) {
        const parts: any[] = await prisma.$queryRaw`
            SELECT rp.*, tr."userId"
            FROM "RoundParticipant" rp
            JOIN "TournamentRegistration" tr ON rp."registrationId" = tr.id
            WHERE rp."roundId" = ${round.id}
        `;
        // Transform to match structure expected by UI: participants[].registration.userId
        round.participants = parts.map(p => ({
            ...p,
            registration: { userId: p.userId }
        }));
    }

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

    if (!isManager) {
        try {
            if (tournament.type === 'LEAGUE') {
                leaderboardData = await getLeagueLeaderboard(tournamentId);
                individualData = await getIndividualLeaderboard(tournamentId);
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
            tournament.status,
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

    return (
        <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-10">
            {/* Back Button */}
            <div className="flex justify-start">
                <Link
                    href={`/centers/${centerId}`}
                    className="flex items-center gap-2 text-sm font-bold text-secondary-foreground hover:text-primary transition-colors group"
                >
                    <span className="text-lg group-hover:-translate-x-1 transition-transform">←</span>
                    대회 목록으로 돌아가기
                </Link>
            </div>

            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b-2 border-primary/20">
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 text-white text-xs font-bold rounded-full uppercase tracking-wider ${typeMap[safeTournament.type]?.color || 'bg-gray-500'}`}>
                            {typeMap[safeTournament.type]?.label || safeTournament.type}
                        </span>
                        <span className="text-secondary-foreground font-medium flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${safeTournament.status === 'FINISHED' ? 'bg-red-500' :
                                (safeTournament.status === 'ONGOING' || hasStarted) ? 'bg-blue-500' : 'bg-green-500'
                                }`}></span>
                            {safeTournament.status === 'FINISHED' ? '종료' :
                                (hasStarted ? '진행 중' : (statusMap[safeTournament.status]?.label || safeTournament.status))}
                        </span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black tracking-tight">
                        {displayName}
                        {safeTournament.type === 'EVENT' && ' (이벤트전)'}
                    </h1>
                    <div className="flex flex-wrap items-center gap-6 text-sm text-secondary-foreground font-medium">
                        <div className="flex items-center gap-2">
                            <span className="text-xl">📅</span>
                            {new Date(safeTournament.startDate).toLocaleDateString('ko-KR')} ~ {new Date(safeTournament.endDate).toLocaleDateString('ko-KR')}
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xl">💰</span>
                            {safeTournament.entryFee.toLocaleString()}원
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xl">🏠</span>
                            {safeTournament.center.name}
                        </div>
                    </div>
                </div>

                {isManager && (
                    <div className="flex items-center gap-3">
                        <DeleteTournamentButton tournamentId={safeTournament.id} />
                        <TournamentStatusDropdown
                            tournamentId={safeTournament.id}
                            currentStatus={safeTournament.status}
                            statusMap={statusMap}
                        />
                    </div>
                )}
            </div>

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
                />
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-10">
                        {/* 대회 개요 (Overview) section at the TOP */}
                        <section className="card p-0 overflow-hidden shadow-xl border-2 border-black">
                            <div className="p-6 bg-primary text-primary-foreground">
                                <h2 className="text-xl font-bold flex items-center gap-2">
                                    📝 대회 요강 및 개요
                                </h2>
                            </div>
                            <div className="p-8 space-y-8">
                                <TournamentDescriptionEditor
                                    tournamentId={safeTournament.id}
                                    initialDescription={safeTournament.description}
                                    isManager={isManager}
                                />

                                {(safeTournament.type === 'CHAMP' || safeTournament.type === 'EVENT') && safeTournament.settings && (
                                    <div className="mt-8 pt-8 border-t-2 border-dashed border-gray-100">
                                        <h3 className="text-xl font-black mb-6 flex items-center gap-2">
                                            <span className="text-2xl">📋</span> 상세 요강 안내
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12">
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
                                                    <div key={idx} className="flex items-start gap-4 border-b border-gray-100 pb-3">
                                                        <div className="text-sm font-bold text-gray-400 flex items-center gap-2 uppercase tracking-tight min-w-[100px] shrink-0">
                                                            <span>{item.icon}</span> {item.label}
                                                        </div>
                                                        <div className="font-black text-gray-800 break-all">{item.value}</div>
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
                        <div className="card p-6 border-l-8 border-primary shadow-lg bg-primary/5">
                            <h3 className="font-black text-lg mb-4 flex items-center gap-2">🏆 리더보드 (왕중왕전)</h3>
                            <p className="text-sm text-secondary-foreground mb-6 font-medium">대회가 진행됨에 따라 실시간 순위 데이터가 집계됩니다.</p>
                            <div className="flex flex-col">
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
                                                    className="btn btn-primary w-full text-sm font-black h-12 shadow-md flex items-center justify-center border-2 border-black bg-indigo-600 hover:bg-indigo-700 text-white mb-3"
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
                                            className="btn btn-primary w-full text-sm font-black h-12 shadow-md flex items-center justify-center border-2 border-black mb-3"
                                        >
                                            순위표 열기
                                        </Link>
                                        <Link
                                            href={`/centers/${centerId}/tournaments/${tournamentId}/individual-leaderboard`}
                                            className="btn btn-primary w-full text-sm font-black h-12 shadow-md flex items-center justify-center border-2 border-black mb-3"
                                        >
                                            개인 순위표
                                        </Link>
                                        <Link
                                            href={`/centers/${centerId}/tournaments/${tournamentId}/top30`}
                                            className="btn btn-primary w-full text-sm font-black h-12 shadow-md flex items-center justify-center border-2 border-black"
                                        >
                                            개인 평균 Top
                                        </Link>
                                    </>
                                )}
                            </div>
                        </div>

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
                            <section className="card p-8 border-2 border-black">
                                <div className="flex flex-col items-start gap-4 mb-8 border-b-2 border-slate-100 pb-6">
                                    <h2 className="text-2xl font-bold italic flex items-center gap-2">
                                        <span className="text-3xl">👥</span> 참가자 명단 ({safeTournament.registrations.length}/{safeTournament.maxParticipants})
                                    </h2>
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

                    <div className="space-y-8">

                        <div className="card p-6 border-2 border-black shadow-lg">
                            <h3 className="font-black text-lg mb-4">📍 참여 볼링장</h3>
                            <div className="space-y-2 mb-6">
                                <p className="font-black text-xl">{safeTournament.center.name}</p>
                                <p className="text-xs text-secondary-foreground font-medium">{safeTournament.center.address}</p>
                            </div>
                            <Link
                                href={`/centers/${centerId}`}
                                className="btn btn-secondary w-full font-bold border-2"
                            >
                                볼링장 정보 더보기
                            </Link>
                        </div>

                    </div>
                </div>
            )
            }
        </div >
    );
}
