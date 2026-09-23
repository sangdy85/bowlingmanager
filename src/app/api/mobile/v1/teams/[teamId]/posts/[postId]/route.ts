import { getMobileApiUserId } from "@/lib/mobile-api/auth";
import { deleteMobileTeamPost, getMobileTeamPost, updateMobileTeamPost } from "@/lib/mobile-api/club-expansion";
import { clubExpansionErrorResponse } from "@/lib/mobile-api/club-expansion-response";
import { mobileApiError, mobileApiSuccess, unauthorizedResponse } from "@/lib/mobile-api/response";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ teamId: string; postId: string }> };

export async function GET(request: Request, context: RouteContext) {
    try {
        const userId = await getMobileApiUserId(request);
        if (!userId) return unauthorizedResponse();
        const { teamId, postId } = await context.params;
        return mobileApiSuccess({ post: await getMobileTeamPost(userId, teamId, postId) });
    } catch (error) { return clubExpansionErrorResponse(error, "Mobile API team post detail failed:"); }
}

export async function PATCH(request: Request, context: RouteContext) {
    try {
        const userId = await getMobileApiUserId(request);
        if (!userId) return unauthorizedResponse();
        let body: unknown;
        try { body = await request.json(); } catch { return mobileApiError("INVALID_JSON", "요청 내용을 확인해주세요.", 400); }
        const { teamId, postId } = await context.params;
        return mobileApiSuccess(await updateMobileTeamPost(userId, teamId, postId, body));
    } catch (error) { return clubExpansionErrorResponse(error, "Mobile API team post update failed:"); }
}

export async function DELETE(request: Request, context: RouteContext) {
    try {
        const userId = await getMobileApiUserId(request);
        if (!userId) return unauthorizedResponse();
        const { teamId, postId } = await context.params;
        return mobileApiSuccess(await deleteMobileTeamPost(userId, teamId, postId));
    } catch (error) { return clubExpansionErrorResponse(error, "Mobile API team post deletion failed:"); }
}
