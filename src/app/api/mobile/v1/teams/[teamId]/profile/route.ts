import { getMobileApiUserId } from "@/lib/mobile-api/auth";
import { getMobileTeamProfile, updateMobileTeamProfile } from "@/lib/mobile-api/club-expansion";
import { clubExpansionErrorResponse } from "@/lib/mobile-api/club-expansion-response";
import { mobileApiError, mobileApiSuccess, unauthorizedResponse } from "@/lib/mobile-api/response";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ teamId: string }> };

export async function GET(request: Request, context: RouteContext) {
    try {
        const userId = await getMobileApiUserId(request);
        if (!userId) return unauthorizedResponse();
        const { teamId } = await context.params;
        return mobileApiSuccess({ profile: await getMobileTeamProfile(userId, teamId) });
    } catch (error) { return clubExpansionErrorResponse(error, "Mobile API team profile failed:"); }
}

export async function PATCH(request: Request, context: RouteContext) {
    try {
        const userId = await getMobileApiUserId(request);
        if (!userId) return unauthorizedResponse();
        let body: unknown;
        try { body = await request.json(); } catch { return mobileApiError("INVALID_JSON", "요청 내용을 확인해주세요.", 400); }
        const { teamId } = await context.params;
        return mobileApiSuccess({ profile: await updateMobileTeamProfile(userId, teamId, body) });
    } catch (error) { return clubExpansionErrorResponse(error, "Mobile API team profile update failed:"); }
}
