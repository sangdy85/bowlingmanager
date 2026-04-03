import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";
import React from "react";
import YearSelector from "@/components/YearSelector";
import StatsDisplayRow from "@/components/StatsDisplayRow";
import RadarChart from "@/components/RadarChart";

export const dynamic = 'force-dynamic';

export default async function PersonalPage(props: { searchParams: Promise<{ year?: string }> }) {
    const searchParams = await props.searchParams;
    const session = await auth();
    if (!session?.user?.id) {
        redirect("/login");
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: {
            teamMemberships: {
                where: { team: { isActive: true } },
                include: {
                    team: {
                        include: { User: true }
                    }
                }
            },
        },
    });

    if (!user || user.teamMemberships.length === 0) {
        redirect("/dashboard");
    }

    // 년도 설정
    const kstOffset = 9 * 60 * 60 * 1000;
    const thisYear = new Date().getFullYear();

    // 사용자의 모든 점수 기록에서 연도 추출 (개인, 리그, 대회 통합)
    const [allUserScores, allLeagueRoundDates, allTournamentRoundDates] = await Promise.all([
        prisma.score.findMany({
            where: { userId: user.id },
            select: { gameDate: true }
        }),
        prisma.leagueMatchupIndividualScore.findMany({
            where: {
                OR: [
                    { userId: user.id },
                    { AND: [{ playerName: user.name }, { teamId: { in: user.teamMemberships.map((tm: any) => tm.teamId) } }] }
                ]
            },
            select: { LeagueMatchup: { select: { round: { select: { date: true } } } } }
        }),
        prisma.tournamentScore.findMany({
            where: {
                OR: [
                    { registration: { userId: user.id } },
                    { AND: [{ registration: { guestName: user.name } }, { registration: { teamId: { in: user.teamMemberships.map((tm: any) => tm.teamId) } } }] }
                ]
            },
            select: { round: { select: { date: true } } }
        })
    ]);

    const activeYearsSet = new Set<number>();
    allUserScores.forEach((s: any) => activeYearsSet.add(new Date(s.gameDate.getTime() + kstOffset).getFullYear()));
    allLeagueRoundDates.forEach((s: any) => {
        const d = s.LeagueMatchup?.round?.date;
        if (d) activeYearsSet.add(new Date(d.getTime() + kstOffset).getFullYear());
    });
    allTournamentRoundDates.forEach((s: any) => {
        const d = s.round?.date;
        if (d) activeYearsSet.add(new Date(d.getTime() + kstOffset).getFullYear());
    });

    const activeYears = Array.from(activeYearsSet) as number[];

    // 기록이 없으면 올해만 표시
    if (activeYears.length === 0) {
        activeYears.push(thisYear);
    }

    // URL에 연도가 없으면, 가장 최근 활동 연도(또는 올해)를 기본값으로 설정
    // URL에 연도가 있으면 그 값을 사용
    let currentYear = thisYear;
    if (searchParams.year) {
        currentYear = parseInt(searchParams.year);
    } else if (activeYears.length > 0) {
        currentYear = Math.max(...activeYears);
    }

    // 해당 연도의 시작과 끝 (KST 기준 처리가 필요할 수 있으나, native Date로 간단히 범위 설정)
    const startOfYear = new Date(`${currentYear}-01-01T00:00:00.000Z`);
    const endOfYear = new Date(`${currentYear}-12-31T23:59:59.999Z`);

    // 해당 연도 점수 조회
    const myYearlyScores = await prisma.score.findMany({
        where: {
            userId: user.id,
            gameDate: {
                gte: startOfYear,
                lte: endOfYear
            }
        },
        include: {
            Team: {
                select: { id: true, name: true }
            }
        },
        orderBy: {
            gameDate: 'desc'
        }
    });

    // --- 추가: 공식 기록 조회 (상주리그 & 대회) ---
    const userTeamIds = user.teamMemberships.map((tm: any) => tm.teamId);

    // 1. 상주리그 기록
    const currentTeamNames = user.teamMemberships.map((tm: any) => tm.team.name);

    const leagueScores = await prisma.leagueMatchupIndividualScore.findMany({
        where: {
            OR: [
                { userId: user.id },
                {
                    AND: [
                        { playerName: user.name },
                        { teamId: { in: userTeamIds } }
                    ]
                },
                {
                    AND: [
                        { playerName: user.name },
                        { Team: { name: { in: currentTeamNames } } }
                    ]
                }
            ],
            LeagueMatchup: {
                round: {
                    date: {
                        gte: startOfYear,
                        lte: endOfYear
                    }
                }
            }
        },
        include: {
            Team: { select: { name: true } },
            LeagueMatchup: {
                include: {
                    round: {
                        include: { tournament: { select: { name: true, type: true } } }
                    }
                }
            }
        }
    });

    // 2. 대회 기록 (챔프전/이벤트전)
    const tournamentScores = await prisma.tournamentScore.findMany({
        where: {
            OR: [
                { registration: { userId: user.id } },
                {
                    AND: [
                        { registration: { guestName: user.name } },
                        { registration: { teamId: { in: userTeamIds } } }
                    ]
                },
                {
                    AND: [
                        { registration: { guestName: user.name } },
                        { registration: { guestTeamName: { in: currentTeamNames } } }
                    ]
                }
            ],
            round: {
                date: {
                    gte: startOfYear,
                    lte: endOfYear
                }
            }
        },
        include: {
            registration: {
                include: {
                    tournament: { select: { name: true, type: true } },
                    team: { select: { name: true } }
                }
            },
            round: true
        }
    });

    // --- 공식 기록 데이터 그룹화 로직 ---
    const groupedOfficialMap = new Map<string, any>();

    // 1. 리그 기록 그룹화 (ls 하나가 1-3G 세트이므로 이미 그룹화하기 쉬움)
    leagueScores.forEach((ls: any) => {
        const gameDate = ls.LeagueMatchup.round.date || ls.createdAt;
        const dateStr = gameDate.toLocaleDateString();
        const tName = ls.LeagueMatchup.round.tournament.name;
        const rNum = ls.LeagueMatchup.round.roundNumber;
        const team = ls.Team.name;
        const key = `${dateStr}_${tName}_${rNum}_${team}`;

        const scores = [ls.score1, ls.score2, ls.score3].filter(s => s > 0);
        if (scores.length === 0) return;

        const total = scores.reduce((a, b) => a + b, 0);
        const avg = total / scores.length;

        groupedOfficialMap.set(key, {
            id: ls.id,
            date: gameDate,
            typeLabel: '상주리그',
            tournamentName: tName,
            roundNumber: rNum,
            teamName: team,
            scores,
            total,
            avg: avg.toFixed(1)
        });
    });

    // 2. 대회 기록 그룹화 
    tournamentScores.forEach((ts: any) => {
        const gameDate = ts.round?.date || ts.createdAt;
        const dateStr = gameDate.toLocaleDateString();
        const tName = ts.registration.tournament.name;
        const tType = ts.registration.tournament.type;
        const rNum = ts.round?.roundNumber;
        const team = ts.registration.team?.name || ts.registration.guestTeamName || '개인';
        const key = `${dateStr}_${tName}_${rNum}_${team}`;

        if (!groupedOfficialMap.has(key)) {
            groupedOfficialMap.set(key, {
                id: ts.id,
                date: gameDate,
                typeLabel: tType === 'EVENT' ? '이벤트전' : '챔프전',
                tournamentName: tName,
                roundNumber: rNum,
                teamName: team,
                scores: [],
                total: 0,
                avg: '0'
            });
        }

        const group = groupedOfficialMap.get(key);
        group.scores.push(ts.score);
        group.total += ts.score;
        group.avg = (group.total / group.scores.length).toFixed(1);
    });

    const officialRecords = Array.from(groupedOfficialMap.values())
        .sort((a, b) => b.date.getTime() - a.date.getTime());

    // --- 추가: 공식 기록 요약 데이터 산출 ---
    const officialSummary = {
        total: { games: 0, pins: 0 },
        league: { games: 0, pins: 0 },
        champ: { games: 0, pins: 0 },
        event: { games: 0, pins: 0 }
    };

    officialRecords.forEach(r => {
        const count = r.scores.length;
        const pins = r.total;
        officialSummary.total.games += count;
        officialSummary.total.pins += pins;
        if (r.typeLabel === '상주리그') {
            officialSummary.league.games += count;
            officialSummary.league.pins += pins;
        } else if (r.typeLabel === '챔프전') {
            officialSummary.champ.games += count;
            officialSummary.champ.pins += pins;
        } else if (r.typeLabel === '이벤트전') {
            officialSummary.event.games += count;
            officialSummary.event.pins += pins;
        }
    });

    // --- 통계 전처리 로직 재배치 ---
    const globalRegularScores = myYearlyScores.filter((s: any) => s.gameType === '정기전');
    const globalImpromptuScores = myYearlyScores.filter((s: any) => s.gameType === '벙개');
    const globalMatchScores = myYearlyScores.filter((s: any) => s.gameType === '교류전');
    const globalResidentScores = myYearlyScores.filter((s: any) => s.gameType === '상주');
    const globalOtherScores = myYearlyScores.filter((s: any) => !['정기전', '벙개', '교류전', '상주'].includes(s.gameType || ''));

    const officialOnlyScores = [
        ...leagueScores.flatMap((ls: any) => {
            const d = ls.LeagueMatchup.round.date || ls.createdAt;
            return [ls.score1, ls.score2, ls.score3]
                .filter(s => s > 0)
                .map(s => ({ score: s, gameDate: d }));
        }),
        ...tournamentScores.map((ts: any) => ({
            score: ts.score,
            gameDate: ts.round?.date || ts.createdAt
        }))
    ];

    const myYearlyScoresExcludingImpromptu = myYearlyScores.filter((s: any) => s.gameType !== '벙개');
    const allIntegratedScores = [
        ...myYearlyScoresExcludingImpromptu.map((s: any) => ({ score: s.score, gameDate: s.gameDate })),
        ...officialOnlyScores
    ];

    const officialOnlyStatsScores = [
        ...officialOnlyScores
    ];

    // 팀별 그룹화 (상주리그 팀 통합 로직 적용)
    const scoresByTeamName = new Map<string, { id: string, name: string, scores: typeof myYearlyScores }>();

    myYearlyScores.forEach((score: any) => {
        let teamName = score.Team?.name || '소속 없음 (개인)';

        // 상주리그 팀명 정규화 (예: '배볼러 A' -> '배볼러')
        if (teamName.match(/\s[AB]$/)) {
            teamName = teamName.slice(0, -2);
        }

        const teamKey = teamName;

        if (!scoresByTeamName.has(teamKey)) {
            scoresByTeamName.set(teamKey, {
                id: score.teamId || 'unknown',
                name: teamName,
                scores: []
            });
        }
        scoresByTeamName.get(teamKey)!.scores.push(score);
    });

    // Check if owner or manager of ANY team
    const hasAuthority = user.teamMemberships.some((tm: any) =>
        tm.team.ownerId === user.id ||
        (tm.team as any).User.some((m: any) => m.id === user.id)
    );

    // --- 평가 그래프 데이터 계산 (Radar Chart) ---
    // 1. 정기전 데이터
    const regularRoundsMap = new Map<string, { scores: number[], avg: number }>();
    globalRegularScores.forEach((s: any) => {
        const d = s.gameDate.toISOString().split('T')[0];
        if (!regularRoundsMap.has(d)) regularRoundsMap.set(d, { scores: [], avg: 0 });
        regularRoundsMap.get(d)!.scores.push(s.score);
    });
    regularRoundsMap.forEach(v => {
        v.avg = v.scores.reduce((a, b) => a + b, 0) / v.scores.length;
    });

    const regularRounds = Array.from(regularRoundsMap.values());
    const regAvg = regularRounds.length > 0 ? (regularRounds.reduce((a, b) => a + b.scores.reduce((c, d) => c + d, 0), 0) / regularRounds.reduce((a, b) => a + b.scores.length, 0)) : 0;
    const regMaxRoundAvg = regularRounds.length > 0 ? Math.max(...regularRounds.map(r => r.avg)) : 0;
    const regMinRoundAvg = regularRounds.length > 0 ? Math.min(...regularRounds.map(r => r.avg)) : 0;
    const regMaxScore = globalRegularScores.length > 0 ? Math.max(...globalRegularScores.map((s: any) => s.score)) : 0;
    const regMinScore = globalRegularScores.length > 0 ? Math.min(...globalRegularScores.map((s: any) => s.score)) : 0;
    const regHighLow = regMaxScore - regMinScore;

    // 정기전 출석률 계산
    const allTeamRegularScores = await prisma.score.findMany({
        where: {
            teamId: { in: userTeamIds },
            gameType: '정기전',
            gameDate: { gte: startOfYear, lte: endOfYear }
        },
        select: { gameDate: true }
    });
    const totalTeamRoundsCount = new Set(allTeamRegularScores.map((s: any) => s.gameDate.toISOString().split('T')[0])).size;
    const regAttendancePct = totalTeamRoundsCount > 0 ? (regularRounds.length / totalTeamRoundsCount) * 100 : 0;

    const calcRegPoint = (val: number, base: number, step: number) => {
        const p = 10 - (base - val) * step;
        return Math.min(10, Math.max(1, p));
    };

    const datasets = [];
    if (regularRounds.length >= 3) {
        datasets.push({
            label: '정기전',
            color: '#3b82f6',
            points: [
                calcRegPoint(regAvg, 234, 0.1),             // 기량
                calcRegPoint(regMaxRoundAvg, 250, 0.2),     // 포텐셜
                Math.min(10, Math.max(1, 10 - (regHighLow - 10) * 0.1)), // 기복
                calcRegPoint(regMinRoundAvg, 200, 0.1),     // 안정감
                Math.min(10, Math.max(1, regAttendancePct / 10)) // 성실
            ]
        });
    }

    // 2. 볼링장 대회 데이터
    if (officialRecords.length >= 3) {
        const offAvg = officialSummary.total.pins / (officialSummary.total.games || 1);
        const offMaxRoundAvg = Math.max(...officialRecords.map(r => parseFloat(r.avg)));
        const offMinRoundAvg = Math.min(...officialRecords.map(r => parseFloat(r.avg)));
        const offMaxScore = Math.max(...officialRecords.flatMap(r => r.scores));
        const offMinScore = Math.min(...officialRecords.flatMap(r => r.scores));
        const offHighLow = offMaxScore - offMinScore;
        const offAttendanceCount = officialRecords.length;

        datasets.push({
            label: '볼링장 대회',
            color: '#f59e0b',
            points: [
                calcRegPoint(offAvg, 234, 0.1),             // 기량
                calcRegPoint(offMaxRoundAvg, 250, 0.2),     // 포텐셜
                Math.min(10, Math.max(1, 10 - (offHighLow - 10) * 0.1)), // 기복
                calcRegPoint(offMinRoundAvg, 200, 0.1),     // 안정감
                Math.min(10, Math.max(1, offAttendanceCount)) // 성실
            ]
        });
    }

    return (
        <div className="container py-8 max-w-4xl mx-auto">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 text-[#0f172a]">
                <div>
                    <h1 className="page-title" style={{ fontSize: 'clamp(1.5rem, 5vw, 2.5rem)', fontWeight: 900 }}>나의 기록실</h1>
                    <p className="text-secondary-foreground text-sm font-bold">개인 기록과 통계를 확인합니다.</p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <Link href="/dashboard" className="btn btn-secondary flex-1 sm:flex-none text-center">
                        &larr; 메인
                    </Link>
                    {hasAuthority && (
                        <Link href="/score/add" className="btn btn-primary flex-1 sm:flex-none text-center">
                            + 점수 기록하기
                        </Link>
                    )}
                </div>
            </div>

            <YearSelector currentYear={currentYear} activeYears={activeYears} />

            {datasets.length > 0 && (
                <div className="mb-12 flex flex-row items-center justify-center gap-16">
                    {/* Left Column: Profile Info */}
                    <div className="flex flex-col justify-center">
                            <div className="text-white/60 text-[10px] font-black tracking-widest mb-1 uppercase">PLAYER PROFILE</div>
                            <h2 className="text-4xl font-black text-white mb-8 tracking-tight">{user.name} <span className="text-white/40 font-normal">선수</span></h2>
                            
                            <div className="space-y-4">
                                <div className="flex items-center gap-3 text-white">
                                    <span className="text-xl w-8 h-8 flex items-center justify-center bg-blue-500/10 rounded-lg border border-blue-500/20">📊</span>
                                    <span className="text-lg font-bold">에버: {regAvg.toFixed(1)}</span>
                                </div>
                                <div className="flex items-center gap-3 text-white">
                                    <span className="text-xl w-8 h-8 flex items-center justify-center bg-pink-500/10 rounded-lg border border-pink-500/20">🚀</span>
                                    <span className="text-lg font-bold">하이: {regMaxScore}</span>
                                </div>
                                <div className="flex items-center gap-3 text-white">
                                    <span className="text-xl w-8 h-8 flex items-center justify-center bg-purple-500/10 rounded-lg border border-purple-500/20">🎯</span>
                                    <span className="text-lg font-bold">출석: {regularRounds.length}회</span>
                                </div>
                                <div className="flex items-center gap-3 text-white">
                                    <span className="text-xl w-8 h-8 flex items-center justify-center bg-red-500/10 rounded-lg border border-red-500/20">📉</span>
                                    <span className="text-lg font-bold">편차: {regHighLow}</span>
                                </div>
                            </div>
                        </div>

                    {/* Right Column: Radar Chart */}
                    <div className="flex items-center justify-center">
                        <RadarChart 
                            datasets={datasets} 
                            labels={['기량(에버)', '포텐셜', '기복', '안정감', '성실']} 
                            size={400} 
                        />
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 gap-8">
                <div className="bg-[#1e293b] border border-[#334155] p-3 shadow-lg rounded-t-lg" style={{ borderBottom: '2px solid #3b82f6' }}>
                    <div className="flex items-center gap-2">
                        <span className="text-xl">📊</span>
                        <h2 className="font-black text-white text-base tracking-tight">
                            {currentYear}년 개인 통계 <span className="text-blue-400 ml-1 text-xs">STATISTICS</span>
                        </h2>
                    </div>
                </div>

                <div className="bg-white p-0 overflow-hidden">
                    {/* 1. 전체 종합 (모든 팀 합산) */}
                    <div className="table-responsive !p-0 !bg-white">
                        <table className="w-full text-[13px] border-collapse !bg-white !text-[#0f172a]" style={{ backgroundColor: 'white', color: '#0f172a', border: '1px solid #94a3b8' }}>
                            <thead>
                                <tr className="!bg-[#f2f2f2]" style={{ backgroundColor: '#f2f2f2' }}>
                                    <th className="p-2 border border-slate-400 !text-[#0f172a] font-black text-left" style={{ border: '1px solid #94a3b8', color: '#0f172a' }}>분류 (전체 종합)</th>
                                    <th className="p-2 border border-slate-300 !text-[#0f172a] font-black w-[60px] sm:w-[80px] text-center" style={{ border: '1px solid #94a3b8', color: '#0f172a' }}>게임수</th>
                                    <th className="p-2 border border-slate-300 !text-[#0f172a] font-black w-[80px] sm:w-[100px] text-center" style={{ border: '1px solid #94a3b8', color: '#0f172a' }}>총점</th>
                                    <th className="p-2 border border-slate-300 !text-[#0f172a] font-black w-[100px] sm:w-[120px] text-center" style={{ border: '1px solid #94a3b8', color: '#0f172a' }}>하이(시리즈)</th>
                                    <th className="p-2 border border-slate-300 !text-[#0f172a] font-black w-[80px] sm:w-[100px] text-center" style={{ border: '1px solid #94a3b8', color: '#0f172a' }}>하이(단게임)</th>
                                    <th className="p-2 border border-slate-300 !text-[#0f172a] font-black w-[60px] sm:w-[70px] text-center !bg-[#E7EBF1]" style={{ border: '1px solid #94a3b8', backgroundColor: '#E7EBF1', color: '#0f172a' }}>평균</th>
                                </tr>
                            </thead>
                            <tbody>
                                <StatsDisplayRow title="👑 통합 종합 (공식+개인 전체)" scores={allIntegratedScores as any} />
                                <StatsDisplayRow title="🎳 볼링장 공식 기록 (전체)" scores={officialOnlyStatsScores as any} />
                                {myYearlyScores.length > 0 && <StatsDisplayRow title="개인 기록 (전체)" scores={myYearlyScores as any} />}
                                {globalRegularScores.length > 0 && <StatsDisplayRow title="정기전 (전체)" scores={globalRegularScores} />}
                                {globalImpromptuScores.length > 0 && <StatsDisplayRow title="벙개 (전체)" scores={globalImpromptuScores} />}
                                {globalMatchScores.length > 0 && <StatsDisplayRow title="교류전 (전체)" scores={globalMatchScores} />}
                                {globalResidentScores.length > 0 && <StatsDisplayRow title="상주 (전체)" scores={globalResidentScores} />}
                                {globalOtherScores.length > 0 && <StatsDisplayRow title="기타 (전체)" scores={globalOtherScores} />}
                            </tbody>
                        </table>
                    </div>

                    {/* 2. 팀별 통계 Loop */}
                    {Array.from(scoresByTeamName.values()).map((teamGroup: any) => {
                        const teamScores = teamGroup.scores;
                        const regular = teamScores.filter((s: any) => s.gameType === '정기전');
                        const impromptu = teamScores.filter((s: any) => s.gameType === '벙개');
                        const match = teamScores.filter((s: any) => s.gameType === '교류전');
                        const resident = teamScores.filter((s: any) => s.gameType === '상주');
                        const other = teamScores.filter((s: any) => !['정기전', '벙개', '교류전', '상주'].includes(s.gameType || ''));

                        return (
                            <div key={teamGroup.id} className="table-responsive mt-4">
                                <table className="w-full text-[13px] border-collapse !bg-white !text-slate-900" style={{ backgroundColor: 'white', color: '#0f172a', border: '2px solid #64748b' }}>
                                    <thead>
                                        <tr className="!bg-[#f2f2f2]" style={{ backgroundColor: '#f2f2f2' }}>
                                            <th className="p-2 border border-slate-400 !text-blue-700 font-black text-left" style={{ border: '1px solid #94a3b8' }}>🛡️ {teamGroup.name}</th>
                                            <th className="p-2 border border-slate-300 !text-slate-900 font-black w-[60px] sm:w-[80px] text-center" style={{ border: '1px solid #94a3b8' }}>게임수</th>
                                            <th className="p-2 border border-slate-300 !text-slate-900 font-black w-[80px] sm:w-[100px] text-center" style={{ border: '1px solid #94a3b8' }}>총점</th>
                                            <th className="p-2 border border-slate-300 !text-slate-900 font-black w-[100px] sm:w-[120px] text-center" style={{ border: '1px solid #94a3b8' }}>하이(시리즈)</th>
                                            <th className="p-2 border border-slate-300 !text-slate-900 font-black w-[80px] sm:w-[100px] text-center" style={{ border: '1px solid #94a3b8' }}>하이(단게임)</th>
                                            <th className="p-2 border border-slate-300 !text-black font-black w-[60px] sm:w-[70px] text-center !bg-[#E7EBF1]" style={{ border: '1px solid #94a3b8', backgroundColor: '#E7EBF1' }}>평균</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <StatsDisplayRow title="팀 전체" scores={teamScores} />
                                        {regular.length > 0 && <StatsDisplayRow title="정기전" scores={regular} />}
                                        {impromptu.length > 0 && <StatsDisplayRow title="벙개" scores={impromptu} />}
                                        {match.length > 0 && <StatsDisplayRow title="교류전" scores={match} />}
                                        {resident.length > 0 && <StatsDisplayRow title="상주" scores={resident} />}
                                        {other.length > 0 && <StatsDisplayRow title="기타" scores={other} />}
                                    </tbody>
                                </table>
                            </div>
                        );
                    })}

                    {myYearlyScores.length === 0 && (
                        <p className="text-center text-slate-400 py-12 italic">데이터가 없습니다.</p>
                    )}
                </div>
            </div>

            <div className="card !bg-white !text-slate-900 border border-slate-400 shadow-none overflow-hidden p-0 rounded-none mb-4 mt-8" style={{ backgroundColor: 'white', border: '1px solid #94a3b8' }}>
                <div className="bg-[#1e293b] p-3 border-b-2 border-[#0f172a]" style={{ backgroundColor: '#1e293b', borderBottom: '2px solid #0f172a' }}>
                    <h2 className="text-sm font-black flex items-center gap-2 text-white" style={{ color: 'white' }}>
                        🎳 {currentYear}년 볼링장 공식 기록
                    </h2>
                </div>

                {/* 공식 기록 요약 표 */}
                <div className="p-0 sm:p-4 bg-white border-b border-slate-300">
                    <div className="table-responsive">
                        <table className="w-full text-xs border-collapse bg-white shadow-sm" style={{ border: '2px solid #94a3b8', minWidth: '350px' }}>
                            <thead>
                                <tr className="bg-slate-200">
                                    <th className="p-2 border border-slate-400 text-[#0f172a] font-bold" style={{ color: '#0f172a', border: '1px solid #94a3b8' }}>공식 기록 분류</th>
                                    <th className="p-2 border border-slate-400 text-[#0f172a] font-bold" style={{ color: '#0f172a', border: '1px solid #94a3b8' }}>게임수</th>
                                    <th className="p-2 border border-slate-400 text-[#0f172a] font-bold" style={{ color: '#0f172a', border: '1px solid #94a3b8' }}>총점</th>
                                    <th className="p-2 border border-slate-400 text-[#1d4ed8] font-black bg-blue-100" style={{ color: '#1d4ed8', border: '1px solid #94a3b8' }}>평균</th>
                                </tr>
                            </thead>
                            <tbody className="text-center font-bold" style={{ color: '#0f172a' }}>
                                <tr className="bg-blue-50/50">
                                    <td className="p-2 border border-slate-400 text-blue-900" style={{ color: '#111827', border: '1px solid #94a3b8' }}>🏛️ 공식 종합 기록</td>
                                    <td className="p-2 border border-slate-400" style={{ color: '#0f172a', border: '1px solid #94a3b8' }}>{officialSummary.total.games}</td>
                                    <td className="p-2 border border-slate-400" style={{ color: '#0f172a', border: '1px solid #94a3b8' }}>{officialSummary.total.pins.toLocaleString()}</td>
                                    <td className="p-2 border border-slate-400 text-blue-800" style={{ color: '#1e40af', border: '1px solid #94a3b8' }}>{(officialSummary.total.pins / (officialSummary.total.games || 1)).toFixed(1)}</td>
                                </tr>
                                <tr>
                                    <td className="p-2 border border-slate-400 text-indigo-900 text-left px-4" style={{ color: '#111827', border: '1px solid #94a3b8' }}>└ 상주리그</td>
                                    <td className="p-2 border border-slate-400" style={{ color: '#0f172a', border: '1px solid #94a3b8' }}>{officialSummary.league.games}</td>
                                    <td className="p-2 border border-slate-400" style={{ color: '#0f172a', border: '1px solid #94a3b8' }}>{officialSummary.league.pins.toLocaleString()}</td>
                                    <td className="p-2 border border-slate-400 text-slate-900" style={{ color: '#0f172a', border: '1px solid #94a3b8' }}>{(officialSummary.league.pins / (officialSummary.league.games || 1)).toFixed(1)}</td>
                                </tr>
                                <tr>
                                    <td className="p-2 border border-slate-400 text-amber-900 text-left px-4" style={{ color: '#111827', border: '1px solid #94a3b8' }}>└ 챔프전</td>
                                    <td className="p-2 border border-slate-400" style={{ color: '#0f172a', border: '1px solid #94a3b8' }}>{officialSummary.champ.games}</td>
                                    <td className="p-2 border border-slate-400" style={{ color: '#0f172a', border: '1px solid #94a3b8' }}>{officialSummary.champ.pins.toLocaleString()}</td>
                                    <td className="p-2 border border-slate-400 text-slate-900" style={{ color: '#0f172a', border: '1px solid #94a3b8' }}>{(officialSummary.champ.pins / (officialSummary.champ.games || 1)).toFixed(1)}</td>
                                </tr>
                                <tr>
                                    <td className="p-2 border border-slate-400 text-emerald-900 text-left px-4" style={{ color: '#111827', border: '1px solid #94a3b8' }}>└ 이벤트전</td>
                                    <td className="p-2 border border-slate-400" style={{ color: '#0f172a', border: '1px solid #94a3b8' }}>{officialSummary.event.games}</td>
                                    <td className="p-2 border border-slate-400" style={{ color: '#0f172a', border: '1px solid #94a3b8' }}>{officialSummary.event.pins.toLocaleString()}</td>
                                    <td className="p-2 border border-slate-400 text-slate-900" style={{ color: '#0f172a', border: '1px solid #94a3b8' }}>{(officialSummary.event.pins / (officialSummary.event.games || 1)).toFixed(1)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {officialRecords.length === 0 ? (
                    <p className="text-center py-8 !text-slate-400 text-xs italic">
                        아직 등록된 공식 경기 기록이 없습니다.
                    </p>
                ) : (
                    <div className="table-responsive !bg-white">
                        <table className="w-full text-[13px] border-collapse !bg-white !text-slate-900" style={{ backgroundColor: 'white', color: '#0f172a', border: '1px solid #94a3b8' }}>
                            <thead>
                                <tr className="!bg-[#f2f2f2]" style={{ backgroundColor: '#f2f2f2' }}>
                                    <th className="p-2 border border-slate-400 !text-slate-900 font-black w-[60px] sm:w-[80px] text-center" style={{ border: '1px solid #94a3b8' }}>날짜</th>
                                    <th className="p-2 border border-slate-400 !text-slate-900 font-black text-left" style={{ border: '1px solid #94a3b8' }}>대회 / 경기명</th>
                                    <th className="p-2 border border-slate-400 !text-slate-900 font-black w-[140px] sm:w-[180px] text-center" style={{ border: '1px solid #94a3b8' }}>게임별 기록</th>
                                    <th className="p-2 border border-slate-400 !text-slate-900 font-black w-[60px] sm:w-[80px] text-center" style={{ border: '1px solid #94a3b8' }}>총점</th>
                                    <th className="p-2 border border-slate-400 !text-slate-900 font-black w-[60px] sm:w-[70px] text-center !bg-[#E7EBF1]" style={{ border: '1px solid #94a3b8', backgroundColor: '#E7EBF1' }}>평균</th>
                                </tr>
                            </thead>
                            <tbody>
                                {officialRecords.map((record: any) => {
                                    const d = new Date(record.date);
                                    const dateLabel = `${d.getMonth() + 1}/${d.getDate()}`;

                                    return (
                                        <tr key={record.id} className="hover:!bg-slate-50 transition-colors group" style={{ backgroundColor: 'white' }}>
                                            <td className="p-2 border border-slate-400 text-center !text-slate-800 font-bold !bg-[#f8fafc]" style={{ border: '1px solid #94a3b8' }}>
                                                {dateLabel}
                                            </td>
                                            <td className="p-2 border border-slate-400 group-hover:!bg-white" style={{ border: '1px solid #94a3b8' }}>
                                                <div className="flex flex-col gap-0.5">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-[8px] font-black px-1 py-0.25 rounded-sm border ${record.typeLabel === '상주리그' ? '!bg-indigo-50 !text-indigo-700 !border-indigo-100' :
                                                            record.typeLabel === '이벤트전' ? '!bg-emerald-50 !text-emerald-700 !border-emerald-100' :
                                                                '!bg-amber-50 !text-amber-700 !border-amber-100'
                                                            }`}>
                                                            {record.typeLabel}
                                                        </span>
                                                        <span className="text-[9px] font-bold !text-slate-500">{record.teamName}</span>
                                                    </div>
                                                    <span className="text-[13px] font-black !text-slate-900 leading-tight">
                                                        {record.tournamentName} {record.roundNumber ? `${record.roundNumber}회차` : ''}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-2 border border-slate-400 text-center group-hover:!bg-white" style={{ border: '1px solid #94a3b8' }}>
                                                <div className="flex items-center justify-center gap-1 sm:gap-2 w-full">
                                                    {record.scores.map((s: number, idx: number) => (
                                                        <React.Fragment key={idx}>
                                                            <span className={`text-[13px] sm:text-[14px] font-black ${s >= 200 ? '!text-blue-700 italic' : '!text-slate-800'}`}>
                                                                {s}
                                                            </span>
                                                            {idx < record.scores.length - 1 && <span className="!text-slate-300 text-[10px]">|</span>}
                                                        </React.Fragment>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="p-2 border border-slate-400 text-center text-[13px] sm:text-[14px] font-black !text-slate-900 group-hover:!bg-white" style={{ border: '1px solid #94a3b8' }}>
                                                {record.total}
                                            </td>
                                            <td className="p-2 border border-slate-400 text-center text-[13px] sm:text-[14px] font-black !text-blue-800 !bg-[#E7EBF1] group-hover:!bg-[#d1d9e6]" style={{ border: '1px solid #94a3b8', backgroundColor: '#E7EBF1' }}>
                                                {record.avg}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="card !bg-white !text-slate-900 border border-slate-400 shadow-none overflow-hidden p-0 rounded-none mb-8 mt-8" style={{ backgroundColor: 'white', border: '1px solid #94a3b8' }}>
                <div className="bg-[#E7EBF1] p-2 border-b border-slate-400" style={{ backgroundColor: '#E7EBF1', borderBottom: '1px solid #94a3b8' }}>
                    <h2 className="text-sm font-black flex items-center gap-2" style={{ color: '#0f172a' }}>
                        📅 {currentYear}년 일별 기록
                    </h2>
                </div>
                {myYearlyScores.length === 0 ? (
                    <p className="text-center py-8 !text-slate-400 text-xs italic">
                        아직 등록된 점수가 없습니다.
                    </p>
                ) : (
                    <div className="table-responsive !bg-white">
                        <table className="w-full text-[13px] border-collapse !bg-white !text-slate-900" style={{ backgroundColor: 'white', color: '#0f172a', border: '1px solid #94a3b8' }}>
                            <thead>
                                <tr className="!bg-[#f2f2f2]" style={{ backgroundColor: '#f2f2f2' }}>
                                    <th className="p-2 border border-slate-400 !text-slate-900 font-black w-[60px] sm:w-[80px] text-center" style={{ border: '1px solid #94a3b8' }}>날짜</th>
                                    <th className="p-2 border border-slate-400 !text-slate-900 font-black w-[50px] sm:w-[70px] text-center" style={{ border: '1px solid #94a3b8' }}>게임수</th>
                                    <th className="p-2 border border-slate-400 !text-slate-900 font-black text-center" style={{ border: '1px solid #94a3b8' }}>게임별 점수</th>
                                    <th className="p-2 border border-slate-400 !text-slate-900 font-black w-[60px] sm:w-[80px] text-center" style={{ border: '1px solid #94a3b8' }}>총점</th>
                                    <th className="p-2 border border-slate-400 !text-slate-900 font-black w-[60px] sm:w-[70px] text-center !bg-[#E7EBF1]" style={{ border: '1px solid #94a3b8', backgroundColor: '#E7EBF1' }}>평균</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(Array.from(
                                    myYearlyScores.reduce((map: any, score: any) => {
                                        const kstOffset = 9 * 60 * 60 * 1000;
                                        const dateStr = new Date(score.gameDate.getTime() + kstOffset).toISOString().split('T')[0];
                                        if (!map.has(dateStr)) map.set(dateStr, []);
                                        map.get(dateStr)!.push(score);
                                        return map;
                                    }, new Map<string, any[]>())
                                ) as [string, any[]][]).map(([date, scores]) => {
                                    const totalScore = scores.reduce((sum: number, s: any) => sum + s.score, 0);
                                    const avg = (totalScore / scores.length).toFixed(1);

                                    return (
                                        <tr key={date} className="hover:!bg-slate-50 transition-colors group" style={{ backgroundColor: 'white' }}>
                                            <td className="p-2 border border-slate-400 text-center !text-slate-700 font-bold !bg-[#f8fafc]" style={{ border: '1px solid #94a3b8' }}>
                                                {date.split('-').slice(1).join('/')}
                                            </td>
                                            <td className="p-2 border border-slate-400 text-center font-bold !text-slate-800" style={{ border: '1px solid #94a3b8' }}>
                                                {scores.length}
                                            </td>
                                            <td className="p-2 border border-slate-400 group-hover:!bg-white px-4 text-center" style={{ border: '1px solid #94a3b8' }}>
                                                <div className="flex items-center justify-center gap-3 flex-wrap w-full">
                                                    {scores.map((s: any, idx: number) => (
                                                        <React.Fragment key={s.id}>
                                                            <span className={`text-[14px] font-black ${s.score >= 200 ? '!text-blue-700 italic' : '!text-slate-800'}`}>
                                                                {s.score}
                                                            </span>
                                                            {idx < scores.length - 1 && <span className="!text-slate-200 text-xs">|</span>}
                                                        </React.Fragment>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="p-2 border border-slate-400 text-center font-black !text-slate-900 group-hover:!bg-white text-[14px]" style={{ border: '1px solid #94a3b8' }}>
                                                {totalScore}
                                            </td>
                                            <td className="p-2 border border-slate-400 text-center font-black !text-blue-800 !bg-[#E7EBF1] group-hover:!bg-[#d1d9e6] text-[14px]" style={{ border: '1px solid #94a3b8', backgroundColor: '#E7EBF1' }}>
                                                {avg}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
