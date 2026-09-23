import { getMobileApiUserId } from "@/lib/mobile-api/auth";
import { mobileApiSuccess, unauthorizedResponse } from "@/lib/mobile-api/response";
import { drawGuestEventLane } from "@/lib/mobile-api/team-events";
import { teamEventErrorResponse } from "@/lib/mobile-api/team-events-response";
type Context = { params: Promise<{ teamId: string; eventId: string; guestId: string }> };
export async function POST(request: Request, context: Context) {
    try { const userId = await getMobileApiUserId(request); if (!userId) return unauthorizedResponse(); const p = await context.params; return mobileApiSuccess({ assignment: await drawGuestEventLane(userId, p.teamId, p.eventId, p.guestId) }); }
    catch (error) { return teamEventErrorResponse(error, "Mobile team event guest draw failed:"); }
}
