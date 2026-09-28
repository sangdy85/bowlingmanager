import { getMobileApiUserId } from "@/lib/mobile-api/auth";
import { seasonHistoryErrorResponse } from "@/lib/mobile-api/season-history-response";
import { finalizeTeamSeason, getLatestSeasonFinalRanking } from "@/lib/mobile-api/season-history";
import { mobileApiSuccess, unauthorizedResponse } from "@/lib/mobile-api/response";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ teamId: string; seasonId: string }> };

export async function GET(request: Request, context: Context) {
    try {
        const userId = await getMobileApiUserId(request); if (!userId) return unauthorizedResponse();
        const { teamId, seasonId } = await context.params;
        return mobileApiSuccess({ finalRanking: await getLatestSeasonFinalRanking(userId, teamId, seasonId) });
    } catch (error) { return seasonHistoryErrorResponse(error, "Mobile API season final ranking failed:"); }
}

export async function POST(request: Request, context: Context) {
    try {
        const userId = await getMobileApiUserId(request); if (!userId) return unauthorizedResponse();
        const { teamId, seasonId } = await context.params;
        return mobileApiSuccess(await finalizeTeamSeason(userId, teamId, seasonId, await request.json()), 201);
    } catch (error) { return seasonHistoryErrorResponse(error, "Mobile API season finalization failed:"); }
}
