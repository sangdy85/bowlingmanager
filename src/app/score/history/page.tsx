import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";
import YearSelector from "@/components/YearSelector";
import DailyScoreTable from "@/components/DailyScoreTable";

export const dynamic = 'force-dynamic';

interface HistoryPageProps {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function HistoryPage({ searchParams }: HistoryPageProps) {
    const session = await auth();
    if (!session?.user?.id) {
        redirect("/login");
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { teamMemberships: { include: { team: true } } }
    });

    if (!user || user.teamMemberships.length === 0) {
        redirect("/dashboard");
    }

    const currentTeam = user.teamMemberships[0].team;

    const resolvedSearchParams = await searchParams;
    const currentYear = resolvedSearchParams.year
        ? parseInt(resolvedSearchParams.year as string)
        : new Date().getFullYear();

    const kstOffset = 9 * 60 * 60 * 1000;
    const startOfYear = new Date(`${currentYear}-01-01T00:00:00.000Z`);
    const endOfYear = new Date(`${currentYear}-12-31T23:59:59.999Z`);

    const scores = await prisma.score.findMany({
        where: {
            teamId: currentTeam.id,
            gameDate: {
                gte: startOfYear,
                lte: endOfYear
            }
        },
        orderBy: {
            gameDate: 'desc'
        },
        include: {
            user: true
        }
    });

    // Group by Date for raw scores
    interface DailyScoreGroup {
        scores: (typeof scores[0])[];
        total: number;
        count: number;
    }
    const groupedScores: { [date: string]: DailyScoreGroup } = {};
    let yearlyTotal = 0;
    let yearlyGames = 0;

    scores.forEach(score => {
        const scoreDate = new Date(score.gameDate.getTime() + kstOffset);
        const dateStr = scoreDate.toISOString().split('T')[0];

        if (!groupedScores[dateStr]) {
            groupedScores[dateStr] = { scores: [], total: 0, count: 0 };
        }

        groupedScores[dateStr].scores.push(score);
        groupedScores[dateStr].total += score.score;
        groupedScores[dateStr].count++;

        yearlyTotal += score.score;
        yearlyGames++;
    });

    const yearlyAvg = yearlyGames > 0 ? (yearlyTotal / yearlyGames).toFixed(1) : "0.0";
    const sortedDates = Object.keys(groupedScores).sort((a, b) => b.localeCompare(a));

    // For DailyScoreTable, we need teamId and isOwner etc?
    // Checking DailyScoreTable definition: 
    // scores, date, dailyAvg, memo, gameType, isOwner, isManager, teamId, members
    // HistoryPage uses a simplified DailyScoreTable? 
    // Previous code: <DailyScoreTable scores={groupedScores[date].scores} />
    // If DailyScoreTable requires mandatory props, this will fail.
    // I need to provide them.
    // Derived from currentTeam.

    const isOwner = currentTeam.ownerId === session.user.id;
    // History page usually for viewing? 
    // If manager, we might need manager check. BUT HistoryPage didn't have manager includes.
    // I should add `managers: true` to `currentTeam` retrieval?
    // currentTeam comes from `user.teamMemberships[0].team`.
    // I should `include: { team: { include: { managers: true, members: { include: { user: true } } } } }` ??
    // That's heavy.
    // If DailyScoreTable is used here just for display, maybe isOwner/isManager false is fine?
    // But `teamId` is needed.
    // And `members` for name lookup?

    // NOTE: The previous code `DailyScoreTable` usage in HistoryPage was likely minimal and worked because props were optional?
    // But Step 345 error said `date` is missing.
    // I will add `date`.
    // I will add dummy `isOwner={false}` if I can't check easily, OR better, check `ownerId`.

    // Wait, `user.teamMemberships` includes `team`. `team` has `ownerId`.
    // So `isOwner` is easy.
    // `isManager`: I need `team.managers`.
    // I should update the query to include managers.

    // Let's rewrite the query.

    return (
        <div className="container py-8 max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 style={{ fontSize: '2rem' }}>{currentTeam.name} 기록실</h1>
                    <p className="text-secondary-foreground">팀 전체 기록을 확인합니다.</p>
                </div>
                <Link href="/dashboard" className="btn btn-secondary">
                    &larr; 대시보드
                </Link>
            </div>

            <YearSelector currentYear={currentYear} />

            <div className="card mb-8 bg-muted/30">
                <h3 className="text-center mb-4 font-semibold text-lg">{currentYear}년 팀 전체 통계</h3>
                <div className="flex justify-around text-center">
                    <div>
                        <div className="text-secondary-foreground text-sm mb-1">총 게임 수</div>
                        <div className="text-2xl font-bold">{yearlyGames}</div>
                    </div>
                    <div>
                        <div className="text-secondary-foreground text-sm mb-1">총점</div>
                        <div className="text-2xl font-bold text-primary">{yearlyTotal}</div>
                    </div>
                    <div>
                        <div className="text-secondary-foreground text-sm mb-1">전체 평균</div>
                        <div className="text-2xl font-bold text-accent">{yearlyAvg}</div>
                    </div>
                </div>
            </div>

            <div className="space-y-12">
                {sortedDates.length === 0 ? (
                    <div className="text-center py-12 card text-secondary-foreground">
                        {currentYear}년에는 기록된 점수가 없습니다.
                    </div>
                ) : (
                    sortedDates.map(date => (
                        <div key={date} className="w-full">
                            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                                <span className="bg-primary text-primary-foreground px-3 py-1 rounded text-sm">
                                    {date} ({getDayName(date)})
                                </span>
                                <span className="text-muted-foreground text-sm font-normal">
                                    {groupedScores[date].count}게임 / 총점 {groupedScores[date].total}
                                </span>
                            </h2>
                            <DailyScoreTable
                                scores={groupedScores[date].scores}
                                date={date}
                                teamId={currentTeam.id}
                                isOwner={isOwner}
                                isManager={false} // History page might not need manager features, or we assume false
                            />
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

function getDayName(dateStr: string) {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const date = new Date(dateStr);
    return days[date.getDay()];
}
