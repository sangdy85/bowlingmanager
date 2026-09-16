import { NextResponse } from "next/server";

type MobileApiSuccess<T> = {
    success: true;
    data: T;
};

type MobileApiFailure = {
    success: false;
    error: {
        code: string;
        message: string;
    };
};

const responseHeaders = {
    "Cache-Control": "no-store",
};

export function mobileApiSuccess<T>(data: T, status = 200) {
    return NextResponse.json<MobileApiSuccess<T>>(
        { success: true, data },
        { status, headers: responseHeaders },
    );
}

export function mobileApiError(code: string, message: string, status: number) {
    return NextResponse.json<MobileApiFailure>(
        {
            success: false,
            error: { code, message },
        },
        { status, headers: responseHeaders },
    );
}

export function unauthorizedResponse() {
    return mobileApiError("UNAUTHORIZED", "로그인이 필요합니다.", 401);
}

export function internalServerErrorResponse() {
    return mobileApiError(
        "INTERNAL_SERVER_ERROR",
        "요청을 처리하는 중 오류가 발생했습니다.",
        500,
    );
}
