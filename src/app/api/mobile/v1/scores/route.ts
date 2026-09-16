import { NextRequest } from "next/server";
import { getMobileApiUserId } from "@/lib/mobile-api/auth";
import {
    internalServerErrorResponse,
    mobileApiSuccess,
    unauthorizedResponse,
} from "@/lib/mobile-api/response";
import {
    getMobileScores,
    parseMobileScorePagination,
} from "@/lib/mobile-api/scores";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    try {
        const userId = await getMobileApiUserId(request);
        if (!userId) return unauthorizedResponse();

        const { page, limit } = parseMobileScorePagination(request.nextUrl.searchParams);
        const scores = await getMobileScores(userId, page, limit);

        return mobileApiSuccess(scores);
    } catch (error) {
        console.error("Mobile API /scores failed:", error);
        return internalServerErrorResponse();
    }
}
