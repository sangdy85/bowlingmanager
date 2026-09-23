import { getMobileApiUserId } from "@/lib/mobile-api/auth";
import { changeTeamMemberRole, removeTeamMember } from "@/lib/mobile-api/team-management";
import { teamManagementErrorResponse } from "@/lib/mobile-api/team-management-response";
import { mobileApiError, mobileApiSuccess, unauthorizedResponse } from "@/lib/mobile-api/response";
import { getMobileMemberProfile, parseExpansionYear } from "@/lib/mobile-api/club-expansion";
import { clubExpansionErrorResponse } from "@/lib/mobile-api/club-expansion-response";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ teamId: string; memberId: string }> };

export async function GET(request: Request, context: RouteContext) {
    try {
        const userId = await getMobileApiUserId(request);
        if (!userId) return unauthorizedResponse();
        const year = parseExpansionYear(new URL(request.url).searchParams);
        if (!year) return mobileApiError("INVALID_QUERY", "조회 연도를 확인해주세요.", 400);
        const { teamId, memberId } = await context.params;
        return mobileApiSuccess({ member: await getMobileMemberProfile(userId, teamId, memberId, year) });
    } catch (error) {
        return clubExpansionErrorResponse(error, "Mobile API member profile failed:");
    }
}

export async function DELETE(request: Request, context: RouteContext) {
    try {
        const userId = await getMobileApiUserId(request);
        if (!userId) return unauthorizedResponse();
        const { teamId, memberId } = await context.params;
        return mobileApiSuccess(await removeTeamMember(userId, teamId, memberId));
    } catch (error) {
        return teamManagementErrorResponse(error, "Mobile API member removal failed:");
    }
}

export async function PATCH(request: Request, context: RouteContext) {
    try {
        const userId = await getMobileApiUserId(request);
        if (!userId) return unauthorizedResponse();
        let payload: unknown;
        try {
            payload = await request.json();
        } catch {
            return mobileApiError("INVALID_JSON", "요청 내용을 확인해주세요.", 400);
        }
        const role = payload && typeof payload === "object" && !Array.isArray(payload)
            ? (payload as Record<string, unknown>).role
            : null;
        const { teamId, memberId } = await context.params;
        return mobileApiSuccess(await changeTeamMemberRole(userId, teamId, memberId, role));
    } catch (error) {
        return teamManagementErrorResponse(error, "Mobile API member role update failed:");
    }
}
