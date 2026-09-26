import { getMobileApiUserId } from "@/lib/mobile-api/auth";
import { MobileNotificationError, registerMobilePushDevice, revokeMobilePushDevice } from "@/lib/mobile-api/notifications";
import { internalServerErrorResponse, mobileApiError, mobileApiSuccess, unauthorizedResponse } from "@/lib/mobile-api/response";

export const dynamic = "force-dynamic";

export async function POST(request: Request) { return mutate(request, registerMobilePushDevice); }
export async function DELETE(request: Request) { return mutate(request, revokeMobilePushDevice); }

async function mutate(request: Request, operation: (userId: string, body: unknown) => Promise<unknown>) {
    try {
        const userId = await getMobileApiUserId(request); if (!userId) return unauthorizedResponse();
        let body: unknown; try { body = await request.json(); } catch { body = null; }
        return mobileApiSuccess(await operation(userId, body));
    } catch (error) {
        if (error instanceof MobileNotificationError) return mobileApiError(error.code, error.message, error.status);
        console.error("Mobile push device mutation failed:", error); return internalServerErrorResponse();
    }
}
