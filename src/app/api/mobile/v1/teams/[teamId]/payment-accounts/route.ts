import { getMobileApiUserId } from "@/lib/mobile-api/auth";
import { mobileApiSuccess, unauthorizedResponse } from "@/lib/mobile-api/response";
import { getPaymentAccounts, savePaymentAccount } from "@/lib/mobile-api/event-game-fees";
import { readJson, teamEventErrorResponse } from "@/lib/mobile-api/team-events-response";
import { assertPaymentWriteOrigin } from "@/lib/mobile-api/payment-write-origin";
type Context = { params: Promise<{ teamId: string }> };
export async function GET(request: Request, context: Context) {
    try {
        const userId = await getMobileApiUserId(request);
        if (!userId) return unauthorizedResponse();
        return mobileApiSuccess(await getPaymentAccounts(userId, (await context.params).teamId));
    } catch (error) { return teamEventErrorResponse(error, "Payment account read failed:"); }
}
export async function PUT(request: Request, context: Context) {
    try {
        const userId = await getMobileApiUserId(request);
        if (!userId) return unauthorizedResponse();
        assertPaymentWriteOrigin(request);
        return mobileApiSuccess(await savePaymentAccount(userId, (await context.params).teamId, await readJson(request)));
    } catch (error) { return teamEventErrorResponse(error, "Payment account save failed:"); }
}
