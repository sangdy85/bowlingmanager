import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import styles from "./AdminUI.module.css";

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await auth();

    if (session?.user?.role !== "SUPER_ADMIN") {
        redirect("/");
    }

    return (
        <div className={styles.layout}>
            <aside className={styles.sidebar}>
                <h2 className={styles.sidebarTitle}>시스템 관리</h2>
                <nav className={styles.nav}>
                        <Link
                            href="/admin"
                            className={styles.navLink}
                        >
                            대시보드
                        </Link>
                        <Link
                            href="/admin/centers"
                            className={styles.navLink}
                        >
                            볼링장 관리
                        </Link>
                        <Link
                            href="/admin/teams"
                            className={styles.navLink}
                        >
                            팀 관리
                        </Link>
                        <Link
                            href="/admin/users"
                            className={styles.navLink}
                        >
                            계정 관리
                        </Link>
                </nav>
            </aside>

            <main className={styles.main}>
                <div className={styles.content}>
                    {children}
                </div>
            </main>
        </div>
    );
}
