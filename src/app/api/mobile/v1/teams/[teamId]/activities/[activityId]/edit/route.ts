import { getMobileApiUserId } from "@/lib/mobile-api/auth";
import {
    getEditableTeamActivity,
    parseTeamActivityMutation,
    updateTeamActivity,
} from "@/lib/mobile-api/team-management";
import { teamManagementErrorResponse } from "@/lib/mobile-api/team-management-response";
import { mobileApiError, mobileApiSuccess, unauthorizedResponse } from "@/lib/mobile-api/response";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ teamId: string; activityId: string }> };

export async function GET(request: Request, context: RouteContext) {
    try {
        const userId = await getMobileApiUserId(request);
        if (!userId) return unauthorizedResponse();
        const { teamId, activityId } = await context.params;
        return mobileApiSuccess(await getEditableTeamActivity(userId, teamId, activityId));
    } catch (error) {
        return teamManagementErrorResponse(error, "Mobile API activity edit load failed:");
    }
}

export async function PUT(request: Request, context: RouteContext) {
    try {
        const userId = await getMobileApiUserId(request);
        if (!userId) return unauthorizedResponse();
        let payload: unknown;
        try {
            payload = await request.json();
        } catch {
            return mobileApiError("INVALID_JSON", "요청 내용을 확인해주세요.", 400);
        }
        const { teamId, activityId } = await context.params;
        const result = await updateTeamActivity(
            userId,
            teamId,
            activityId,
            parseTeamActivityMutation(payload),
        );
        return mobileApiSuccess(result);
    } catch (error) {
        return teamManagementErrorResponse(error, "Mobile API activity update failed:");
    }
}
