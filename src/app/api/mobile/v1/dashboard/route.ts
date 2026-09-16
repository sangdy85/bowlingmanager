import { getMobileApiUserId } from "@/lib/mobile-api/auth";
import { getMobileDashboard } from "@/lib/mobile-api/dashboard";
import {
    internalServerErrorResponse,
    mobileApiSuccess,
    unauthorizedResponse,
} from "@/lib/mobile-api/response";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    try {
        const userId = await getMobileApiUserId(request);
        if (!userId) return unauthorizedResponse();

        const dashboard = await getMobileDashboard(userId);
        return mobileApiSuccess(dashboard);
    } catch (error) {
        console.error("Mobile API /dashboard failed:", error);
        return internalServerErrorResponse();
    }
}
