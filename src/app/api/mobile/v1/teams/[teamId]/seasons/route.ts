import { getMobileApiUserId } from "@/lib/mobile-api/auth";
import { seasonHistoryErrorResponse } from "@/lib/mobile-api/season-history-response";
import { createTeamSeason, listTeamSeasons } from "@/lib/mobile-api/season-history";
import { mobileApiSuccess, unauthorizedResponse } from "@/lib/mobile-api/response";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ teamId: string }> };

export async function GET(request: Request, context: Context) {
    try {
        const userId = await getMobileApiUserId(request); if (!userId) return unauthorizedResponse();
        const { teamId } = await context.params;
        return mobileApiSuccess(await listTeamSeasons(userId, teamId));
    } catch (error) { return seasonHistoryErrorResponse(error, "Mobile API seasons failed:"); }
}

export async function POST(request: Request, context: Context) {
    try {
        const userId = await getMobileApiUserId(request); if (!userId) return unauthorizedResponse();
        const { teamId } = await context.params;
        return mobileApiSuccess(await createTeamSeason(userId, teamId, await request.json()), 201);
    } catch (error) { return seasonHistoryErrorResponse(error, "Mobile API season creation failed:"); }
}
