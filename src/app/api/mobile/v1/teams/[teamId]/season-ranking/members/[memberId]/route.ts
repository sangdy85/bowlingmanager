import { getMobileApiUserId } from "@/lib/mobile-api/auth";
import { clubExpansionErrorResponse } from "@/lib/mobile-api/club-expansion-response";
import { getUnifiedSeasonMemberDetail, SEASON_COMPETITION_TYPES } from "@/lib/mobile-api/unified-season";
import { mobileApiError, mobileApiSuccess, unauthorizedResponse } from "@/lib/mobile-api/response";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ teamId: string; memberId: string }> };

export async function GET(request: Request, context: Context) {
    try {
        const userId = await getMobileApiUserId(request); if (!userId) return unauthorizedResponse();
        const { teamId, memberId } = await context.params;
        const url = new URL(request.url); const seasonId = url.searchParams.get("seasonId");
        const rawType = url.searchParams.get("type") ?? "ALL";
        if (rawType !== "ALL" && !SEASON_COMPETITION_TYPES.includes(rawType as never)) {
            return mobileApiError("INVALID_COMPETITION_TYPE", "대회 유형을 확인해주세요.", 400);
        }
        return mobileApiSuccess(await getUnifiedSeasonMemberDetail(userId, teamId, memberId, {
            seasonId, competitionType: rawType as "ALL" | "INDIVIDUAL" | "TEAM" | "EVENT",
        }));
    } catch (error) { return clubExpansionErrorResponse(error, "Mobile API season member detail failed:"); }
}
