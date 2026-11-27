import { ExplicitSeasonRankingError } from "@/lib/mobile-api/explicit-season-rankings";
import { mobileApiError } from "@/lib/mobile-api/response";

export function explicitSeasonRankingErrorResponse(error: unknown, context: string) {
    if (error instanceof ExplicitSeasonRankingError) {
        return mobileApiError(error.code, error.message, error.status);
    }
    console.error(context, error instanceof Error ? error.message : "Unknown error");
    return mobileApiError("INTERNAL_ERROR", "요청을 처리하지 못했습니다.", 500);
}
