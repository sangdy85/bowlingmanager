import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";
import YearSelector from "@/components/YearSelector";
import styles from "./StatsPage.module.css";

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

    // Fetch available years for the team
    const allTeamScores = await prisma.score.findMany({
        where: { teamId: currentTeam.id },
        select: { gameDate: true }
    });
    const activeYears = Array.from<number>(new Set(allTeamScores.map((s: { gameDate: Date }) => s.gameDate.getFullYear()))).sort((a, b) => b - a);

    // Fetch all scores for the team in this year (only regular games)
    const scores = await prisma.score.findMany({
        where: {
            teamId: currentTeam.id,
            gameType: '정기전',
            gameDate: {
                gte: startOfYear,
                lte: endOfYear
            }
        },
        include: { User: true }
    });

    // Calculate Member Stats
    const memberStats: { [userId: string]: { name: string, total: number, count: number, high: number } } = {};

    scores.forEach((score: any) => {
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
        <div className={styles.page}>
            <header className={styles.header}>
                <div>
                    <h1 className={styles.title}>통계 및 순위</h1>
                    <p className={styles.subtitle}>{currentTeam.name} 팀의 기록 현황입니다.</p>
                </div>
                <Link href="/dashboard" className={`btn btn-secondary ${styles.backButton}`}>
                    ← 메인
                </Link>
            </header>

            <YearSelector currentYear={currentYear} activeYears={activeYears} />

            <section className={`card ${styles.card}`}>
                <div className={styles.cardHeader}>
                    <h2 className={styles.cardTitle}>팀원 랭킹 · {currentYear}년</h2>
                </div>

                {rankings.length === 0 ? (
                    <div className={styles.empty}>데이터가 없습니다.</div>
                ) : (
                    <div className={styles.tableWrap}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>순위</th>
                                    <th>이름</th>
                                    <th>게임 수</th>
                                    <th>총점</th>
                                    <th>평균</th>
                                    <th>하이 스코어</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rankings.map((member, index) => (
                                    <tr key={index}>
                                        <td className={styles.rank}>
                                            {index + 1}{index === 0 && " 👑"}
                                        </td>
                                        <td>{member.name}</td>
                                        <td>{member.count}</td>
                                        <td>{member.total.toLocaleString()}</td>
                                        <td className={styles.avg}>{member.avg.toFixed(1)}</td>
                                        <td className={styles.high}>{member.high}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            <section className={`card ${styles.comingSoon}`}>
                <h3>개인 기록 추이</h3>
                <p>개인별 성장 그래프 기능이 곧 추가될 예정입니다.</p>
            </section>
        </div>
    );
}
