import { getMobileApiUserId } from "@/lib/mobile-api/auth";
import { mobileApiSuccess, unauthorizedResponse } from "@/lib/mobile-api/response";
import { updateMyAttendance } from "@/lib/mobile-api/team-events";
import { readJson, teamEventErrorResponse } from "@/lib/mobile-api/team-events-response";
type Context = { params: Promise<{ teamId: string; eventId: string }> };
export async function PUT(request: Request, context: Context) {
    try { const userId = await getMobileApiUserId(request); if (!userId) return unauthorizedResponse(); const p = await context.params; return mobileApiSuccess(await updateMyAttendance(userId, p.teamId, p.eventId, await readJson(request))); }
    catch (error) { return teamEventErrorResponse(error, "Mobile team event attendance failed:"); }
}
