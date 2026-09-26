import { getMobileApiUserId } from "@/lib/mobile-api/auth";
import { CompetitionScoreError, getCompetitionScoreEntry, saveCompetitionScores } from "@/lib/mobile-api/competition-scores";
import { internalServerErrorResponse, mobileApiError, mobileApiSuccess, unauthorizedResponse } from "@/lib/mobile-api/response";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ teamId: string; eventId: string }> };

export async function GET(request: Request, context: Context) {
    try {
        const userId = await getMobileApiUserId(request); if (!userId) return unauthorizedResponse();
        const { teamId, eventId } = await context.params;
        return mobileApiSuccess(await getCompetitionScoreEntry(userId, teamId, eventId));
    } catch (error) { return errorResponse(error, "Mobile competition score state failed:"); }
}

export async function POST(request: Request, context: Context) {
    try {
        const userId = await getMobileApiUserId(request); if (!userId) return unauthorizedResponse();
        const { teamId, eventId } = await context.params;
        let body: unknown; try { body = await request.json(); }
        catch { return mobileApiError("INVALID_JSON", "요청 내용을 확인해주세요.", 400); }
        return mobileApiSuccess(await saveCompetitionScores(userId, teamId, eventId, body));
    } catch (error) { return errorResponse(error, "Mobile competition score save failed:"); }
}

function errorResponse(error: unknown, context: string) {
    if (error instanceof CompetitionScoreError) return mobileApiError(error.code, error.message, error.status);
    console.error(context, error); return internalServerErrorResponse();
}
