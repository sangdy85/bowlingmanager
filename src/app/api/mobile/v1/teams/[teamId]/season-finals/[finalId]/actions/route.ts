import { getMobileApiUserId } from "@/lib/mobile-api/auth";
import { confirmSeasonFinalNode, lockSeasonFinal, saveSeasonFinalScores, SeasonFinalError, startSeasonFinal } from "@/lib/mobile-api/season-finals";
import { seasonFinalErrorResponse } from "@/lib/mobile-api/season-finals-response";
import { mobileApiSuccess, unauthorizedResponse } from "@/lib/mobile-api/response";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ teamId: string; finalId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const userId = await getMobileApiUserId(request); if (!userId) return unauthorizedResponse();
    const { teamId, finalId } = await context.params;
    let body: Record<string, unknown>; try { body = await request.json(); } catch { body = {}; }
    if (body.action === "LOCK") return mobileApiSuccess(await lockSeasonFinal(userId, teamId, finalId));
    if (body.action === "START") return mobileApiSuccess(await startSeasonFinal(userId, teamId, finalId));
    if (body.action === "SAVE_SCORES" && typeof body.nodeId === "string") return mobileApiSuccess(await saveSeasonFinalScores(userId, teamId, finalId, body.nodeId, body.scores));
    if (body.action === "CONFIRM_NODE" && typeof body.nodeId === "string") return mobileApiSuccess(await confirmSeasonFinalNode(userId, teamId, finalId, body.nodeId));
    throw new SeasonFinalError("INVALID_ACTION", "요청 작업을 확인해주세요.", 400);
  } catch (error) { return seasonFinalErrorResponse(error, "Mobile API season final action failed:"); }
}
