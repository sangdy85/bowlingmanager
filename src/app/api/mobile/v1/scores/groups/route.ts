import { NextRequest } from "next/server";
import { getMobileApiUserId } from "@/lib/mobile-api/auth";
import {
    internalServerErrorResponse,
    mobileApiSuccess,
    mobileApiError,
    unauthorizedResponse,
} from "@/lib/mobile-api/response";
import {
    getMobileScoreGroups,
    MobileScoreFilterError,
    parseMobileScoreFilters,
    parseMobileScorePagination,
} from "@/lib/mobile-api/scores";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    try {
        const userId = await getMobileApiUserId(request);
        if (!userId) return unauthorizedResponse();

        const { page, limit } = parseMobileScorePagination(request.nextUrl.searchParams);
        const filters = parseMobileScoreFilters(request.nextUrl.searchParams);
        return mobileApiSuccess(await getMobileScoreGroups(userId, page, limit, undefined, filters));
    } catch (error) {
        if (error instanceof MobileScoreFilterError) {
            return mobileApiError(error.code, error.message, 400);
        }
        console.error("Mobile API /scores/groups failed:", error);
        return internalServerErrorResponse();
    }
}
