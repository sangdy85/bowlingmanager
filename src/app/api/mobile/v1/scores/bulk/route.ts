import { getMobileApiUserId } from "@/lib/mobile-api/auth";
import {
    MobileCaptureValidationError,
    parseMobileBulkScoreRequest,
} from "@/lib/mobile-api/score-capture";
import {
    internalServerErrorResponse,
    mobileApiError,
    mobileApiSuccess,
    unauthorizedResponse,
} from "@/lib/mobile-api/response";
import {
    saveBulkScoreRows,
    ScoreBulkServiceError,
} from "@/lib/score-bulk-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
    try {
        const userId = await getMobileApiUserId(request);
        if (!userId) return unauthorizedResponse();

        let payload: unknown;
        try {
            payload = await request.json();
        } catch {
            return mobileApiError("INVALID_JSON", "요청 내용을 확인해주세요.", 400);
        }
        const input = parseMobileBulkScoreRequest(payload);
        const result = await saveBulkScoreRows({
            actorUserId: userId,
            teamId: input.teamId,
            rows: input.rows,
            requireMembership: true,
            requireActiveTeam: true,
            memberMatchMode: "none",
        });
        return mobileApiSuccess({
            createdCount: result.createdCount,
            playerCount: result.playerCount,
        }, 201);
    } catch (error) {
        if (error instanceof MobileCaptureValidationError) {
            return mobileApiError(error.code, error.message, 400);
        }
        if (error instanceof ScoreBulkServiceError) {
            return mobileApiError(error.code, error.message, error.status);
        }
        console.error("Mobile API bulk score save failed:", error);
        return internalServerErrorResponse();
    }
}
