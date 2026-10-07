import prisma from "@/lib/prisma";
import { deleteUser } from "@/app/actions/admin";
import UserRoleSelect from "@/components/admin/UserRoleSelect";
import styles from "../AdminUI.module.css";

export default async function AdminUsersPage() {
    const users = await prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
    });

    return (
        <div>
            <header className={styles.pageHeader}>
                <div>
                    <h1 className={styles.pageTitle}>계정 관리</h1>
                    <p className={styles.pageSubtitle}>사용자 권한과 계정 상태를 관리합니다.</p>
                </div>
            </header>

            <div className={styles.tableWrap}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>이름 / 이메일</th>
                            <th>권한</th>
                            <th style={{ textAlign: 'right' }}>작업</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((user) => (
                            <tr key={user.id}>
                                <td>
                                    <div style={{ fontWeight: 800 }}>{user.name}</div>
                                    <div style={{ color: '#94a3b8', fontSize: '0.7rem' }}>{user.email}</div>
                                </td>
                                <td>
                                    <UserRoleSelect userId={user.id} initialRole={user.role} />
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                    {user.email !== 'sangdy85' && (
                                        <form action={deleteUser.bind(null, user.id)}>
                                            <button className={`btn btn-secondary ${styles.smallButton}`}>삭제</button>
                                        </form>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
