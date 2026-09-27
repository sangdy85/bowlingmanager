import { getMobileApiUserId } from "@/lib/mobile-api/auth";
import { clubExpansionErrorResponse } from "@/lib/mobile-api/club-expansion-response";
import { deleteSeasonRankingImage, getSeasonRankingImage } from "@/lib/mobile-api/season-ranking-management";
import { mobileApiSuccess, unauthorizedResponse } from "@/lib/mobile-api/response";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ teamId: string; seasonId: string; imageId: string }> };

export async function GET(request: Request, context: Context) {
    try {
        const userId = await getMobileApiUserId(request); if (!userId) return unauthorizedResponse();
        const { teamId, seasonId, imageId } = await context.params;
        const image = await getSeasonRankingImage(userId, teamId, seasonId, imageId);
        return new Response(new Uint8Array(image.bytes), { headers: { "Content-Type": image.contentType, "Cache-Control": "private, max-age=3600" } });
    } catch (error) { return clubExpansionErrorResponse(error, "Mobile API ranking image read failed:"); }
}

export async function DELETE(request: Request, context: Context) {
    try {
        const userId = await getMobileApiUserId(request); if (!userId) return unauthorizedResponse();
        const { teamId, seasonId, imageId } = await context.params;
        return mobileApiSuccess(await deleteSeasonRankingImage(userId, teamId, seasonId, imageId));
    } catch (error) { return clubExpansionErrorResponse(error, "Mobile API ranking image deletion failed:"); }
}
