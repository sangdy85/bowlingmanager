import { readRefreshToken } from "@/lib/mobile-api/refresh-request";
import { revokeMobileRefreshTokenFamily } from "@/lib/mobile-api/refresh-token";
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
        await revokeMobileRefreshTokenFamily(refreshToken);
        return mobileApiSuccess({ loggedOut: true });
    } catch (error) {
        console.error("Mobile API /auth/logout failed:", error);
        return internalServerErrorResponse();
    }
}
