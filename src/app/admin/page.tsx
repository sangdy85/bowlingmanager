import prisma from "@/lib/prisma";
import Link from "next/link";
import styles from "./AdminUI.module.css";

export default async function AdminDashboardPage() {
    const [userCount, teamCount, centerCount] = await Promise.all([
        prisma.user.count(),
        prisma.team.count(),
        prisma.bowlingCenter.count(),
    ]);

    return (
        <div>
            <header className={styles.pageHeader}>
                <div>
                    <h1 className={styles.pageTitle}>시스템 현황</h1>
                    <p className={styles.pageSubtitle}>사용자, 팀, 볼링장 현황과 관리 메뉴를 확인합니다.</p>
                </div>
            </header>

            <section className={styles.metrics}>
                <div className={styles.metric}>
                    <span className={styles.metricLabel}>총 사용자</span>
                    <strong className={styles.metricValue}>{userCount}명</strong>
                </div>
                <div className={styles.metric}>
                    <span className={styles.metricLabel}>총 팀</span>
                    <strong className={styles.metricValue}>{teamCount}개</strong>
                </div>
                <div className={styles.metric}>
                    <span className={styles.metricLabel}>등록된 볼링장</span>
                    <strong className={styles.metricValue}>{centerCount}곳</strong>
                </div>
            </section>

            <section className={styles.cards}>
                <Link href="/admin/centers" className={styles.cardLink}>
                    <article className={`card ${styles.actionCard}`}>
                        <div className={styles.cardIcon}>🏢</div>
                        <h2 className={styles.cardTitle}>볼링장 관리</h2>
                        <p className={styles.cardText}>새로운 볼링장을 등록하고 전용 인증 코드를 관리합니다.</p>
                    </article>
                </Link>
                <Link href="/admin/teams" className={styles.cardLink}>
                    <article className={`card ${styles.actionCard}`}>
                        <div className={styles.cardIcon}>👥</div>
                        <h2 className={styles.cardTitle}>팀 관리</h2>
                        <p className={styles.cardText}>생성된 모든 팀의 현황을 파악하고 정보를 관리합니다.</p>
                    </article>
                </Link>
                <Link href="/admin/users" className={styles.cardLink}>
                    <article className={`card ${styles.actionCard}`}>
                        <div className={styles.cardIcon}>👤</div>
                        <h2 className={styles.cardTitle}>계정 관리</h2>
                        <p className={styles.cardText}>사용자 권한을 조정하고 계정을 관리합니다.</p>
                    </article>
                </Link>
            </section>

            <section className={`card ${styles.info}`}>
                <h2>관리자 안내</h2>
                <p>
                    관리 메뉴에서 볼링장, 팀, 계정을 관리할 수 있습니다. 볼링장 관리에서는 새로운 센터와 전용 인증 코드를 생성할 수 있습니다.
                </p>
            </section>
        </div>
    );
}
