import { internalServerErrorResponse, mobileApiError } from "@/lib/mobile-api/response";
import { TeamFinanceError } from "@/lib/mobile-api/team-finance";

export function teamFinanceErrorResponse(error: unknown, context: string) {
    if (error instanceof TeamFinanceError) return mobileApiError(error.code, error.message, error.status);
    console.error(context, error);
    return internalServerErrorResponse();
}

export async function readTeamFinanceJson(request: Request): Promise<unknown> {
    try {
        return await request.json();
    } catch {
        throw new TeamFinanceError("INVALID_JSON", "요청 내용을 확인해주세요.", 400);
    }
}
