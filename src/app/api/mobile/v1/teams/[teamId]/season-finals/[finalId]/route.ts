import { getMobileApiUserId } from "@/lib/mobile-api/auth";
import { getSeasonFinals, saveSeasonFinalStructure, SeasonFinalStructure } from "@/lib/mobile-api/season-finals";
import { seasonFinalErrorResponse } from "@/lib/mobile-api/season-finals-response";
import { mobileApiSuccess, unauthorizedResponse } from "@/lib/mobile-api/response";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ teamId: string; finalId: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const userId = await getMobileApiUserId(request); if (!userId) return unauthorizedResponse();
    const { teamId, finalId } = await context.params;
    return mobileApiSuccess(await getSeasonFinals(userId, teamId, finalId));
  } catch (error) { return seasonFinalErrorResponse(error, "Mobile API season final detail failed:"); }
}

export async function PUT(request: Request, context: Context) {
  try {
    const userId = await getMobileApiUserId(request); if (!userId) return unauthorizedResponse();
    const { teamId, finalId } = await context.params;
    let body: unknown; try { body = await request.json(); } catch { body = {}; }
    return mobileApiSuccess(await saveSeasonFinalStructure(userId, teamId, finalId, body as SeasonFinalStructure));
  } catch (error) { return seasonFinalErrorResponse(error, "Mobile API season final structure failed:"); }
}
