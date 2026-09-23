import { getMobileApiUserId } from "@/lib/mobile-api/auth";
import { EventCompetitionError, getEventCompetitionState, updateEventCompetition } from "@/lib/mobile-api/event-competition";
import { UnifiedSeasonError } from "@/lib/mobile-api/unified-season";
import { internalServerErrorResponse, mobileApiError, mobileApiSuccess, unauthorizedResponse } from "@/lib/mobile-api/response";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ teamId: string; eventId: string }> };

export async function GET(request: Request, context: Context) {
    try {
        const userId = await getMobileApiUserId(request); if (!userId) return unauthorizedResponse();
        const { teamId, eventId } = await context.params;
        return mobileApiSuccess(await getEventCompetitionState(userId, teamId, eventId));
    } catch (error) { return errorResponse(error, "Mobile EVENT competition state failed:"); }
}

export async function POST(request: Request, context: Context) {
    try {
        const userId = await getMobileApiUserId(request); if (!userId) return unauthorizedResponse();
        const { teamId, eventId } = await context.params;
        let body: unknown; try { body = await request.json(); }
        catch { throw new EventCompetitionError("INVALID_JSON", "요청 내용을 확인해주세요.", 400); }
        return mobileApiSuccess(await updateEventCompetition(userId, teamId, eventId, body));
    } catch (error) { return errorResponse(error, "Mobile EVENT competition mutation failed:"); }
}

function errorResponse(error: unknown, context: string) {
    if (error instanceof EventCompetitionError) return mobileApiError(error.code, error.message, error.status);
    if (error instanceof UnifiedSeasonError) return mobileApiError(error.code, error.message, error.status);
    console.error(context, error); return internalServerErrorResponse();
}
