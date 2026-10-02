import { getMobileApiUserId } from "@/lib/mobile-api/auth";
import { getTeamFinanceSummary } from "@/lib/mobile-api/team-finance";
import { teamFinanceErrorResponse } from "@/lib/mobile-api/team-finance-response";
import { mobileApiSuccess, unauthorizedResponse } from "@/lib/mobile-api/response";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ teamId: string }> };

export async function GET(request: Request, context: Context) {
    try {
        const userId = await getMobileApiUserId(request);
        if (!userId) return unauthorizedResponse();
        const { teamId } = await context.params;
        return mobileApiSuccess(await getTeamFinanceSummary(userId, teamId));
    } catch (error) {
        return teamFinanceErrorResponse(error, "Mobile team finance summary failed:");
    }
}
