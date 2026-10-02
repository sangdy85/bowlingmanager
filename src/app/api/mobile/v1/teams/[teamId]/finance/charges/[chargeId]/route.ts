import { getMobileApiUserId } from "@/lib/mobile-api/auth";
import { getTeamCharge, updateTeamCharge } from "@/lib/mobile-api/team-finance";
import { readTeamFinanceJson, teamFinanceErrorResponse } from "@/lib/mobile-api/team-finance-response";
import { mobileApiSuccess, unauthorizedResponse } from "@/lib/mobile-api/response";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ teamId: string; chargeId: string }> };

export async function GET(request: Request, context: Context) {
    try {
        const userId = await getMobileApiUserId(request);
        if (!userId) return unauthorizedResponse();
        const { teamId, chargeId } = await context.params;
        return mobileApiSuccess(await getTeamCharge(userId, teamId, chargeId));
    } catch (error) {
        return teamFinanceErrorResponse(error, "Mobile team finance charge detail failed:");
    }
}

export async function PATCH(request: Request, context: Context) {
    try {
        const userId = await getMobileApiUserId(request);
        if (!userId) return unauthorizedResponse();
        const { teamId, chargeId } = await context.params;
        const result = await updateTeamCharge(userId, teamId, chargeId, await readTeamFinanceJson(request));
        return mobileApiSuccess(result);
    } catch (error) {
        return teamFinanceErrorResponse(error, "Mobile team finance charge update failed:");
    }
}
