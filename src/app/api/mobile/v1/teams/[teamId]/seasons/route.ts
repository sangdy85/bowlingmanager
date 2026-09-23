import { getMobileApiUserId } from "@/lib/mobile-api/auth";
import { clubExpansionErrorResponse } from "@/lib/mobile-api/club-expansion-response";
import { getUnifiedSeasonRanking } from "@/lib/mobile-api/unified-season";
import { mobileApiSuccess, unauthorizedResponse } from "@/lib/mobile-api/response";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ teamId: string }> };

export async function GET(request: Request, context: Context) {
    try {
        const userId = await getMobileApiUserId(request); if (!userId) return unauthorizedResponse();
        const { teamId } = await context.params;
        const result = await getUnifiedSeasonRanking(userId, teamId);
        return mobileApiSuccess({ enabled: result.enabled, currentSeason: result.season, seasons: result.seasons });
    } catch (error) { return clubExpansionErrorResponse(error, "Mobile API seasons failed:"); }
}
