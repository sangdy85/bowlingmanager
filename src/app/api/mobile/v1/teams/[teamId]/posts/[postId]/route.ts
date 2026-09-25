import { getMobileApiUserId } from "@/lib/mobile-api/auth";
import { deleteMobileTeamPost, getMobileTeamPost, updateMobileTeamPost } from "@/lib/mobile-api/club-expansion";
import { clubExpansionErrorResponse } from "@/lib/mobile-api/club-expansion-response";
import { mobileApiError, mobileApiSuccess, unauthorizedResponse } from "@/lib/mobile-api/response";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ teamId: string; postId: string }> };

async function postInput(request: Request) {
    const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.startsWith("multipart/form-data")) {
        return { body: await request.json(), files: [] as File[], retainedImageIds: undefined };
    }
    const form = await request.formData();
    const rawRetained = form.get("existingImageIds");
    const retainedImageIds = typeof rawRetained === "string" ? JSON.parse(rawRetained) : [];
    if (!Array.isArray(retainedImageIds) || retainedImageIds.some((value) => typeof value !== "string")) {
        throw new Error("invalid image ids");
    }
    return {
        body: { title: form.get("title"), content: form.get("content") },
        files: form.getAll("images").filter((value): value is File => value instanceof File),
        retainedImageIds,
    };
}

export async function GET(request: Request, context: RouteContext) {
    try {
        const userId = await getMobileApiUserId(request);
        if (!userId) return unauthorizedResponse();
        const { teamId, postId } = await context.params;
        return mobileApiSuccess({ post: await getMobileTeamPost(userId, teamId, postId) });
    } catch (error) { return clubExpansionErrorResponse(error, "Mobile API team post detail failed:"); }
}

export async function PATCH(request: Request, context: RouteContext) {
    try {
        const userId = await getMobileApiUserId(request);
        if (!userId) return unauthorizedResponse();
        let parsed: Awaited<ReturnType<typeof postInput>>;
        try { parsed = await postInput(request); } catch { return mobileApiError("INVALID_REQUEST", "요청 내용을 확인해주세요.", 400); }
        const { teamId, postId } = await context.params;
        return mobileApiSuccess(await updateMobileTeamPost(userId, teamId, postId, parsed.body, parsed.files, parsed.retainedImageIds));
    } catch (error) { return clubExpansionErrorResponse(error, "Mobile API team post update failed:"); }
}

export async function DELETE(request: Request, context: RouteContext) {
    try {
        const userId = await getMobileApiUserId(request);
        if (!userId) return unauthorizedResponse();
        const { teamId, postId } = await context.params;
        return mobileApiSuccess(await deleteMobileTeamPost(userId, teamId, postId));
    } catch (error) { return clubExpansionErrorResponse(error, "Mobile API team post deletion failed:"); }
}
