import { getMobileApiUserId } from "@/lib/mobile-api/auth";
import { getMobilePostImage } from "@/lib/mobile-api/club-expansion";
import { clubExpansionErrorResponse } from "@/lib/mobile-api/club-expansion-response";
import { unauthorizedResponse } from "@/lib/mobile-api/response";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ teamId: string; imageId: string }> };

export async function GET(request: Request, context: RouteContext) {
    try {
        const userId = await getMobileApiUserId(request);
        if (!userId) return unauthorizedResponse();
        const { teamId, imageId } = await context.params;
        const image = await getMobilePostImage(userId, teamId, imageId);
        return new Response(new Uint8Array(image.bytes), {
            headers: { "Content-Type": image.contentType, "Cache-Control": "private, max-age=3600" },
        });
    } catch (error) {
        return clubExpansionErrorResponse(error, "Mobile API team post image failed:");
    }
}
