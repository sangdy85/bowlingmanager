import { getMobileApiUserId } from "@/lib/mobile-api/auth";
import { clubExpansionErrorResponse } from "@/lib/mobile-api/club-expansion-response";
import { addSeasonRankingImage, listSeasonRankingImages } from "@/lib/mobile-api/season-ranking-management";
import { mobileApiError, mobileApiSuccess, unauthorizedResponse } from "@/lib/mobile-api/response";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ teamId: string; seasonId: string }> };

export async function GET(request: Request, context: Context) {
    try {
        const userId = await getMobileApiUserId(request); if (!userId) return unauthorizedResponse();
        const { teamId, seasonId } = await context.params;
        return mobileApiSuccess(await listSeasonRankingImages(userId, teamId, seasonId));
    } catch (error) { return clubExpansionErrorResponse(error, "Mobile API ranking image list failed:"); }
}

export async function POST(request: Request, context: Context) {
    try {
        const userId = await getMobileApiUserId(request); if (!userId) return unauthorizedResponse();
        let form: FormData; try { form = await request.formData(); } catch { return mobileApiError("INVALID_REQUEST", "요청 내용을 확인해주세요.", 400); }
        const file = form.get("image");
        if (!(file instanceof File)) return mobileApiError("IMAGE_REQUIRED", "순위표 이미지를 선택해주세요.", 400);
        const { teamId, seasonId } = await context.params;
        return mobileApiSuccess(await addSeasonRankingImage(userId, teamId, seasonId, file), 201);
    } catch (error) { return clubExpansionErrorResponse(error, "Mobile API ranking image upload failed:"); }
}
