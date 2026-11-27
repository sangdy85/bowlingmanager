import { TeamManagementError } from "@/lib/mobile-api/team-management";
import { EventCompetitionError } from "@/lib/mobile-api/event-competition";
import { internalServerErrorResponse, mobileApiError } from "@/lib/mobile-api/response";

export function teamManagementErrorResponse(error: unknown, context: string) {
    if (error instanceof TeamManagementError) {
        return mobileApiError(error.code, error.message, error.status);
    }
    if (error instanceof EventCompetitionError) {
        return mobileApiError(error.code, error.message, error.status);
    }
    console.error(context, error);
    return internalServerErrorResponse();
}
