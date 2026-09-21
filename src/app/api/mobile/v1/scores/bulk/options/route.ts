import { getMobileApiUserId } from "@/lib/mobile-api/auth";
import {
    internalServerErrorResponse,
    mobileApiSuccess,
    unauthorizedResponse,
} from "@/lib/mobile-api/response";
import { SCORE_GAME_TYPES, listManageableScoreTeams } from "@/lib/score-bulk-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    try {
        const userId = await getMobileApiUserId(request);
        if (!userId) return unauthorizedResponse();

        return mobileApiSuccess({
            gameTypes: [...SCORE_GAME_TYPES],
            teams: await listManageableScoreTeams(userId),
        });
    } catch (error) {
        console.error("Mobile API score entry options failed:", error);
        return internalServerErrorResponse();
    }
}
