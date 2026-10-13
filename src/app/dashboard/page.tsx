import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { DashboardShell, DashboardHeader, EmptyState, dashboardStyles as styles } from "@/components/dashboard/DashboardUI";
import { redirect } from "next/navigation";

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
    const session = await auth();
    if (!session?.user?.id) {
        redirect("/login");
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: {
            teamMemberships: {
                where: {
                    team: { isActive: true }
                },
                include: { team: true }
            },
        },
    });

    if (!user) {
        redirect("/login");
    }

    return <DashboardShell current="dashboard">
        <DashboardHeader eyebrow="YOUR BOWLING SPACE" title={`환영합니다, ${user.name}님`} description={user.teamMemberships.length ? user.teamMemberships.map(membership => membership.team.name).join(" · ") : "팀과 함께 첫 기록을 시작해 보세요."} />
        {user.teamMemberships.length === 0 ? <EmptyState title="아직 소속된 팀이 없어요" description="볼링 점수를 관리하려면 팀을 만들거나 기존 팀에 가입하세요." action={<div className={styles.quickActions}><Link className={styles.primaryButton} href="/team/create">팀 만들기</Link><Link className={styles.secondaryButton} href="/team/join">팀 가입하기</Link></div>} /> : <div className={styles.actionGrid}>
            <Link className={styles.actionCard} href="/personal"><h2>나의 기록실</h2><p>평균 점수부터 최근 경기까지,<br />나의 변화를 한눈에 확인하세요.</p><span>기록 확인하기 →</span></Link>
            <Link className={styles.actionCard} href="/team"><h2>팀 관리</h2><p>소속된 팀의 기록을 확인하고<br />멤버들과 함께하세요.</p><span>소속 팀 보기 →</span></Link>
            <Link className={styles.actionCard} href="/stats"><h2>통계 / 순위</h2><p>팀 내 순위와 성장 추이를<br />자세히 살펴보세요.</p><span>통계 확인하기 →</span></Link>
        </div>}
    </DashboardShell>;
}
