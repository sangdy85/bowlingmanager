import { getMobileApiUserId } from "@/lib/mobile-api/auth";
import {
    getMobileTeamActivityFeed,
    parseTeamActivitiesPagination,
    parseTeamActivityFeedQuery,
    parseTargetActivityId,
} from "@/lib/mobile-api/team-records";
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
        const searchParams = new URL(request.url).searchParams;
        const query = parseTeamActivityFeedQuery(searchParams);
        const pagination = parseTeamActivitiesPagination(searchParams);
        const targetActivityId = parseTargetActivityId(searchParams);
        if (!query || !pagination || targetActivityId === undefined) {
            return mobileApiError("INVALID_QUERY", "조회 조건을 확인해주세요.", 400);
        }
        const { teamId } = await context.params;
        const feed = await getMobileTeamActivityFeed(
            userId,
            teamId,
            query,
            pagination.page,
            pagination.limit,
            undefined,
            targetActivityId,
        );
        if (!feed) return mobileApiError("TEAM_NOT_FOUND", "동호회를 찾을 수 없습니다.", 404);
        return mobileApiSuccess(feed);
    } catch (error) {
        console.error("Mobile API team activity feed failed:", error);
        return internalServerErrorResponse();
    }
}
