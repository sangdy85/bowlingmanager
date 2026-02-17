import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

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
        <div className="flex bg-background min-h-[calc(100vh-64px)] overflow-hidden">
            {/* Sidebar */}
            <aside className="w-64 border-r bg-secondary/5 shrink-0 sticky top-16 h-[calc(100vh-64px)] overflow-y-auto">
                <div className="p-6">
                    <h2 className="text-lg font-bold mb-6 text-primary">시스템 관리</h2>
                    <nav className="flex flex-col gap-1">
                        <Link
                            href="/admin"
                            className="px-4 py-2 rounded-md hover:bg-secondary/20 transition-colors text-sm font-medium"
                        >
                            대시보드
                        </Link>
                        <Link
                            href="/admin/centers"
                            className="px-4 py-2 rounded-md hover:bg-secondary/20 transition-colors text-sm font-medium"
                        >
                            볼링장 관리
                        </Link>
                        <Link
                            href="/admin/teams"
                            className="px-4 py-2 rounded-md hover:bg-secondary/20 transition-colors text-sm font-medium"
                        >
                            팀 관리
                        </Link>
                        <Link
                            href="/admin/users"
                            className="px-4 py-2 rounded-md hover:bg-secondary/20 transition-colors text-sm font-medium"
                        >
                            계정 관리
                        </Link>
                    </nav>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto p-4 md:p-8">
                <div className="max-w-5xl mx-auto mb-20">
                    {children}
                </div>
            </main>
        </div>
    );
}
