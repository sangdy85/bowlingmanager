import { getMobileApiUserId } from "@/lib/mobile-api/auth";
import { getMobileTeamActivityDetail } from "@/lib/mobile-api/team-records";
import {
    internalServerErrorResponse,
    mobileApiError,
    mobileApiSuccess,
    unauthorizedResponse,
} from "@/lib/mobile-api/response";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ teamId: string; activityId: string }> };

export async function GET(request: Request, context: RouteContext) {
    try {
        const userId = await getMobileApiUserId(request);
        if (!userId) return unauthorizedResponse();
        const { teamId, activityId } = await context.params;
        const result = await getMobileTeamActivityDetail(userId, teamId, activityId);
        if (result.kind === "TEAM_NOT_FOUND") {
            return mobileApiError("TEAM_NOT_FOUND", "동호회를 찾을 수 없습니다.", 404);
        }
        if (result.kind === "INVALID_ACTIVITY" || result.kind === "ACTIVITY_NOT_FOUND") {
            return mobileApiError("ACTIVITY_NOT_FOUND", "활동 기록을 찾을 수 없습니다.", 404);
        }
        return mobileApiSuccess({ activity: result.activity });
    } catch (error) {
        console.error("Mobile API team activity detail failed:", error);
        return internalServerErrorResponse();
    }
}
