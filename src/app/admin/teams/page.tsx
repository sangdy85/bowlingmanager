import prisma from "@/lib/prisma";
import { deleteTeam, setTeamBowlerHiddenEnabled } from "@/app/actions/admin";
import Link from 'next/link';
import styles from "../AdminUI.module.css";

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
        <div>
            <header className={styles.pageHeader}>
                <div>
                    <h1 className={styles.pageTitle}>팀 관리</h1>
                    <p className={styles.pageSubtitle}>활성 팀과 고급 기능 상태를 관리합니다.</p>
                </div>
            </header>

            <div className={styles.list}>
                {teams.length === 0 ? (
                    <div className={styles.empty}>등록된 팀이 없습니다.</div>
                ) : (
                    teams.map((team) => (
                        <article key={team.id} className={`card ${styles.listCard}`}>
                            <div className={styles.listMain}>
                                <h3 className={styles.listTitle}>{team.name}</h3>
                                <p className={styles.listMeta}>
                                    코드 {team.code} · 팀원 {team._count.members}명 · 생성일 {team.createdAt.toLocaleDateString('ko-KR')}
                                </p>
                                <p className={styles.listMeta}>Bowler Hidden: {team.bowlerHiddenEnabled ? "ON" : "OFF"}</p>
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
                                    <button className={`btn btn-secondary ${styles.smallButton}`}>팀 삭제</button>
                                </form>
                            </div>
                        </article>
                    ))
                )}
            </div>
        </div>
    );
}
