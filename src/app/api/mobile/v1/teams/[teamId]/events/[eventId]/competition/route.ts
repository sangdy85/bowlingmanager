import { getMobileApiUserId } from "@/lib/mobile-api/auth";
import { BowlerHiddenError, getBowlerHiddenCompetition, updateBowlerHiddenCompetition } from "@/lib/mobile-api/bowler-hidden";
import { UnifiedSeasonError } from "@/lib/mobile-api/unified-season";
import { internalServerErrorResponse, mobileApiError, mobileApiSuccess, unauthorizedResponse } from "@/lib/mobile-api/response";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ teamId: string; eventId: string }> };

export async function GET(request: Request, context: Context) {
    try {
        const userId = await getMobileApiUserId(request);
        if (!userId) return unauthorizedResponse();
        const { teamId, eventId } = await context.params;
        return mobileApiSuccess(await getBowlerHiddenCompetition(userId, teamId, eventId));
    } catch (error) {
        if (error instanceof BowlerHiddenError) return mobileApiError(error.code, error.message, error.status);
        console.error("Mobile Bowler Hidden competition failed:", error);
        return internalServerErrorResponse();
    }
}

export async function POST(request: Request, context: Context) {
    try {
        const userId = await getMobileApiUserId(request); if (!userId) return unauthorizedResponse();
        const { teamId, eventId } = await context.params;
        let body: unknown; try { body = await request.json(); } catch { return mobileApiError("INVALID_JSON", "요청 내용을 확인해주세요.", 400); }
        return mobileApiSuccess(await updateBowlerHiddenCompetition(userId, teamId, eventId, body));
    } catch (error) {
        if (error instanceof BowlerHiddenError || error instanceof UnifiedSeasonError) return mobileApiError(error.code, error.message, error.status);
        console.error("Mobile Bowler Hidden competition mutation failed:", error); return internalServerErrorResponse();
    }
}
