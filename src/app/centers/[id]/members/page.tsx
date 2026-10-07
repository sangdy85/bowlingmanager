import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { removeCenterMember } from "@/app/actions/center-members";
import MemberSearchModal from "@/components/tournaments/MemberSearchModal";
import CenterGuestManager from "@/components/tournaments/CenterGuestManager";
import styles from "../CenterAdmin.module.css";

export default async function CenterMembersPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const session = await auth();

    const center = await prisma.bowlingCenter.findUnique({
        where: { id },
        include: {
            managers: true,
            CenterMember: {
                include: { User: true },
                orderBy: { joinedAt: 'desc' }
            }
        }
    }) as any;

    if (!center) notFound();

    const isManager = center.managers.some((m: any) => m.id === session?.user?.id);
    if (!isManager) {
        redirect(`/centers/${id}`);
    }

    const members = center.CenterMember || [];

    // Prepare simplified member list for guest manager
    const guestManagerMembers = members.map((m: any) => ({
        id: m.User.id,
        name: m.User.name,
        email: m.User.email,
        alias: m.alias || null
    }));

    return (
        <div className={styles.page}>
            <Link href={`/centers/${id}`} className={styles.back}>
                <span className={styles.backIcon} aria-hidden="true">←</span>
                <span>볼링장 정보로 돌아가기</span>
            </Link>

            <header className={styles.hero}>
                <div>
                    <h1 className={styles.title}>{center.name} 회원 관리</h1>
                    <p className={styles.subtitle}>상주 회원 추가·탈퇴와 비회원 기록 통합을 관리합니다.</p>
                </div>
                <div className={styles.count}>
                    <span className={styles.countLabel}>상주 회원</span>
                    <strong className={styles.countValue}>{members.length}명</strong>
                </div>
            </header>

            <div className={styles.layout}>
                <main className={styles.main}>
                    <section className={styles.section}>
                        <div className={styles.sectionHeader}>
                            <div>
                                <h2 className={styles.sectionTitle}>상주 회원 목록</h2>
                                <p className={styles.sectionHint}>센터에 연결된 회원 계정을 확인합니다.</p>
                            </div>
                        </div>
                        <div className={styles.sectionBody}>
                            {members.length === 0 ? (
                                <div className={styles.empty}>등록된 상주 회원이 없습니다.</div>
                            ) : (
                                <div className={styles.list}>
                                    {members.map((member: any) => (
                                        <div key={member.id} className={styles.row}>
                                            <div className={styles.person}>
                                                <div className={styles.avatar}>{member.User.name.charAt(0)}</div>
                                                <div style={{ minWidth: 0 }}>
                                                    <div className={styles.name}>
                                                        {member.User.name}
                                                        {member.alias && <span style={{ color: '#94a3b8', fontWeight: 650 }}> ({member.alias})</span>}
                                                    </div>
                                                    <div className={styles.meta}>{member.User.email}</div>
                                                </div>
                                            </div>
                                            <form action={removeCenterMember.bind(null, id, member.id)}>
                                                <button className={styles.dangerButton}>회원 탈퇴</button>
                                            </form>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </section>

                    <CenterGuestManager centerId={id} members={guestManagerMembers} />
                </main>

                <aside className={styles.sidebar}>
                    <section className={styles.section}>
                        <div className={styles.sectionHeader}>
                            <div>
                                <h3 className={styles.sectionTitle}>회원 추가</h3>
                                <p className={styles.sectionHint}>이름 또는 이메일로 가입 회원을 검색합니다.</p>
                            </div>
                        </div>
                        <div className={styles.sectionBody}>
                            <MemberSearchModal centerId={id} />
                            <p className={styles.meta} style={{ marginTop: '0.65rem', textAlign: 'center' }}>
                                이미 BowlingManager에 가입된 회원만 검색할 수 있습니다.
                            </p>
                        </div>
                    </section>
                </aside>
            </div>
        </div>
    );
}
