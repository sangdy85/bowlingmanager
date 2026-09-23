import { getMobileApiUserId } from "@/lib/mobile-api/auth";
import { mobileApiSuccess, unauthorizedResponse } from "@/lib/mobile-api/response";
import { deleteTeamEvent, getTeamEvent, updateTeamEvent } from "@/lib/mobile-api/team-events";
import { readJson, teamEventErrorResponse } from "@/lib/mobile-api/team-events-response";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ teamId: string; eventId: string }> };

export async function GET(request: Request, context: Context) {
    try { const userId = await getMobileApiUserId(request); if (!userId) return unauthorizedResponse(); const p = await context.params; return mobileApiSuccess({ event: await getTeamEvent(userId, p.teamId, p.eventId) }); }
    catch (error) { return teamEventErrorResponse(error, "Mobile team event detail failed:"); }
}
export async function PATCH(request: Request, context: Context) {
    try { const userId = await getMobileApiUserId(request); if (!userId) return unauthorizedResponse(); const p = await context.params; return mobileApiSuccess({ event: await updateTeamEvent(userId, p.teamId, p.eventId, await readJson(request)) }); }
    catch (error) { return teamEventErrorResponse(error, "Mobile team event update failed:"); }
}
export async function DELETE(request: Request, context: Context) {
    try { const userId = await getMobileApiUserId(request); if (!userId) return unauthorizedResponse(); const p = await context.params; return mobileApiSuccess(await deleteTeamEvent(userId, p.teamId, p.eventId)); }
    catch (error) { return teamEventErrorResponse(error, "Mobile team event delete failed:"); }
}
