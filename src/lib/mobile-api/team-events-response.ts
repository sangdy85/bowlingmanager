import { internalServerErrorResponse, mobileApiError } from "@/lib/mobile-api/response";
import { TeamEventError } from "@/lib/mobile-api/team-events";

export function teamEventErrorResponse(error: unknown, context: string) {
    if (error instanceof TeamEventError) return mobileApiError(error.code, error.message, error.status);
    console.error(context, error);
    return internalServerErrorResponse();
}

export async function readJson(request: Request): Promise<unknown> {
    try { return await request.json(); }
    catch { throw new TeamEventError("INVALID_JSON", "요청 내용을 확인해주세요.", 400); }
}
