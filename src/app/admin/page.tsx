import { requireAdminPage } from "@/components/dashboard/requireAdminPage";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { DashboardHeader, DashboardSection, StatCard, StatusBadge, dashboardStyles } from "@/components/dashboard/DashboardUI";
import styles from "./AdminUI.module.css";

export default async function AdminDashboardPage() {
    await requireAdminPage();
    const [userCount, teamCount, centerCount] = await Promise.all([
        prisma.user.count(),
        prisma.team.count(),
        prisma.bowlingCenter.count(),
    ]);

    return <>
        <DashboardHeader eyebrow="ADMIN OVERVIEW" title="운영 대시보드" description="회원부터 볼링장까지, 서비스 운영 현황을 한눈에 확인하세요." actions={<Link href="/admin/centers" className={dashboardStyles.primaryButton}>볼링장 관리 <span aria-hidden="true">↗</span></Link>} />
        <dl className={styles.metrics} aria-label="전체 서비스 현황">
            <StatCard label="총 사용자" value={userCount.toLocaleString("ko-KR")} unit="명" note="등록된 전체 계정" featured />
            <StatCard label="총 팀" value={teamCount.toLocaleString("ko-KR")} unit="개" note="비활성 팀을 포함한 전체 팀" />
            <StatCard label="등록된 볼링장" value={centerCount.toLocaleString("ko-KR")} unit="곳" note="서비스에 등록된 전체 볼링장" />
        </dl>
        <DashboardSection id="admin-management" title="서비스 관리" description="관리할 항목을 선택해 운영을 이어가세요." action={<StatusBadge tone="primary">최고 관리자</StatusBadge>}>
            <div className={styles.cards}>
                {[
                    { href: "/competitions/manage", icon: "▦", title: "대회정보 관리", text: "공개 대회 일정과 요강을 등록하고 목록·달력으로 안내합니다.", action: "대회정보 관리하기" },
                    { href: "/community/moderation", icon: "☷", title: "커뮤니티 관리", text: "게시글·용품 후기의 신고 사유와 공개 상태를 관리합니다.", action: "신고·숨김 관리하기" },
                    { href: "/admin/centers", icon: "⚑", title: "볼링장 관리", text: "볼링장을 등록하고 센터 정보와 전용 인증 코드를 관리합니다.", action: "볼링장 관리하기" },
                    { href: "/admin/teams", icon: "♧", title: "팀 관리", text: "활성 팀과 팀원 수를 확인하고 고급 기능을 관리합니다.", action: "팀 관리하기" },
                    { href: "/admin/users", icon: "◎", title: "계정 관리", text: "등록된 계정을 확인하고 사용자 권한을 관리합니다.", action: "계정 관리하기" },
                ].map(item => <Link key={item.href} href={item.href} className={styles.actionCard}><span className={styles.cardIcon} aria-hidden="true">{item.icon}</span><h3>{item.title}</h3><p>{item.text}</p><span className={styles.cardCta}>{item.action} <span aria-hidden="true">→</span></span></Link>)}
            </div>
        </DashboardSection>
        <DashboardSection id="admin-operations" title="운영 바로가기" description="대회 일정과 사용자 문의를 확인하세요.">
            <div className={styles.operations}>
                <Link href="/centers" className={styles.operationLink}><span className={styles.operationIcon} aria-hidden="true">▥</span><div><h3>볼링장 · 대회</h3><p>볼링장별 대회 일정을 확인하고 운영 화면으로 이동합니다.</p></div><span aria-hidden="true">↗</span></Link>
                <Link href="/inquiry" className={styles.operationLink}><span className={styles.operationIcon} aria-hidden="true">✉</span><div><h3>문의 관리</h3><p>접수된 문의와 답변 상태를 확인합니다.</p></div><span aria-hidden="true">↗</span></Link>
            </div>
        </DashboardSection>
        <p className={styles.scopeNote}>대회 운영과 회비·게임비 관리는 해당 볼링장 또는 팀의 관리 화면에서 진행할 수 있습니다.</p>
    </>;
}
