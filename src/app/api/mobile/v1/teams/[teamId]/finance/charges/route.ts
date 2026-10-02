import { getMobileApiUserId } from "@/lib/mobile-api/auth";
import { createTeamCharge, listTeamCharges } from "@/lib/mobile-api/team-finance";
import { readTeamFinanceJson, teamFinanceErrorResponse } from "@/lib/mobile-api/team-finance-response";
import { mobileApiSuccess, unauthorizedResponse } from "@/lib/mobile-api/response";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ teamId: string }> };

export async function GET(request: Request, context: Context) {
    try {
        const userId = await getMobileApiUserId(request);
        if (!userId) return unauthorizedResponse();
        const { teamId } = await context.params;
        return mobileApiSuccess(await listTeamCharges(userId, teamId));
    } catch (error) {
        return teamFinanceErrorResponse(error, "Mobile team finance charge list failed:");
    }
}

export async function POST(request: Request, context: Context) {
    try {
        const userId = await getMobileApiUserId(request);
        if (!userId) return unauthorizedResponse();
        const { teamId } = await context.params;
        const result = await createTeamCharge(userId, teamId, await readTeamFinanceJson(request));
        return mobileApiSuccess(result, 201);
    } catch (error) {
        return teamFinanceErrorResponse(error, "Mobile team finance charge create failed:");
    }
}
