import { getMobileApiUserId } from "@/lib/mobile-api/auth";
import {
    internalServerErrorResponse,
    mobileApiError,
    mobileApiSuccess,
    unauthorizedResponse,
} from "@/lib/mobile-api/response";
import {
    MobileSuperAdminError,
    setMobileTeamBowlerHiddenEnabled,
} from "@/lib/mobile-api/super-admin";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ teamId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
    try {
        const userId = await getMobileApiUserId(request);
        if (!userId) return unauthorizedResponse();

        const input = await readInput(request);
        if (!input) {
            return mobileApiError(
                "INVALID_REQUEST",
                "요청 내용을 확인해주세요.",
                400,
            );
        }
        const { teamId } = await context.params;
        const team = await setMobileTeamBowlerHiddenEnabled(
            userId,
            teamId,
            input.enabled,
        );
        return mobileApiSuccess({ team });
    } catch (error) {
        if (error instanceof MobileSuperAdminError) {
            return mobileApiError(error.code, error.message, error.status);
        }
        console.error("Mobile API Bowler Hidden activation failed:", error);
        return internalServerErrorResponse();
    }
}

async function readInput(request: Request): Promise<{ enabled: boolean } | null> {
    try {
        const body: unknown = await request.json();
        if (!body || typeof body !== "object" || Array.isArray(body)) return null;
        const record = body as Record<string, unknown>;
        if (Object.keys(record).length !== 1 || typeof record.enabled !== "boolean") {
            return null;
        }
        return { enabled: record.enabled };
    } catch {
        return null;
    }
}
