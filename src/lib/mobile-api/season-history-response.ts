import { SeasonHistoryError } from "@/lib/mobile-api/season-history";
import { clubExpansionErrorResponse } from "@/lib/mobile-api/club-expansion-response";
import { mobileApiError } from "@/lib/mobile-api/response";

export function seasonHistoryErrorResponse(error: unknown, logMessage: string) {
    if (error instanceof SeasonHistoryError) return mobileApiError(error.code, error.message, error.status);
    return clubExpansionErrorResponse(error, logMessage);
}
