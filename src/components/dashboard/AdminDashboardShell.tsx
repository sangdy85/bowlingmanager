"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { DashboardShell } from "./DashboardUI";

const navigation = [
    { href: "/admin", label: "운영 대시보드", key: "overview", icon: "⌂" },
    { href: "/admin/centers", label: "볼링장 관리", key: "centers", icon: "⚑" },
    { href: "/admin/teams", label: "팀 관리", key: "teams", icon: "♧" },
    { href: "/admin/users", label: "계정 관리", key: "users", icon: "◎" },
    { href: "/inquiry", label: "문의 관리", key: "inquiry", icon: "✉" },
    { href: "/personal", label: "나의 기록실", key: "personal", icon: "◷" },
];

export default function AdminDashboardShell({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const current = navigation.find(item => item.href !== "/admin" && (pathname === item.href || pathname.startsWith(item.href + "/")))?.key ?? "overview";
    return <DashboardShell title="BOWLING ADMIN" caption="시스템 관리" current={current} navigation={navigation}>{children}</DashboardShell>;
}
