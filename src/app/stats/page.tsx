import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";
import YearSelector from "@/components/YearSelector";

export const dynamic = 'force-dynamic';

interface StatsPageProps {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function StatsPage({ searchParams }: StatsPageProps) {
    const session = await auth();
    if (!session?.user?.id) {
        redirect("/login");
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: {
            teamMemberships: {
                where: { team: { isActive: true } },
                include: { team: true }
            }
        }
    });

    if (!user || user.teamMemberships.length === 0) {
        redirect("/dashboard");
    }

    const currentTeam = user.teamMemberships[0].team; // Currently defaulting to first team

    const resolvedSearchParams = await searchParams;
    const currentYear = resolvedSearchParams.year
        ? parseInt(resolvedSearchParams.year as string)
        : new Date().getFullYear();

    const startOfYear = new Date(`${currentYear}-01-01T00:00:00.000Z`);
    const endOfYear = new Date(`${currentYear}-12-31T23:59:59.999Z`);

    // Fetch all scores for the team in this year
    const scores = await prisma.score.findMany({
        where: {
            teamId: currentTeam.id,
            gameDate: {
                gte: startOfYear,
                lte: endOfYear
            }
        },
        include: { User: true }
    });

    // Calculate Member Stats
    const memberStats: { [userId: string]: { name: string, total: number, count: number, high: number } } = {};

    scores.forEach(score => {
        if (!score.userId) return; // Skip guest scores without userId in member stats

        if (!memberStats[score.userId]) {
            memberStats[score.userId] = {
                name: score.User?.name || '알 수 없음',
                total: 0,
                count: 0,
                high: 0
            };
        }
        const member = memberStats[score.userId];
        member.total += score.score;
        member.count++;
        if (score.score > member.high) member.high = score.score;
    });

    const rankings = Object.values(memberStats).map(m => ({
        ...m,
        avg: m.count > 0 ? m.total / m.count : 0
    })).sort((a, b) => b.avg - a.avg);

    return (
        <div className="container py-8 max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 style={{ fontSize: '2rem' }}>통계 및 순위</h1>
                    <p className="text-secondary-foreground">{currentTeam.name} 팀의 기록 현황입니다.</p>
                </div>
                <Link href="/dashboard" className="btn btn-secondary">
                    &larr; 메인
                </Link>
            </div>

            <YearSelector currentYear={currentYear} />

            <div className="card mb-8">
                <h2 className="text-xl font-bold mb-4 border-b pb-2">팀원 랭킹 ({currentYear}년)</h2>
                {rankings.length === 0 ? (
                    <div className="text-center py-8 text-secondary-foreground">
                        데이터가 없습니다.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-center border-collapse">
                            <thead className="bg-muted">
                                <tr>
                                    <th className="p-3 border">순위</th>
                                    <th className="p-3 border">이름</th>
                                    <th className="p-3 border">게임 수</th>
                                    <th className="p-3 border">총점</th>
                                    <th className="p-3 border">평균</th>
                                    <th className="p-3 border">하이 스코어</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rankings.map((member, index) => (
                                    <tr key={index} className="hover:bg-muted/50">
                                        <td className="p-3 border font-bold text-lg">
                                            {index + 1}
                                            {index === 0 && " 👑"}
                                        </td>
                                        <td className="p-3 border font-medium">{member.name}</td>
                                        <td className="p-3 border">{member.count}</td>
                                        <td className="p-3 border">{member.total}</td>
                                        <td className="p-3 border font-bold text-accent text-lg">{member.avg.toFixed(1)}</td>
                                        <td className="p-3 border text-primary font-semibold">{member.high}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="card text-center py-12 text-secondary-foreground bg-muted/20">
                <h3 className="text-lg font-semibold mb-2">개인 기록 추이</h3>
                <p>개인별 성장 그래프 기능이 곧 추가될 예정입니다.</p>
            </div>
        </div>
    );
}
