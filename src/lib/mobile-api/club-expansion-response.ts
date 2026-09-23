import { ClubExpansionError } from "@/lib/mobile-api/club-expansion";
import { UnifiedSeasonError } from "@/lib/mobile-api/unified-season";
import { internalServerErrorResponse, mobileApiError } from "@/lib/mobile-api/response";

export function clubExpansionErrorResponse(error: unknown, logMessage: string) {
    if (error instanceof ClubExpansionError) return mobileApiError(error.code, error.message, error.status);
    if (error instanceof UnifiedSeasonError) return mobileApiError(error.code, error.message, error.status);
    console.error(logMessage, error);
    return internalServerErrorResponse();
}
