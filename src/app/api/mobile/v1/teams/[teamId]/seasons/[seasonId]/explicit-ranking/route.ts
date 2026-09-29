import { getMobileApiUserId } from "@/lib/mobile-api/auth";
import { explicitSeasonRankingErrorResponse } from "@/lib/mobile-api/explicit-season-ranking-response";
import { getExplicitSeasonRanking, saveExplicitSeasonRanking } from "@/lib/mobile-api/explicit-season-rankings";
import { mobileApiError, mobileApiSuccess, unauthorizedResponse } from "@/lib/mobile-api/response";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ teamId: string; seasonId: string }> };

export async function GET(request: Request, context: RouteContext) {
    try {
        const userId = await getMobileApiUserId(request);
        if (!userId) return unauthorizedResponse();
        const { teamId, seasonId } = await context.params;
        return mobileApiSuccess({ ranking: await getExplicitSeasonRanking(userId, teamId, seasonId) });
    } catch (error) {
        return explicitSeasonRankingErrorResponse(error, "Mobile API explicit season ranking read failed:");
    }
}

export async function PUT(request: Request, context: RouteContext) {
    try {
        const userId = await getMobileApiUserId(request);
        if (!userId) return unauthorizedResponse();
        let body: unknown;
        try { body = await request.json(); } catch {
            return mobileApiError("INVALID_JSON", "요청 내용을 확인해주세요.", 400);
        }
        const { teamId, seasonId } = await context.params;
        return mobileApiSuccess(await saveExplicitSeasonRanking(userId, teamId, seasonId, body));
    } catch (error) {
        return explicitSeasonRankingErrorResponse(error, "Mobile API explicit season ranking save failed:");
    }
}
