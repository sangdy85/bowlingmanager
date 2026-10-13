import Link from "next/link";
import prisma from "@/lib/prisma";
import { deleteUser } from "@/app/actions/admin";
import UserRoleSelect from "@/components/admin/UserRoleSelect";
import styles from "../AdminUI.module.css";
import { DashboardHeader, EmptyState, StatusBadge } from "@/components/dashboard/DashboardUI";

export default async function AdminUsersPage() {
    const users = await prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
            managedCenters: { select: { id: true, name: true, address: true }, orderBy: { name: 'asc' } },
            ownedCenters: { select: { id: true, name: true, address: true }, orderBy: { name: 'asc' } },
        },
    });

    return (
        <div className={styles.page}>
            <DashboardHeader eyebrow="SYSTEM MANAGEMENT" title="계정 관리" description="계정 역할과 담당 볼링장을 함께 확인하세요." actions={<StatusBadge tone="primary">전체 계정 {users.length.toLocaleString("ko-KR")}명</StatusBadge>} />

            <p className={styles.assignmentNotice}>계정 역할과 담당 볼링장 연결은 별개입니다. 담당 연결은 해당 사용자가 계정 설정에서 볼링장 인증 코드를 등록하면 반영됩니다. 아래 목록에서 등록 소유자와 지정 관리자를 구분할 수 있습니다.</p>
            {users.length === 0 ? <EmptyState title="등록된 계정이 없어요" description="사용자가 가입하면 계정 목록에 표시됩니다." /> : <div className={styles.tableWrap} role="region" aria-label="계정 목록, 좁은 화면에서는 가로로 스크롤" tabIndex={0}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th scope="col">이름 / 이메일</th>
                            <th scope="col">계정 역할</th>
                            <th scope="col">담당 볼링장</th>
                            <th scope="col" style={{ textAlign: 'right' }}>작업</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((user) => {
                            const linkedCenters = new Map<string, { id: string; name: string; address: string; owner: boolean; manager: boolean }>();
                            user.ownedCenters.forEach(center => linkedCenters.set(center.id, { ...center, owner: true, manager: false }));
                            user.managedCenters.forEach(center => linkedCenters.set(center.id, { ...center, owner: linkedCenters.get(center.id)?.owner ?? false, manager: true }));
                            return (
                            <tr key={user.id}>
                                <td>
                                    <div style={{ fontWeight: 800 }}>{user.name}</div>
                                    <div className={styles.listMeta}>{user.email}</div>
                                </td>
                                <td>
                                    <UserRoleSelect label={`${user.name} 계정 권한`} userId={user.id} initialRole={user.role} />
                                </td>
                                <td className={styles.affiliationCell}>
                                    {linkedCenters.size ? <ul className={styles.affiliationList}>{Array.from(linkedCenters.values()).map(center => <li key={center.id}>
                                        <Link href={`/centers/${center.id}`} className={styles.centerLink}>{center.name}</Link>
                                        <p className={styles.listMeta}>{center.address}</p>
                                        <div className={styles.relationBadges}>{center.owner && <StatusBadge>등록 소유자</StatusBadge>}{center.manager && <StatusBadge tone="primary">지정 관리자</StatusBadge>}</div>
                                    </li>)}</ul> : <StatusBadge tone={user.role === "CENTER_ADMIN" ? "warning" : "neutral"}>{user.role === "CENTER_ADMIN" ? "담당 볼링장 미연결" : "연결 없음"}</StatusBadge>}
                                    {user.role === "CENTER_ADMIN" && linkedCenters.size > 0 && user.managedCenters.length === 0 && <p className={styles.listMeta}>지정 관리자 연결 없음 · 소유 관계만 등록되어 있습니다.</p>}
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                    {user.email !== 'sangdy85' && (
                                        <form action={deleteUser.bind(null, user.id)}>
                                            <button aria-label={`${user.name} 계정 삭제`} className={`btn ${styles.smallButton} ${styles.dangerButton}`}>삭제</button>
                                        </form>
                                    )}
                                </td>
                            </tr>
                        );})}
                    </tbody>
                </table>
            </div>}
        </div>
    );
}
