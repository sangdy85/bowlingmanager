import { getMobileApiUserId } from "@/lib/mobile-api/auth";
import { seasonHistoryErrorResponse } from "@/lib/mobile-api/season-history-response";
import { createTeamSeason, listTeamSeasons } from "@/lib/mobile-api/season-history";
import { mobileApiError, mobileApiSuccess, unauthorizedResponse } from "@/lib/mobile-api/response";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ teamId: string }> };

export async function GET(request: Request, context: Context) {
    try {
        const userId = await getMobileApiUserId(request); if (!userId) return unauthorizedResponse();
        const { teamId } = await context.params;
        const rawYears = new URL(request.url).searchParams.getAll("year");
        const rawYear = rawYears[0] ?? null;
        const year = rawYear === null ? undefined : Number(rawYear);
        if (rawYears.length > 1 ||
            (rawYear !== null && (!/^\d{4}$/.test(rawYear) || year! < 1900 || year! > 2100))) {
            return mobileApiError("INVALID_QUERY", "조회 연도를 확인해주세요.", 400);
        }
        return mobileApiSuccess(await listTeamSeasons(userId, teamId, new Date(), year));
    } catch (error) { return seasonHistoryErrorResponse(error, "Mobile API seasons failed:"); }
}

export async function POST(request: Request, context: Context) {
    try {
        const userId = await getMobileApiUserId(request); if (!userId) return unauthorizedResponse();
        const { teamId } = await context.params;
        return mobileApiSuccess(await createTeamSeason(userId, teamId, await request.json()), 201);
    } catch (error) { return seasonHistoryErrorResponse(error, "Mobile API season creation failed:"); }
}
