import { NextRequest } from "next/server";
import {
    checkCredentials,
    hasValidCredentials,
} from "@/lib/credentials-auth";
import { issueMobileTokenPair } from "@/lib/mobile-api/refresh-token";
import {
    internalServerErrorResponse,
    mobileApiError,
    mobileApiSuccess,
} from "@/lib/mobile-api/response";

export const dynamic = "force-dynamic";

type LoginBody = {
    email?: unknown;
    password?: unknown;
};

export async function POST(request: NextRequest) {
    let body: unknown;

    try {
        body = await request.json();
    } catch {
        return mobileApiError(
            "INVALID_REQUEST",
            "요청 형식을 확인해주세요.",
            400,
        );
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return mobileApiError(
            "INVALID_REQUEST",
            "요청 형식을 확인해주세요.",
            400,
        );
    }

    const credentials = body as LoginBody;

    if (
        typeof credentials.email !== "string"
        || typeof credentials.password !== "string"
        || !credentials.email
        || !credentials.password
    ) {
        return mobileApiError(
            "INVALID_REQUEST",
            "이메일과 비밀번호를 입력해주세요.",
            400,
        );
    }

    try {
        const credentialCheck = await checkCredentials(
            credentials.email,
            credentials.password,
        );

        if (!hasValidCredentials(credentialCheck)) {
            return mobileApiError(
                "INVALID_CREDENTIALS",
                "이메일 또는 비밀번호를 확인해주세요.",
                401,
            );
        }

        const tokens = await issueMobileTokenPair(credentialCheck.user.id);
        return mobileApiSuccess(tokens);
    } catch (error) {
        console.error("Mobile API /auth/login failed:", error);
        return internalServerErrorResponse();
    }
}
