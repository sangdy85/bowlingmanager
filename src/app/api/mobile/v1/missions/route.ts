import { getMobileApiUserId } from "@/lib/mobile-api/auth";
import { getMyMissions } from "@/lib/mobile-api/missions";
import { missionErrorResponse } from "@/lib/mobile-api/mission-response";
import { mobileApiSuccess, unauthorizedResponse } from "@/lib/mobile-api/response";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
    try {
        const userId = await getMobileApiUserId(request); if (!userId) return unauthorizedResponse();
        return mobileApiSuccess(await getMyMissions(userId));
    } catch (error) { return missionErrorResponse(error); }
}
