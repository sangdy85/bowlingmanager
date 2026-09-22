import { TeamManagementError } from "@/lib/mobile-api/team-management";
import { internalServerErrorResponse, mobileApiError } from "@/lib/mobile-api/response";

export function teamManagementErrorResponse(error: unknown, context: string) {
    if (error instanceof TeamManagementError) {
        return mobileApiError(error.code, error.message, error.status);
    }
    console.error(context, error);
    return internalServerErrorResponse();
}
