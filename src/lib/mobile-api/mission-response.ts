import { internalServerErrorResponse, mobileApiError } from "@/lib/mobile-api/response";
import { MissionError } from "@/lib/mobile-api/mission-rules";
export function missionErrorResponse(error: unknown) {
    if (error instanceof MissionError) return mobileApiError(error.code, error.message, error.status);
    if (error instanceof SyntaxError) return mobileApiError("INVALID_REQUEST", "요청 형식을 확인해주세요.", 400);
    console.error("Mobile missions failed:", error instanceof Error ? error.name : typeof error);
    return internalServerErrorResponse();
}
