import { getMobileApiUserId } from "@/lib/mobile-api/auth";
import { createMobileTeamPost, listMobileTeamPosts } from "@/lib/mobile-api/club-expansion";
import { clubExpansionErrorResponse } from "@/lib/mobile-api/club-expansion-response";
import { mobileApiError, mobileApiSuccess, unauthorizedResponse } from "@/lib/mobile-api/response";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ teamId: string }> };

export async function GET(request: Request, context: RouteContext) {
    try {
        const userId = await getMobileApiUserId(request);
        if (!userId) return unauthorizedResponse();
        const params = new URL(request.url).searchParams;
        const page = Number(params.get("page") ?? "1");
        const rawLimit = Number(params.get("limit") ?? "20");
        if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(rawLimit) || rawLimit < 1) {
            return mobileApiError("INVALID_QUERY", "조회 조건을 확인해주세요.", 400);
        }
        const { teamId } = await context.params;
        return mobileApiSuccess(await listMobileTeamPosts(userId, teamId, page, Math.min(rawLimit, 100)));
    } catch (error) {
        return clubExpansionErrorResponse(error, "Mobile API team posts failed:");
    }
}

export async function POST(request: Request, context: RouteContext) {
    try {
        const userId = await getMobileApiUserId(request);
        if (!userId) return unauthorizedResponse();
        let body: unknown;
        try { body = await request.json(); } catch { return mobileApiError("INVALID_JSON", "요청 내용을 확인해주세요.", 400); }
        const { teamId } = await context.params;
        return mobileApiSuccess(await createMobileTeamPost(userId, teamId, body), 201);
    } catch (error) {
        return clubExpansionErrorResponse(error, "Mobile API team post creation failed:");
    }
}
