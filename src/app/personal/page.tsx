import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";
import React from "react";
import YearSelector from "@/components/YearSelector";
import StatsDisplayRow from "@/components/StatsDisplayRow";

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

    // 사용자의 모든 점수 기록에서 연도 추출
    const allUserScores = await prisma.score.findMany({
        where: { userId: user.id },
        select: { gameDate: true }
    });

    const activeYears = Array.from(new Set(allUserScores.map((s: any) =>
        new Date(s.gameDate.getTime() + kstOffset).getFullYear()
    ))) as number[];

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



    // ... (imports)

    // Inside component ...

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
    const leagueScores = await prisma.leagueMatchupIndividualScore.findMany({
        where: {
            OR: [
                { userId: user.id },
                {
                    AND: [
                        { playerName: user.name },
                        { teamId: { in: userTeamIds } }
                    ]
                }
            ],
            createdAt: {
                gte: startOfYear,
                lte: endOfYear
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
                }
            ],
            createdAt: {
                gte: startOfYear,
                lte: endOfYear
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
        const dateStr = ls.createdAt.toLocaleDateString();
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
            date: ls.createdAt,
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
        const dateStr = ts.createdAt.toLocaleDateString();
        const tName = ts.registration.tournament.name;
        const tType = ts.registration.tournament.type;
        const rNum = ts.round?.roundNumber;
        const team = ts.registration.team?.name || ts.registration.guestTeamName || '개인';
        const key = `${dateStr}_${tName}_${rNum}_${team}`;

        if (!groupedOfficialMap.has(key)) {
            groupedOfficialMap.set(key, {
                id: ts.id,
                date: ts.createdAt,
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


    // 팀별 그룹화 (상주리그 팀 통합 로직 적용)
    const scoresByTeamName = new Map<string, { id: string, name: string, scores: typeof myYearlyScores }>();

    myYearlyScores.forEach((score: any) => {
        let teamName = score.Team?.name || '소속 없음 (개인)';

        // 상주리그 팀명 정규화 (예: '배볼러 A' -> '배볼러')
        // 끝이 ' A', ' B'로 끝나는 경우 제거
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

    // Convert to array
    const teamGroups = Array.from(scoresByTeamName.values());

    // 전체 게임에 대한 분류별 필터링 (Global)
    const globalRegularScores = myYearlyScores.filter((s: any) => s.gameType === '정기전');
    const globalImpromptuScores = myYearlyScores.filter((s: any) => s.gameType === '벙개');
    const globalMatchScores = myYearlyScores.filter((s: any) => s.gameType === '교류전');
    const globalResidentScores = myYearlyScores.filter((s: any) => s.gameType === '상주');
    const globalOtherScores = myYearlyScores.filter((s: any) => !['정기전', '벙개', '교류전', '상주'].includes(s.gameType || ''));

    // Check if owner or manager of ANY team
    const hasAuthority = user.teamMemberships.some((tm: any) =>
        tm.team.ownerId === user.id ||
        (tm.team as any).User.some((m: any) => m.id === user.id)
    );

    return (
        <div className="container py-8 max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 style={{ fontSize: '2rem' }}>나의 기록실</h1>
                    <p className="text-secondary-foreground">개인 기록과 통계를 확인합니다.</p>
                </div>
                <div className="flex gap-2">
                    <Link href="/dashboard" className="btn btn-secondary">
                        &larr; 메인
                    </Link>
                    {hasAuthority && (
                        <Link href="/score/add" className="btn btn-primary">
                            + 점수 기록하기
                        </Link>
                    )}
                </div>
            </div>

            <YearSelector currentYear={currentYear} activeYears={activeYears} />

            <div className="grid grid-cols-1 gap-8">
                <div className="bg-[#E7EBF1] border border-slate-400 p-2 font-black text-sm" style={{ border: '1px solid #94a3b8', color: '#0f172a' }}>
                    📊 {currentYear}년 개인 통계
                </div>

                <div className="overflow-x-auto p-0 !bg-white" style={{ backgroundColor: 'white' }}>
                    {/* 1. 전체 종합 (모든 팀 합산) */}
                    <table className="w-full text-[13px] border-collapse !bg-white !text-slate-900" style={{ backgroundColor: 'white', color: '#0f172a', border: '1px solid #94a3b8' }}>
                        <thead>
                            <tr className="!bg-[#f2f2f2]" style={{ backgroundColor: '#f2f2f2' }}>
                                <th className="p-2 border border-slate-400 !text-slate-900 font-black text-left" style={{ border: '1px solid #94a3b8' }}>분류 (전체 종합)</th>
                                <th className="p-2 border border-slate-300 !text-slate-900 font-black w-[80px] text-center" style={{ border: '1px solid #94a3b8' }}>게임수</th>
                                <th className="p-2 border border-slate-300 !text-slate-900 font-black w-[100px] text-center" style={{ border: '1px solid #94a3b8' }}>총점</th>
                                <th className="p-2 border border-slate-300 !text-slate-900 font-black w-[120px] text-center" style={{ border: '1px solid #94a3b8' }}>하이(시리즈)</th>
                                <th className="p-2 border border-slate-300 !text-slate-900 font-black w-[100px] text-center" style={{ border: '1px solid #94a3b8' }}>하이(단게임)</th>
                                <th className="p-2 border border-slate-300 !text-slate-900 font-black w-[70px] text-center !bg-[#E7EBF1]" style={{ border: '1px solid #94a3b8', backgroundColor: '#E7EBF1' }}>평균</th>
                            </tr>
                        </thead>
                        <tbody>
                            <StatsDisplayRow title="👑 전체 종합" scores={myYearlyScores as any} />
                            {globalRegularScores.length > 0 && <StatsDisplayRow title="정기전 (전체)" scores={globalRegularScores} />}
                            {globalImpromptuScores.length > 0 && <StatsDisplayRow title="벙개 (전체)" scores={globalImpromptuScores} />}
                            {globalMatchScores.length > 0 && <StatsDisplayRow title="교류전 (전체)" scores={globalMatchScores} />}
                            {globalResidentScores.length > 0 && <StatsDisplayRow title="상주 (전체)" scores={globalResidentScores} />}
                            {globalOtherScores.length > 0 && <StatsDisplayRow title="기타 (전체)" scores={globalOtherScores} />}
                        </tbody>
                    </table>

                    {/* 2. 팀별 통계 Loop */}
                    {Array.from(scoresByTeamName.values()).map((teamGroup: any) => {
                        const teamScores = teamGroup.scores;
                        const regular = teamScores.filter((s: any) => s.gameType === '정기전');
                        const impromptu = teamScores.filter((s: any) => s.gameType === '벙개');
                        const match = teamScores.filter((s: any) => s.gameType === '교류전');
                        const resident = teamScores.filter((s: any) => s.gameType === '상주');
                        const other = teamScores.filter((s: any) => !['정기전', '벙개', '교류전', '상주'].includes(s.gameType || ''));

                        return (
                            <table key={teamGroup.id} className="w-full text-[13px] border-collapse !bg-white !text-slate-900 mt-4" style={{ backgroundColor: 'white', color: '#0f172a', border: '2px solid #64748b' }}>
                                <thead>
                                    <tr className="!bg-[#f2f2f2]" style={{ backgroundColor: '#f2f2f2' }}>
                                        <th className="p-2 border border-slate-400 !text-blue-700 font-black text-left" style={{ border: '1px solid #94a3b8' }}>🛡️ {teamGroup.name}</th>
                                        <th className="p-2 border border-slate-300 !text-slate-900 font-black w-[80px] text-center" style={{ border: '1px solid #94a3b8' }}>게임수</th>
                                        <th className="p-2 border border-slate-300 !text-slate-900 font-black w-[100px] text-center" style={{ border: '1px solid #94a3b8' }}>총점</th>
                                        <th className="p-2 border border-slate-300 !text-slate-900 font-black w-[120px] text-center" style={{ border: '1px solid #94a3b8' }}>하이(시리즈)</th>
                                        <th className="p-2 border border-slate-300 !text-slate-900 font-black w-[100px] text-center" style={{ border: '1px solid #94a3b8' }}>하이(단게임)</th>
                                        <th className="p-2 border border-slate-300 !text-black font-black w-[70px] text-center !bg-[#E7EBF1]" style={{ border: '1px solid #94a3b8', backgroundColor: '#E7EBF1' }}>평균</th>
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
                        );
                    })}

                    {myYearlyScores.length === 0 && (
                        <p className="text-center text-slate-400 py-12 italic">데이터가 없습니다.</p>
                    )}
                </div>
            </div>

            <div className="card !bg-white !text-slate-900 border border-slate-400 shadow-none overflow-hidden p-0 rounded-none mb-4" style={{ backgroundColor: 'white', border: '1px solid #94a3b8' }}>
                <div className="bg-[#E7EBF1] p-2 border-b border-slate-400" style={{ backgroundColor: '#E7EBF1', borderBottom: '1px solid #94a3b8' }}>
                    <h2 className="text-sm font-black flex items-center gap-2" style={{ color: '#0f172a' }}>
                        🎳 {currentYear}년 볼링장 공식 기록
                    </h2>
                </div>

                {officialRecords.length === 0 ? (
                    <p className="text-center py-8 !text-slate-400 text-xs italic">
                        아직 등록된 공식 경기 기록이 없습니다.
                    </p>
                ) : (
                    <div className="overflow-x-auto !bg-white" style={{ backgroundColor: 'white' }}>
                        <table className="w-full text-[13px] border-collapse !bg-white !text-slate-900" style={{ backgroundColor: 'white', color: '#0f172a', border: '1px solid #94a3b8' }}>
                            <thead>
                                <tr className="!bg-[#f2f2f2]" style={{ backgroundColor: '#f2f2f2' }}>
                                    <th className="p-2 border border-slate-400 !text-slate-900 font-black w-[80px] text-center" style={{ border: '1px solid #94a3b8' }}>날짜</th>
                                    <th className="p-2 border border-slate-400 !text-slate-900 font-black text-left" style={{ border: '1px solid #94a3b8' }}>대회 / 경기명</th>
                                    <th className="p-2 border border-slate-400 !text-slate-900 font-black w-[180px] text-center" style={{ border: '1px solid #94a3b8' }}>게임별 기록</th>
                                    <th className="p-2 border border-slate-400 !text-slate-900 font-black w-[80px] text-center" style={{ border: '1px solid #94a3b8' }}>총점</th>
                                    <th className="p-2 border border-slate-400 !text-slate-900 font-black w-[70px] text-center !bg-[#E7EBF1]" style={{ border: '1px solid #94a3b8', backgroundColor: '#E7EBF1' }}>평균</th>
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
                                                <div className="flex items-center justify-center gap-2">
                                                    {record.scores.map((s: number, idx: number) => (
                                                        <React.Fragment key={idx}>
                                                            <span className={`text-[14px] font-black ${s >= 200 ? '!text-blue-700 italic' : '!text-slate-800'}`}>
                                                                {s}
                                                            </span>
                                                            {idx < record.scores.length - 1 && <span className="!text-slate-300 text-[10px]">|</span>}
                                                        </React.Fragment>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="p-2 border border-slate-400 text-center text-[14px] font-black !text-slate-900 group-hover:!bg-white" style={{ border: '1px solid #94a3b8' }}>
                                                {record.total}
                                            </td>
                                            <td className="p-2 border border-slate-400 text-center text-[14px] font-black !text-blue-800 !bg-[#E7EBF1] group-hover:!bg-[#d1d9e6]" style={{ border: '1px solid #94a3b8', backgroundColor: '#E7EBF1' }}>
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

            <div className="card !bg-white !text-slate-900 border border-slate-400 shadow-none overflow-hidden p-0 rounded-none mb-8" style={{ backgroundColor: 'white', border: '1px solid #94a3b8' }}>
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
                    <div className="overflow-x-auto !bg-white" style={{ backgroundColor: 'white' }}>
                        <table className="w-full text-[13px] border-collapse !bg-white !text-slate-900" style={{ backgroundColor: 'white', color: '#0f172a', border: '1px solid #94a3b8' }}>
                            <thead>
                                <tr className="!bg-[#f2f2f2]" style={{ backgroundColor: '#f2f2f2' }}>
                                    <th className="p-2 border border-slate-400 !text-slate-900 font-black w-[80px] text-center" style={{ border: '1px solid #94a3b8' }}>날짜</th>
                                    <th className="p-2 border border-slate-400 !text-slate-900 font-black w-[70px] text-center" style={{ border: '1px solid #94a3b8' }}>게임수</th>
                                    <th className="p-2 border border-slate-400 !text-slate-900 font-black text-center" style={{ border: '1px solid #94a3b8' }}>게임별 점수</th>
                                    <th className="p-2 border border-slate-400 !text-slate-900 font-black w-[80px] text-center" style={{ border: '1px solid #94a3b8' }}>총점</th>
                                    <th className="p-2 border border-slate-400 !text-slate-900 font-black w-[70px] text-center !bg-[#E7EBF1]" style={{ border: '1px solid #94a3b8', backgroundColor: '#E7EBF1' }}>평균</th>
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
                                                <div className="flex items-center justify-center gap-3 flex-wrap">
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
