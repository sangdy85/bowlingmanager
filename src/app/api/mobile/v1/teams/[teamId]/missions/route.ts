import { getMobileApiUserId } from "@/lib/mobile-api/auth";
import { getMemberMissions, getMissionConfig, updateMissions } from "@/lib/mobile-api/missions";
import { missionErrorResponse } from "@/lib/mobile-api/mission-response";
import { mobileApiSuccess, mobileApiError, unauthorizedResponse } from "@/lib/mobile-api/response";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ teamId: string }> };
export async function GET(request: Request, context: Context) {
    try {
        const userId = await getMobileApiUserId(request); if (!userId) return unauthorizedResponse();
        const { teamId } = await context.params;
        const query = new URL(request.url).searchParams;
        const seasonId = query.get("seasonId"), memberId = query.get("memberId");
        if (query.getAll("seasonId").length > 1 || query.getAll("memberId").length > 1 || (!!seasonId !== !!memberId) || (query.has("seasonId") && !seasonId) || (query.has("memberId") && !memberId)) return mobileApiError("INVALID_QUERY", "시즌과 회원을 함께 선택해주세요.", 400);
        return mobileApiSuccess(seasonId && memberId ? await getMemberMissions(userId, teamId, seasonId, memberId) : await getMissionConfig(userId, teamId));
    } catch (error) { return missionErrorResponse(error); }
}
export async function POST(request: Request, context: Context) {
    try {
        const userId = await getMobileApiUserId(request); if (!userId) return unauthorizedResponse();
        const { teamId } = await context.params;
        return mobileApiSuccess(await updateMissions(userId, teamId, await request.json()));
    } catch (error) { return missionErrorResponse(error); }
}
