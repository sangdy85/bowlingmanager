import { getMobileApiUserId } from "@/lib/mobile-api/auth";
import { clubExpansionErrorResponse } from "@/lib/mobile-api/club-expansion-response";
import { previewSeasonLegacyImport } from "@/lib/mobile-api/season-legacy-import";
import { mobileApiSuccess, unauthorizedResponse } from "@/lib/mobile-api/response";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ teamId: string; seasonId: string }> };

export async function POST(request: Request, context: RouteContext) {
    try {
        const userId = await getMobileApiUserId(request);
        if (!userId) return unauthorizedResponse();
        const { teamId, seasonId } = await context.params;
        return mobileApiSuccess(await previewSeasonLegacyImport(
            userId, teamId, seasonId, await request.json().catch(() => null),
        ));
    } catch (error) {
        return clubExpansionErrorResponse(error, "Mobile API season legacy import preview failed:");
    }
}
