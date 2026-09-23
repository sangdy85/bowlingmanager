import { SeasonFinalError } from "@/lib/mobile-api/season-finals";
import { mobileApiError } from "@/lib/mobile-api/response";

export function seasonFinalErrorResponse(error: unknown, context: string) {
  if (error instanceof SeasonFinalError) return mobileApiError(error.code, error.message, error.status);
  console.error(context, error);
  return mobileApiError("INTERNAL_ERROR", "요청을 처리하지 못했습니다.", 500);
}
