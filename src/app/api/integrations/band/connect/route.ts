import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { buildBandAuthorizationUrl } from "@/lib/band/client";
import { encodeBandOAuthPending } from "@/lib/band/oauth-cookie";

export const dynamic = "force-dynamic";

const COOKIE_NAME = "bowling_band_oauth";

function safeReturnTo(value: string | null): string {
    if (!value || !value.startsWith("/") || value.startsWith("//")) {
        return "/";
    }

    return value;
}

export async function GET(request: NextRequest) {
    const session = await auth();

    if (!session?.user?.id) {
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set(
            "callbackUrl",
            request.nextUrl.pathname + request.nextUrl.search,
        );
        return NextResponse.redirect(loginUrl);
    }

    const returnTo = safeReturnTo(
        request.nextUrl.searchParams.get("returnTo"),
    );

    let authorizeUrl: string;
    try {
        authorizeUrl = buildBandAuthorizationUrl();
    } catch {
        const target = new URL(returnTo, request.url);
        target.searchParams.set("band", "not_configured");
        return NextResponse.redirect(target);
    }

    const payload = encodeBandOAuthPending({
        returnTo,
        userId: session.user.id,
        createdAt: Date.now(),
    });

    const response = NextResponse.redirect(authorizeUrl);
    response.cookies.set(COOKIE_NAME, payload, {
        httpOnly: true,
        sameSite: "lax",
        secure: request.nextUrl.protocol === "https:",
        path: "/",
        maxAge: 10 * 60,
    });

    return response;
}
