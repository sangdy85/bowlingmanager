import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";
import TeamCodeSection from "@/components/TeamCodeSection";
import styles from "./TeamList.module.css";

export const dynamic = 'force-dynamic';

export default async function TeamListPage() {
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
                include: {
                    team: {
                        include: {
                            _count: {
                                select: { members: true }
                            }
                        }
                    }
                }
            }
        }
    });

    if (!user) {
        redirect("/login");
    }

    // If user has no teams, suggest creating or joining one (or redirect to join page?)
    if (user.teamMemberships.length === 0) {
        // Maybe redirect to dashboard or show a "Join a Team" message
        return (
            <div className={styles.empty}>
                <h1 className={styles.emptyTitle}>소속된 팀이 없습니다</h1>
                <p className={styles.emptyText}>팀에 가입하거나 소속을 만들어보세요.</p>
                <Link href="/dashboard" className="btn btn-primary">
                    대시보드로 이동
                </Link>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <h1 className={styles.title}>나의 팀 목록</h1>
                <div className={styles.actions}>
                    <Link href="/team/create" className={`btn btn-primary ${styles.actionButton}`}>
                        + 팀 만들기
                    </Link>
                    <Link href="/team/join" className={`btn btn-secondary ${styles.actionButton}`}>
                        팀 가입하기
                    </Link>
                </div>
            </header>

            <div className={styles.list}>
                {user.teamMemberships.map(({ team }) => (
                    <Link key={team.id} href={`/team/${team.id}`} className={styles.teamLink}>
                        <article className={`card ${styles.card}`}>
                            <div className={styles.teamMain}>
                                <h2 className={styles.teamName}>{team.name}</h2>
                                <div className={styles.teamMeta}>
                                    <span>멤버 수: {team._count.members}명</span>
                                    <TeamCodeSection code={team.code} />
                                </div>
                            </div>
                            <span className={styles.enter}>입장하기 →</span>
                        </article>
                    </Link>
                ))}
            </div>

            <div className={styles.footer}>
                <Link href="/dashboard" className={styles.back}>
                    ← 메인으로 돌아가기
                </Link>
            </div>
        </div>
    );
}
