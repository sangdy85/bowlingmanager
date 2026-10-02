import { getMobileApiUserId } from "@/lib/mobile-api/auth";
import {
    internalServerErrorResponse,
    mobileApiError,
    mobileApiSuccess,
    unauthorizedResponse,
} from "@/lib/mobile-api/response";
import { joinTeamByCode } from "@/lib/team-membership";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
    try {
        const userId = await getMobileApiUserId(request);
        if (!userId) return unauthorizedResponse();

        let body: unknown;
        try {
            body = await request.json();
        } catch {
            return mobileApiError("INVALID_REQUEST", "요청 본문을 확인해주세요.", 400);
        }
        if (!body || typeof body !== "object" || Array.isArray(body)) {
            return mobileApiError("INVALID_REQUEST", "요청 본문을 확인해주세요.", 400);
        }

        const result = await joinTeamByCode({
            userId,
            code: (body as Record<string, unknown>).code,
        });
        if (result.status === "INVALID_CODE") {
            return mobileApiError("INVALID_TEAM_CODE", "초대 코드는 영문과 숫자 6자리여야 합니다.", 400);
        }
        if (result.status === "TEAM_NOT_FOUND") {
            return mobileApiError("TEAM_NOT_FOUND", "유효하지 않은 초대 코드입니다.", 404);
        }
        if (result.status === "TEAM_INACTIVE") {
            return mobileApiError("TEAM_INACTIVE", "더 이상 가입할 수 없는 동호회입니다.", 409);
        }

        return mobileApiSuccess({
            team: result.team,
            joined: result.status === "JOINED",
            alreadyMember: result.status === "ALREADY_MEMBER",
        });
    } catch (error) {
        console.error("Mobile API team join failed:", error);
        return internalServerErrorResponse();
    }
}
