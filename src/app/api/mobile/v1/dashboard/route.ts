import { getMobileApiUserId } from "@/lib/mobile-api/auth";
import { getMobileDashboard, parseDashboardYear } from "@/lib/mobile-api/dashboard";
import {
    internalServerErrorResponse,
    mobileApiSuccess,
    mobileApiError,
    unauthorizedResponse,
} from "@/lib/mobile-api/response";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    try {
        const userId = await getMobileApiUserId(request);
        if (!userId) return unauthorizedResponse();

        const year = parseDashboardYear(new URL(request.url).searchParams);
        if (year === null) {
            return mobileApiError("INVALID_YEAR", "연도는 1900~2100 사이의 네 자리 숫자로 입력해주세요.", 400);
        }
        const dashboard = await getMobileDashboard(userId, year);
        return mobileApiSuccess(dashboard);
    } catch (error) {
        console.error("Mobile API /dashboard failed:", error);
        return internalServerErrorResponse();
    }
}
