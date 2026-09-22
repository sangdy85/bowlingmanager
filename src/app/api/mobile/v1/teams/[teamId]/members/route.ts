import { getMobileApiUserId } from "@/lib/mobile-api/auth";
import {
    internalServerErrorResponse,
    mobileApiError,
    mobileApiSuccess,
    unauthorizedResponse,
} from "@/lib/mobile-api/response";
import { listMobileTeamMembers } from "@/lib/mobile-api/teams";

export const dynamic = "force-dynamic";

type RouteContext = {
    params: Promise<{ teamId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
    try {
        const userId = await getMobileApiUserId(request);
        if (!userId) return unauthorizedResponse();

        const { teamId } = await context.params;
        const members = await listMobileTeamMembers(userId, teamId);
        if (!members) {
            return mobileApiError("TEAM_NOT_FOUND", "동호회를 찾을 수 없습니다.", 404);
        }
        return mobileApiSuccess({ members });
    } catch (error) {
        console.error("Mobile API team members failed:", error);
        return internalServerErrorResponse();
    }
}
