import { getMobileApiUserId } from "@/lib/mobile-api/auth";
import { clubExpansionErrorResponse } from "@/lib/mobile-api/club-expansion-response";
import { createSeasonPointAdjustment } from "@/lib/mobile-api/unified-season";
import { mobileApiSuccess, unauthorizedResponse } from "@/lib/mobile-api/response";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ teamId: string; seasonId: string }> };

export async function POST(request: Request, context: RouteContext) {
    try {
        const userId = await getMobileApiUserId(request);
        if (!userId) return unauthorizedResponse();
        const { teamId, seasonId } = await context.params;
        const input: unknown = await request.json().catch(() => null);
        return mobileApiSuccess(await createSeasonPointAdjustment(userId, teamId, seasonId, input), 201);
    } catch (error) {
        return clubExpansionErrorResponse(error, "Mobile API season point adjustment failed:");
    }
}
