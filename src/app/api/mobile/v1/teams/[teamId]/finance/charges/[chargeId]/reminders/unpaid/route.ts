import { getMobileApiUserId } from "@/lib/mobile-api/auth";
import { remindUnpaidTeamChargeMembers } from "@/lib/mobile-api/team-finance-reminders";
import { teamFinanceErrorResponse } from "@/lib/mobile-api/team-finance-response";
import { mobileApiSuccess, unauthorizedResponse } from "@/lib/mobile-api/response";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ teamId: string; chargeId: string }> };

export async function POST(request: Request, context: Context) {
    try {
        const userId = await getMobileApiUserId(request);
        if (!userId) return unauthorizedResponse();
        const { teamId, chargeId } = await context.params;
        return mobileApiSuccess(await remindUnpaidTeamChargeMembers(userId, teamId, chargeId));
    } catch (error) {
        return teamFinanceErrorResponse(error, "Mobile team finance unpaid reminder failed:");
    }
}
