import { getMobileApiUserId } from "@/lib/mobile-api/auth";
import { mobileApiSuccess, unauthorizedResponse } from "@/lib/mobile-api/response";
import { createTeamEvent, listTeamEvents, parseTeamEventListScope } from "@/lib/mobile-api/team-events";
import { readJson, teamEventErrorResponse } from "@/lib/mobile-api/team-events-response";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ teamId: string }> };

export async function GET(request: Request, context: Context) {
    try {
        const userId = await getMobileApiUserId(request); if (!userId) return unauthorizedResponse();
        const { teamId } = await context.params;
        const scope = parseTeamEventListScope(new URL(request.url).searchParams.get("scope"));
        return mobileApiSuccess(await listTeamEvents(userId, teamId, scope));
    } catch (error) { return teamEventErrorResponse(error, "Mobile team event list failed:"); }
}

export async function POST(request: Request, context: Context) {
    try {
        const userId = await getMobileApiUserId(request); if (!userId) return unauthorizedResponse();
        const { teamId } = await context.params;
        return mobileApiSuccess({ event: await createTeamEvent(userId, teamId, await readJson(request)) }, 201);
    } catch (error) { return teamEventErrorResponse(error, "Mobile team event create failed:"); }
}
