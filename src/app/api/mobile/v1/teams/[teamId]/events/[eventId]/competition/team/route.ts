import { getMobileApiUserId } from "@/lib/mobile-api/auth";
import { internalServerErrorResponse, mobileApiError, mobileApiSuccess, unauthorizedResponse } from "@/lib/mobile-api/response";
import { getTeamCompetitionState, TeamCompetitionError, updateTeamCompetition } from "@/lib/mobile-api/team-competition";
import { UnifiedSeasonError } from "@/lib/mobile-api/unified-season";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ teamId: string; eventId: string }> };

export async function GET(request: Request, context: Context) {
    try {
        const userId = await getMobileApiUserId(request); if (!userId) return unauthorizedResponse();
        const { teamId, eventId } = await context.params;
        return mobileApiSuccess(await getTeamCompetitionState(userId, teamId, eventId));
    } catch (error) { return errorResponse(error, "Mobile TEAM competition state failed:"); }
}

export async function POST(request: Request, context: Context) {
    try {
        const userId = await getMobileApiUserId(request); if (!userId) return unauthorizedResponse();
        const { teamId, eventId } = await context.params;
        let body: unknown; try { body = await request.json(); }
        catch { throw new TeamCompetitionError("INVALID_JSON", "요청 내용을 확인해주세요.", 400); }
        return mobileApiSuccess(await updateTeamCompetition(userId, teamId, eventId, body));
    } catch (error) { return errorResponse(error, "Mobile TEAM competition mutation failed:"); }
}

function errorResponse(error: unknown, context: string) {
    if (error instanceof TeamCompetitionError) return mobileApiError(error.code, error.message, error.status);
    if (error instanceof UnifiedSeasonError) return mobileApiError(error.code, error.message, error.status);
    console.error(context, error); return internalServerErrorResponse();
}
