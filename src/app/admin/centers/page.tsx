import { requireAdminPage } from "@/components/dashboard/requireAdminPage";
import Link from "next/link";
import prisma from "@/lib/prisma";
import { createBowlingCenter, deleteBowlingCenter } from "@/app/actions/admin";
import CopyButton from "@/components/CopyButton";
import styles from "../AdminUI.module.css";
import { DashboardHeader, EmptyState, StatusBadge, dashboardStyles } from "@/components/dashboard/DashboardUI";

export default async function AdminCentersPage() {
    await requireAdminPage();
    const centers = await prisma.bowlingCenter.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
            owner: { select: { id: true, name: true, email: true } },
            managers: { select: { id: true, name: true, email: true }, orderBy: { name: 'asc' } },
        },
    });

    return (
        <div className={styles.page}>
            <DashboardHeader eyebrow="SYSTEM MANAGEMENT" title="볼링장 관리" description="볼링장별 소유자, 지정 관리자와 인증 코드를 확인하세요." actions={<StatusBadge tone="primary">등록 볼링장 {centers.length.toLocaleString("ko-KR")}곳</StatusBadge>} />
            <p className={styles.assignmentNotice}>지정 관리자는 이 볼링장에 연결된 계정입니다. 계정 역할만 변경해도 담당 볼링장이 자동으로 연결되지는 않습니다.</p>
            <AdminCenterModal />

            <div className={styles.list}>
                {centers.length === 0 ? (
                    <EmptyState title="등록된 볼링장이 없어요" description="새 볼링장을 등록하면 센터 정보와 인증 코드를 관리할 수 있습니다." />
                ) : (
                    centers.map((center) => (
                        <article key={center.id} className={styles.listCard}>
                            <div className={styles.listMain}>
                                <h2 className={styles.listTitle}>{center.name}</h2>
                                <p className={styles.listMeta}>{center.address}</p>
                                <dl className={styles.managerDirectory}>
                                    <div><dt>등록 소유자</dt><dd>{center.owner.name}<span>{center.owner.email}</span></dd></div>
                                    <div><dt>지정 관리자 {center.managers.length}명</dt><dd>{center.managers.length ? <ul>{center.managers.map(manager => <li key={manager.id}>{manager.name}<span>{manager.email}</span></li>)}</ul> : <StatusBadge tone="warning">아직 연결된 관리자가 없습니다</StatusBadge>}</dd></div>
                                </dl>
                                <div className={styles.code}>
                                    <span className={styles.listMeta}>전용 코드: {center.code}</span>
                                    <CopyButton text={center.code} />
                                </div>
                            </div>
                            <div className={styles.listActions}>
                                <Link href={`/centers/${center.id}`} className={`btn btn-secondary ${styles.smallButton}`}>볼링장 보기</Link>
                                <form action={deleteBowlingCenter.bind(null, center.id)}>
                                    <button aria-label={`${center.name} 볼링장 삭제`} className={`btn ${styles.smallButton} ${styles.dangerButton}`}>삭제</button>
                                </form>
                            </div>
                        </article>
                    ))
                )}
            </div>
        </div>
    );
}

function AdminCenterModal() {
    return (
        <details className={styles.registration}>
            <summary className={dashboardStyles.primaryButton}>＋ 새 볼링장 등록</summary>
            <div className={styles.registrationForm}>
                <h2>볼링장 정보 입력</h2>
                <form action={createBowlingCenter}>
                    <div><label htmlFor="center-name">볼링장 이름 (필수)</label><input id="center-name" name="name" required /></div>
                    <div><label htmlFor="center-phone">전화번호</label><input id="center-phone" name="phone" type="tel" /></div>
                    <div className={styles.wideField}><label htmlFor="center-address">주소 (필수)</label><input id="center-address" name="address" required /></div>
                    <div className={styles.wideField}><label htmlFor="center-description">설명</label><textarea id="center-description" name="description" /></div>
                    <button type="submit" className={dashboardStyles.primaryButton}>등록하기</button>
                </form>
            </div>
        </details>
    );
}
