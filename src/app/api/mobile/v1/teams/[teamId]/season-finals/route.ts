import { getMobileApiUserId } from "@/lib/mobile-api/auth";
import { createSeasonFinal, getSeasonFinals } from "@/lib/mobile-api/season-finals";
import { seasonFinalErrorResponse } from "@/lib/mobile-api/season-finals-response";
import { mobileApiSuccess, unauthorizedResponse } from "@/lib/mobile-api/response";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ teamId: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const userId = await getMobileApiUserId(request); if (!userId) return unauthorizedResponse();
    const { teamId } = await context.params;
    return mobileApiSuccess(await getSeasonFinals(userId, teamId));
  } catch (error) { return seasonFinalErrorResponse(error, "Mobile API season finals list failed:"); }
}

export async function POST(request: Request, context: Context) {
  try {
    const userId = await getMobileApiUserId(request); if (!userId) return unauthorizedResponse();
    const { teamId } = await context.params;
    let body: unknown; try { body = await request.json(); } catch { body = {}; }
    return mobileApiSuccess(await createSeasonFinal(userId, teamId, body as { seasonId?: unknown; name?: unknown; competitionMode?: unknown }), 201);
  } catch (error) { return seasonFinalErrorResponse(error, "Mobile API season final create failed:"); }
}
