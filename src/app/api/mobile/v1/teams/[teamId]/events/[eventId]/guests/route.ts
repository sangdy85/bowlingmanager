import { getMobileApiUserId } from "@/lib/mobile-api/auth";
import { mobileApiSuccess, unauthorizedResponse } from "@/lib/mobile-api/response";
import { addEventGuest } from "@/lib/mobile-api/team-events";
import { readJson, teamEventErrorResponse } from "@/lib/mobile-api/team-events-response";
type Context = { params: Promise<{ teamId: string; eventId: string }> };
export async function POST(request: Request, context: Context) {
    try { const userId = await getMobileApiUserId(request); if (!userId) return unauthorizedResponse(); const p = await context.params; return mobileApiSuccess({ guest: await addEventGuest(userId, p.teamId, p.eventId, await readJson(request)) }, 201); }
    catch (error) { return teamEventErrorResponse(error, "Mobile team event guest create failed:"); }
}
