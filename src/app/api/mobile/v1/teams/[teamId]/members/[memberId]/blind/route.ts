import { getMobileApiUserId } from "@/lib/mobile-api/auth";
import { setTeamMemberBlind } from "@/lib/mobile-api/team-management";
import { teamManagementErrorResponse } from "@/lib/mobile-api/team-management-response";
import { mobileApiError, mobileApiSuccess, unauthorizedResponse } from "@/lib/mobile-api/response";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ teamId: string; memberId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
    try {
        const userId = await getMobileApiUserId(request);
        if (!userId) return unauthorizedResponse();
        let body: unknown;
        try { body = await request.json(); } catch {
            return mobileApiError("INVALID_JSON", "요청 내용을 확인해주세요.", 400);
        }
        const blind = body && typeof body === "object" && !Array.isArray(body)
            ? (body as Record<string, unknown>).blind
            : undefined;
        const { teamId, memberId } = await context.params;
        return mobileApiSuccess(await setTeamMemberBlind(userId, teamId, memberId, blind));
    } catch (error) {
        return teamManagementErrorResponse(error, "Mobile API member blind update failed:");
    }
}
