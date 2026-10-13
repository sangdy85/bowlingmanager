import prisma from "@/lib/prisma";
import { deleteTeam, setTeamBowlerHiddenEnabled } from "@/app/actions/admin";
import Link from 'next/link';
import styles from "../AdminUI.module.css";
import { DashboardHeader, EmptyState, StatusBadge } from "@/components/dashboard/DashboardUI";

export default async function AdminTeamsPage() {
    const teams = await prisma.team.findMany({
        where: { isActive: true },
        include: {
            _count: {
                select: { members: true }
            }
        },
        orderBy: { createdAt: 'desc' },
    });

    return (
        <div className={styles.page}>
            <DashboardHeader eyebrow="SYSTEM MANAGEMENT" title="팀 관리" description="활성 팀과 팀원 수, 고급 기능 상태를 확인하세요." actions={<StatusBadge tone="primary">활성 팀 {teams.length.toLocaleString("ko-KR")}개</StatusBadge>} />

            <div className={styles.list}>
                {teams.length === 0 ? (
                    <EmptyState title="등록된 활성 팀이 없어요" description="팀이 등록되면 팀원 수와 고급 기능 상태를 확인할 수 있습니다." />
                ) : (
                    teams.map((team) => (
                        <article key={team.id} className={styles.listCard}>
                            <div className={styles.listMain}>
                                <h2 className={styles.listTitle}>{team.name}</h2>
                                <p className={styles.listMeta}>
                                    코드 {team.code} · 팀원 {team._count.members}명 · 생성일 {team.createdAt.toLocaleDateString('ko-KR')}
                                </p>
                                <p className={styles.listMeta}>Bowler Hidden · <StatusBadge tone={team.bowlerHiddenEnabled ? "success" : "neutral"}>{team.bowlerHiddenEnabled ? "사용 중" : "꺼짐"}</StatusBadge></p>
                            </div>

                            <div className={styles.listActions}>
                                <form action={setTeamBowlerHiddenEnabled.bind(null, team.id, !team.bowlerHiddenEnabled)}>
                                    <button className={`btn btn-secondary ${styles.smallButton}`}>
                                        {team.bowlerHiddenEnabled ? "고급 기능 끄기" : "고급 기능 켜기"}
                                    </button>
                                </form>
                                <Link href={`/team/${team.id}`} className={`btn btn-secondary ${styles.smallButton}`}>
                                    기록 보기
                                </Link>
                                <form action={deleteTeam.bind(null, team.id)}>
                                    <button aria-label={`${team.name} 팀 삭제`} className={`btn ${styles.smallButton} ${styles.dangerButton}`}>팀 삭제</button>
                                </form>
                            </div>
                        </article>
                    ))
                )}
            </div>
        </div>
    );
}
