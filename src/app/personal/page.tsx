import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";
import React from "react";
import YearSelector from "@/components/YearSelector";
import StatsDisplayRow from "@/components/StatsDisplayRow";

export default async function PersonalPage(props: { searchParams: Promise<{ year?: string }> }) {
    const searchParams = await props.searchParams;
    const session = await auth();
    if (!session?.user?.id) {
        redirect("/login");
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: {
            teamMemberships: { include: { team: true } },
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

    const activeYears = Array.from(new Set(allUserScores.map(s =>
        new Date(s.gameDate.getTime() + kstOffset).getFullYear()
    )));

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
            team: {
                select: { id: true, name: true }
            }
        },
        orderBy: {
            gameDate: 'desc'
        }
    });

    // 팀별 그룹화
    const scoresByTeam = new Map<string, { id: string, name: string, scores: typeof myYearlyScores }>();
    myYearlyScores.forEach(score => {
        const teamId = score.teamId || 'unknown';
        const teamName = score.team?.name || '소속 없음 (개인)';

        if (!scoresByTeam.has(teamId)) {
            scoresByTeam.set(teamId, { id: teamId, name: teamName, scores: [] });
        }
        scoresByTeam.get(teamId)!.scores.push(score);
    });



    // 전체 게임에 대한 분류별 필터링 (Global)
    const globalRegularScores = myYearlyScores.filter(s => s.gameType === '정기전');
    const globalImpromptuScores = myYearlyScores.filter(s => s.gameType === '벙개');
    const globalMatchScores = myYearlyScores.filter(s => s.gameType === '교류전');
    const globalResidentScores = myYearlyScores.filter(s => s.gameType === '상주');
    const globalOtherScores = myYearlyScores.filter(s => !['정기전', '벙개', '교류전', '상주'].includes(s.gameType || ''));

    // Check if owner of ANY team
    const isOwner = user.teamMemberships.some(tm => tm.team.ownerId === user.id);

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
                    {isOwner && (
                        <Link href="/score/add" className="btn btn-primary">
                            + 점수 기록하기
                        </Link>
                    )}
                </div>
            </div>

            <YearSelector currentYear={currentYear} activeYears={activeYears} />

            <div className="grid grid-cols-1 gap-8">
                <div className="card w-full">
                    <h2 className="mb-4 text-xl font-bold border-b pb-2">
                        {currentYear}년 개인 통계
                    </h2>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                        {/* 1. 전체 종합 (모든 팀 합산) */}
                        <div className="bg-muted/30 p-5 rounded-xl border border-border/50 shadow-sm pb-10">
                            <div className="mb-3 flex items-center gap-2">
                                <span className="text-lg font-bold">👑 전체 종합</span>
                                <span className="text-sm text-muted-foreground">(모든 팀 합산)</span>
                            </div>
                            <StatsDisplayRow title="Total" scores={myYearlyScores} />

                            {/* Global Breakdown */}
                            <div className="mt-4 pt-4 border-t border-dashed border-muted grid grid-cols-1 px-1" style={{ gap: '16px' }}>
                                {globalRegularScores.length > 0 && <StatsDisplayRow title="정기전 (전체)" scores={globalRegularScores} />}
                                {globalImpromptuScores.length > 0 && <StatsDisplayRow title="벙개 (전체)" scores={globalImpromptuScores} />}
                                {globalMatchScores.length > 0 && <StatsDisplayRow title="교류전 (전체)" scores={globalMatchScores} />}
                                {globalResidentScores.length > 0 && <StatsDisplayRow title="상주 (전체)" scores={globalResidentScores} />}
                                {globalOtherScores.length > 0 && <StatsDisplayRow title="기타 (전체)" scores={globalOtherScores} />}
                            </div>
                        </div>

                        {/* 2. 팀별 통계 Loop */}
                        {Array.from(scoresByTeam.values()).map((teamGroup) => {
                            const teamScores = teamGroup.scores;
                            const regular = teamScores.filter(s => s.gameType === '정기전');
                            const impromptu = teamScores.filter(s => s.gameType === '벙개');
                            const match = teamScores.filter(s => s.gameType === '교류전');
                            const resident = teamScores.filter(s => s.gameType === '상주');
                            const other = teamScores.filter(s => !['정기전', '벙개', '교류전', '상주'].includes(s.gameType || ''));

                            return (
                                <div key={teamGroup.id} className="border-t-2 border-dashed border-muted/50" style={{ marginTop: '28px', paddingTop: '14px' }}>
                                    <div className="flex items-center gap-2 mb-4 bg-secondary/10 p-2 rounded-lg border-l-4 border-primary">
                                        <h3 className="text-lg font-bold text-primary pl-1">
                                            🛡️ {teamGroup.name}
                                        </h3>
                                    </div>

                                    <div className="flex flex-col pl-2" style={{ gap: '20px' }}>
                                        {/* 팀 전체 */}
                                        <div className="pr-2">
                                            <StatsDisplayRow title="팀 전체" scores={teamScores} />
                                        </div>

                                        {/* 팀 내 세부 항목 */}
                                        <div className="grid grid-cols-1 px-2 border-l-2 ml-2 pl-4 border-dashed border-muted" style={{ gap: '16px' }}>
                                            {regular.length > 0 && <StatsDisplayRow title="정기전" scores={regular} />}
                                            {impromptu.length > 0 && <StatsDisplayRow title="벙개" scores={impromptu} />}
                                            {match.length > 0 && <StatsDisplayRow title="교류전" scores={match} />}
                                            {resident.length > 0 && <StatsDisplayRow title="상주" scores={resident} />}
                                            {other.length > 0 && <StatsDisplayRow title="기타" scores={other} />}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {myYearlyScores.length === 0 && (
                            <p className="text-center text-muted-foreground py-4">데이터가 없습니다.</p>
                        )}
                    </div>
                </div>

                <div className="card">
                    <h2 className="mb-4 text-xl font-bold border-b pb-2">
                        {currentYear}년 일별 기록
                    </h2>
                    {myYearlyScores.length === 0 ? (
                        <p className="text-center py-8 text-secondary-foreground">
                            아직 등록된 점수가 없습니다.
                        </p>
                    ) : (
                        <div className="flex flex-col border rounded-lg overflow-hidden divide-y divide-border">
                            {Array.from(
                                myYearlyScores.reduce((map, score) => {
                                    const kstOffset = 9 * 60 * 60 * 1000;
                                    const dateStr = new Date(score.gameDate.getTime() + kstOffset).toISOString().split('T')[0];
                                    if (!map.has(dateStr)) {
                                        map.set(dateStr, []);
                                    }
                                    map.get(dateStr)!.push(score);
                                    return map;
                                }, new Map<string, typeof myYearlyScores>())
                            ).map(([date, scores]) => {
                                const totalScore = scores.reduce((sum, s) => sum + s.score, 0);
                                const avg = (totalScore / scores.length).toFixed(1);

                                return (
                                    <div key={date} className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors">
                                        <div className="flex items-center gap-2 min-w-[140px]">
                                            <span className="font-semibold text-sm">{date}</span>
                                            <span className="text-xs text-muted-foreground px-1.5 py-0.5 bg-secondary rounded-full">{scores.length}게임</span>
                                        </div>

                                        <div className="flex-1 flex items-center overflow-x-auto mx-4 no-scrollbar">
                                            {scores.map((s, idx) => (
                                                <React.Fragment key={s.id}>
                                                    <span className={`text-sm ${s.score >= 200 ? 'font-semibold text-primary' : 'text-muted-foreground'}`}>
                                                        {s.score}
                                                    </span>
                                                    {idx < scores.length - 1 && (
                                                        <span className="text-muted-foreground/30 text-xs" style={{ margin: '0 15px' }}>|</span>
                                                    )}
                                                </React.Fragment>
                                            ))}
                                        </div>

                                        <div className="flex items-center gap-2 min-w-[180px] justify-end text-sm">
                                            <div className="flex items-center">
                                                <span className="text-muted-foreground mr-2">총점&nbsp;&nbsp;</span>
                                                <span className="font-medium text-foreground">{totalScore}</span>
                                            </div>
                                            <span className="text-muted-foreground/30 mx-2">|</span>
                                            <div className="flex items-center">
                                                <span className="text-muted-foreground mr-2">평균&nbsp;&nbsp;</span>
                                                <span className="font-bold text-accent">{avg}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
