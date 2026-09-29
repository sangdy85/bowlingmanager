import { getMobileApiUserId } from "@/lib/mobile-api/auth";
import { mobileApiSuccess, unauthorizedResponse } from "@/lib/mobile-api/response";
import { updateMemberAttendance } from "@/lib/mobile-api/team-events";
import { readJson, teamEventErrorResponse } from "@/lib/mobile-api/team-events-response";

type Context = { params: Promise<{ teamId: string; eventId: string; memberId: string }> };

export async function PUT(request: Request, context: Context) {
    try {
        const userId = await getMobileApiUserId(request);
        if (!userId) return unauthorizedResponse();
        const params = await context.params;
        return mobileApiSuccess(await updateMemberAttendance(
            userId,
            params.teamId,
            params.eventId,
            params.memberId,
            await readJson(request),
        ));
    } catch (error) {
        return teamEventErrorResponse(error, "Mobile managed team event attendance failed:");
    }
}
