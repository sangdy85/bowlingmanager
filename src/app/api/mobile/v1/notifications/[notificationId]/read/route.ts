import { getMobileApiUserId } from "@/lib/mobile-api/auth";
import { markMobileNotificationRead, MobileNotificationError } from "@/lib/mobile-api/notifications";
import { internalServerErrorResponse, mobileApiError, mobileApiSuccess, unauthorizedResponse } from "@/lib/mobile-api/response";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ notificationId: string }> };

export async function POST(request: Request, context: Context) {
    try {
        const userId = await getMobileApiUserId(request); if (!userId) return unauthorizedResponse();
        const { notificationId } = await context.params;
        return mobileApiSuccess(await markMobileNotificationRead(userId, notificationId));
    } catch (error) {
        if (error instanceof MobileNotificationError) return mobileApiError(error.code, error.message, error.status);
        console.error("Mobile notification read failed:", error); return internalServerErrorResponse();
    }
}
