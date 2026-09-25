import { getMobileApiUserId } from "@/lib/mobile-api/auth";
import { getMobileSeasonRanking } from "@/lib/mobile-api/club-expansion";
import { SEASON_COMPETITION_TYPES } from "@/lib/mobile-api/unified-season";
import { clubExpansionErrorResponse } from "@/lib/mobile-api/club-expansion-response";
import { mobileApiError, mobileApiSuccess, unauthorizedResponse } from "@/lib/mobile-api/response";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ teamId: string }> };

export async function GET(request: Request, context: RouteContext) {
    try {
        const userId = await getMobileApiUserId(request);
        if (!userId) return unauthorizedResponse();
        const { teamId } = await context.params;
        const url = new URL(request.url);
        const seasonId = url.searchParams.get("seasonId");
        const rawYears = url.searchParams.getAll("year");
        const rawYear = rawYears[0] ?? null;
        const year = rawYear === null ? undefined : Number(rawYear);
        if (rawYears.length > 1 ||
            (rawYear !== null && (!/^\d{4}$/.test(rawYear) || year! < 1900 || year! > 2100))) {
            return mobileApiError("INVALID_QUERY", "조회 연도를 확인해주세요.", 400);
        }
        const rawType = url.searchParams.get("type") ?? "ALL";
        if (rawType !== "ALL" && !SEASON_COMPETITION_TYPES.includes(rawType as never)) {
            return mobileApiError("INVALID_COMPETITION_TYPE", "대회 유형을 확인해주세요.", 400);
        }
        return mobileApiSuccess(await getMobileSeasonRanking(userId, teamId, {
            seasonId, year, competitionType: rawType as "ALL" | "INDIVIDUAL" | "TEAM" | "EVENT",
        }));
    } catch (error) { return clubExpansionErrorResponse(error, "Mobile API season ranking failed:"); }
}
