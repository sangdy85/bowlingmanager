import { readRefreshToken } from "@/lib/mobile-api/refresh-request";
import { rotateMobileRefreshToken } from "@/lib/mobile-api/refresh-token";
import {
    internalServerErrorResponse,
    mobileApiError,
    mobileApiSuccess,
} from "@/lib/mobile-api/response";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
    const refreshToken = await readRefreshToken(request);

    if (!refreshToken) {
        return mobileApiError(
            "INVALID_REQUEST",
            "Refresh Token을 입력해주세요.",
            400,
        );
    }

    try {
        const result = await rotateMobileRefreshToken(refreshToken);

        if (!result.success) {
            return mobileApiError(
                "INVALID_REFRESH_TOKEN",
                "유효하지 않은 Refresh Token입니다.",
                401,
            );
        }

        return mobileApiSuccess(result.tokens);
    } catch (error) {
        console.error("Mobile API /auth/refresh failed:", error);
        return internalServerErrorResponse();
    }
}
