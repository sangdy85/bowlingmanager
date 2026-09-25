import { getMobileApiUserId } from "@/lib/mobile-api/auth";
import {
    internalServerErrorResponse,
    mobileApiError,
    mobileApiSuccess,
    unauthorizedResponse,
} from "@/lib/mobile-api/response";
import {
    listMobileSuperAdminTeams,
    MobileSuperAdminError,
} from "@/lib/mobile-api/super-admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    try {
        const userId = await getMobileApiUserId(request);
        if (!userId) return unauthorizedResponse();
        return mobileApiSuccess({ teams: await listMobileSuperAdminTeams(userId) });
    } catch (error) {
        if (error instanceof MobileSuperAdminError) {
            return mobileApiError(error.code, error.message, error.status);
        }
        console.error("Mobile API super-admin team list failed:", error);
        return internalServerErrorResponse();
    }
}
