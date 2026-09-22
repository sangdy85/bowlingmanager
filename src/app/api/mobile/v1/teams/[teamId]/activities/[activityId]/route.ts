import { getMobileApiUserId } from "@/lib/mobile-api/auth";
import { getMobileTeamActivityDetail } from "@/lib/mobile-api/team-records";
import { deleteTeamActivity, TeamManagementError } from "@/lib/mobile-api/team-management";
import { teamManagementErrorResponse } from "@/lib/mobile-api/team-management-response";
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

export async function DELETE(request: Request, context: RouteContext) {
    try {
        const userId = await getMobileApiUserId(request);
        if (!userId) return unauthorizedResponse();
        let payload: unknown;
        try {
            payload = await request.json();
        } catch {
            return mobileApiError("INVALID_JSON", "요청 내용을 확인해주세요.", 400);
        }
        const revision = payload && typeof payload === "object" && !Array.isArray(payload)
            ? (payload as Record<string, unknown>).revision
            : null;
        if (typeof revision !== "string" || !revision.trim()) {
            throw new TeamManagementError("INVALID_REQUEST", "삭제할 기록 정보를 확인해주세요.", 400);
        }
        const { teamId, activityId } = await context.params;
        return mobileApiSuccess(await deleteTeamActivity(userId, teamId, activityId, revision.trim()));
    } catch (error) {
        return teamManagementErrorResponse(error, "Mobile API activity delete failed:");
    }
}
