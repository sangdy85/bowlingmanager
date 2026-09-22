import { getMobileApiUserId } from "@/lib/mobile-api/auth";
import {
    internalServerErrorResponse,
    mobileApiSuccess,
    unauthorizedResponse,
} from "@/lib/mobile-api/response";
import { listMobileTeams } from "@/lib/mobile-api/teams";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    try {
        const userId = await getMobileApiUserId(request);
        if (!userId) return unauthorizedResponse();

        return mobileApiSuccess({ teams: await listMobileTeams(userId) });
    } catch (error) {
        console.error("Mobile API /teams failed:", error);
        return internalServerErrorResponse();
    }
}
