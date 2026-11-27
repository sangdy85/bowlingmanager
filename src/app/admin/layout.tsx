import { requireAdminPage } from "@/components/dashboard/requireAdminPage";
import AdminDashboardShell from "@/components/dashboard/AdminDashboardShell";

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    await requireAdminPage();

    return <AdminDashboardShell>{children}</AdminDashboardShell>;
}
