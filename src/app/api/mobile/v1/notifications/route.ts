import { getMobileApiUserId } from "@/lib/mobile-api/auth";
import { listMobileNotifications } from "@/lib/mobile-api/notifications";
import { internalServerErrorResponse, mobileApiSuccess, unauthorizedResponse } from "@/lib/mobile-api/response";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    try {
        const userId = await getMobileApiUserId(request); if (!userId) return unauthorizedResponse();
        const url = new URL(request.url);
        return mobileApiSuccess(await listMobileNotifications(userId, url.searchParams.get("page"), url.searchParams.get("limit")));
    } catch (error) {
        console.error("Mobile notification list failed:", error); return internalServerErrorResponse();
    }
}
