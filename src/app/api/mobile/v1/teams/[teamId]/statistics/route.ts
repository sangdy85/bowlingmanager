import { getMobileApiUserId } from "@/lib/mobile-api/auth";
import { getMobileTeamStatistics, parseTeamRecordsQuery } from "@/lib/mobile-api/team-records";
import {
    internalServerErrorResponse,
    mobileApiError,
    mobileApiSuccess,
    unauthorizedResponse,
} from "@/lib/mobile-api/response";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ teamId: string }> };

export async function GET(request: Request, context: RouteContext) {
    try {
        const userId = await getMobileApiUserId(request);
        if (!userId) return unauthorizedResponse();
        const query = parseTeamRecordsQuery(new URL(request.url).searchParams);
        if (!query) return mobileApiError("INVALID_QUERY", "조회 조건을 확인해주세요.", 400);
        const { teamId } = await context.params;
        const statistics = await getMobileTeamStatistics(userId, teamId, query);
        if (!statistics) return mobileApiError("TEAM_NOT_FOUND", "동호회를 찾을 수 없습니다.", 404);
        return mobileApiSuccess(statistics);
    } catch (error) {
        console.error("Mobile API team statistics failed:", error);
        return internalServerErrorResponse();
    }
}
