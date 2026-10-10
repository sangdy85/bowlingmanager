import { getMobileApiUserId } from "@/lib/mobile-api/auth";
import { mobileApiSuccess, unauthorizedResponse } from "@/lib/mobile-api/response";
import { updateGameFee } from "@/lib/mobile-api/event-game-fees";
import { readJson, teamEventErrorResponse } from "@/lib/mobile-api/team-events-response";
import { assertPaymentWriteOrigin } from "@/lib/mobile-api/payment-write-origin";
type Context = { params: Promise<{ teamId: string; eventId: string }> };
export async function POST(request: Request, context: Context) {
    try {
        const userId = await getMobileApiUserId(request);
        if (!userId) return unauthorizedResponse();
        assertPaymentWriteOrigin(request);
        const p = await context.params;
        return mobileApiSuccess(await updateGameFee(userId, p.teamId, p.eventId, await readJson(request)));
    } catch (error) { return teamEventErrorResponse(error, "Event game fee update failed:"); }
}
