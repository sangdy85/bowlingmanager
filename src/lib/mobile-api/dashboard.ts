import prisma from "@/lib/prisma";
import { getPersonalStatisticsData, summarizeIntegratedRecords } from "@/lib/personal-statistics";

// Fixed range accepts historic records and planned future years.
export function parseDashboardYear(params: URLSearchParams, now = new Date()): number | null {
    if (!params.has("year")) return now.getFullYear();
    const values = params.getAll("year");
    if (values.length !== 1 || !/^\d{4}$/.test(values[0])) return null;
    const year = Number(values[0]);
    return year >= 1900 && year <= 2100 ? year : null;
}

export async function getMobileDashboard(userId: string, year: number) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            name: true,
            teamMemberships: {
                where: { team: { isActive: true } },
                select: { teamId: true, team: { select: { name: true } } },
            },
        },
    });
    if (!user) return summarizeIntegratedRecords([], year);
    const { integratedRecords } = await getPersonalStatisticsData(user, year);
    return summarizeIntegratedRecords(integratedRecords, year);
}
