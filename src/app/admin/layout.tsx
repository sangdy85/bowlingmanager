import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AdminDashboardShell from "@/components/dashboard/AdminDashboardShell";

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await auth();

    if (session?.user?.role !== "SUPER_ADMIN") {
        redirect("/");
    }

    return <AdminDashboardShell>{children}</AdminDashboardShell>;
}
