import { getMobileApiUserId } from "@/lib/mobile-api/auth";
import { updateTeamChargePayment } from "@/lib/mobile-api/team-finance";
import { readTeamFinanceJson, teamFinanceErrorResponse } from "@/lib/mobile-api/team-finance-response";
import { mobileApiSuccess, unauthorizedResponse } from "@/lib/mobile-api/response";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ teamId: string; chargeId: string; targetId: string }> };

export async function PATCH(request: Request, context: Context) {
    try {
        const userId = await getMobileApiUserId(request);
        if (!userId) return unauthorizedResponse();
        const { teamId, chargeId, targetId } = await context.params;
        const result = await updateTeamChargePayment(
            userId,
            teamId,
            chargeId,
            targetId,
            await readTeamFinanceJson(request),
        );
        return mobileApiSuccess(result);
    } catch (error) {
        return teamFinanceErrorResponse(error, "Mobile team finance payment update failed:");
    }
}
