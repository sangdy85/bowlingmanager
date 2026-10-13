import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./DashboardUI.module.css";

type DashboardNavigationItem = { href: string; label: string; key: string; icon: string };

export function DashboardShell({ children, current = "personal", navigation, title = "MY BOWLING", caption = "나의 볼링 공간" }: { children: ReactNode; current?: string; navigation?: DashboardNavigationItem[]; title?: string; caption?: string }) {
    return <div className={styles.shell} data-dashboard-shell>
        <a className={styles.skipLink} href="#dashboard-content">대시보드 본문으로 이동</a>
        <aside className={styles.sidebar} aria-label={`${caption} 탐색`}>
            <div className={styles.brand}><span aria-hidden="true">◉</span> {title}</div>
            <p className={styles.navCaption}>{caption}</p>
            <nav className={styles.navigation} aria-label="대시보드 메뉴">
                {(navigation ?? [
                    { href: "/dashboard", label: "대시보드", key: "dashboard", icon: "⌂" },
                    { href: "/personal", label: "나의 기록실", key: "personal", icon: "◷" },
                    { href: "/team", label: "팀 관리", key: "team", icon: "♧" },
                    { href: "/stats", label: "통계 / 순위", key: "stats", icon: "▥" },
                    { href: "/centers", label: "볼링장 / 대회", key: "centers", icon: "⚑" },
                ]).map(item => <Link key={item.key} href={item.href} aria-current={current === item.key ? "page" : undefined}>
                    <span aria-hidden="true">{item.icon}</span>{item.label}
                </Link>)}
            </nav>
            {!navigation && <div className={styles.sidebarNote}><strong>한 게임씩, 더 나은 기록.</strong><p>나의 기록을 돌아보고<br />다음 게임을 준비하세요.</p><Link href="/guide">볼링 가이드 보기 →</Link></div>}
        </aside>
        <div id="dashboard-content" className={styles.content} tabIndex={-1}>{children}</div>
    </div>;
}

export function DashboardHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: ReactNode; actions?: ReactNode }) {
    return <header className={styles.header}><div>{eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}<h1>{title}</h1>{description && <div className={styles.description}>{description}</div>}</div>{actions && <div className={styles.headerActions}>{actions}</div>}</header>;
}

export function DashboardSection({ id, title, description, action, children }: { id: string; title: string; description?: string; action?: ReactNode; children: ReactNode }) {
    return <section className={styles.section} aria-labelledby={id}><div className={styles.sectionHeader}><div><h2 id={id}>{title}</h2>{description && <p>{description}</p>}</div>{action}</div>{children}</section>;
}

export function StatCard({ label, value, unit, note, featured = false }: { label: string; value: ReactNode; unit?: string; note: string; featured?: boolean }) {
    return <div className={`${styles.statCard} ${featured ? styles.featured : ""}`}><dt>{label}</dt><dd>{value}{unit && <span>{unit}</span>}</dd><p>{note}</p></div>;
}

export function StatusBadge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "primary" | "success" | "warning" | "danger" }) {
    return <span className={styles.badge} data-tone={tone}>{children}</span>;
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
    return <div className={styles.emptyState}><span className={styles.emptyIcon} aria-hidden="true">◎</span><h2>{title}</h2><p>{description}</p>{action}</div>;
}

export function DashboardQuickActions({ canAddScore }: { canAddScore: boolean }) {
    return <div className={styles.quickActions} aria-label="기록 바로가기">
        {canAddScore && <Link href="/score/add" className={styles.primaryButton}><span aria-hidden="true">＋</span>점수 등록</Link>}
        <Link href="#personal-details" className={styles.secondaryButton}>상세 기록 보기 <span aria-hidden="true">↗</span></Link>
    </div>;
}

export function LoadingSkeleton() {
    return <div className={styles.loading} role="status" aria-label="대시보드 불러오는 중"><span>기록을 불러오는 중입니다.</span><div className={styles.statGrid} aria-hidden="true">{[0, 1, 2, 3].map(key => <div className={styles.skeleton} key={key} />)}</div><div className={styles.skeletonChart} aria-hidden="true" /></div>;
}

export { styles as dashboardStyles };
