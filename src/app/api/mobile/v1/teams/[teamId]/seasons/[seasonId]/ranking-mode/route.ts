import { getMobileApiUserId } from "@/lib/mobile-api/auth";
import { clubExpansionErrorResponse } from "@/lib/mobile-api/club-expansion-response";
import { updateSeasonRankingMode } from "@/lib/mobile-api/season-ranking-management";
import { mobileApiError, mobileApiSuccess, unauthorizedResponse } from "@/lib/mobile-api/response";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ teamId: string; seasonId: string }> };

export async function PATCH(request: Request, context: Context) {
    try {
        const userId = await getMobileApiUserId(request); if (!userId) return unauthorizedResponse();
        let body: unknown; try { body = await request.json(); } catch { return mobileApiError("INVALID_REQUEST", "요청 내용을 확인해주세요.", 400); }
        const { teamId, seasonId } = await context.params;
        return mobileApiSuccess(await updateSeasonRankingMode(userId, teamId, seasonId, body));
    } catch (error) { return clubExpansionErrorResponse(error, "Mobile API ranking mode update failed:"); }
}
