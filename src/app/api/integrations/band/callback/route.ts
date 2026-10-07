import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import {
    exchangeBandAuthorizationCode,
    fetchBandProfile,
} from "@/lib/band/client";
import { encryptBandToken } from "@/lib/band/token-crypto";

export const dynamic = "force-dynamic";

const COOKIE_NAME = "bowling_band_oauth";
const MAX_AGE_MS = 10 * 60 * 1000;

type PendingOAuth = {
    state: string;
    returnTo: string;
    userId: string;
    createdAt: number;
};

function decodePending(value: string | undefined): PendingOAuth | null {
    if (!value) return null;

    try {
        const decoded = JSON.parse(
            Buffer.from(value, "base64url").toString("utf8"),
        ) as PendingOAuth;

        if (
            !decoded
            || typeof decoded.state !== "string"
            || typeof decoded.returnTo !== "string"
            || typeof decoded.userId !== "string"
            || typeof decoded.createdAt !== "number"
        ) {
            return null;
        }

        return decoded;
    } catch {
        return null;
    }
}

function redirectWithStatus(
    request: NextRequest,
    returnTo: string,
    status: string,
) {
    const target = new URL(returnTo, request.url);
    target.searchParams.set("band", status);

    const response = NextResponse.redirect(target);
    response.cookies.delete(COOKIE_NAME);
    return response;
}

export async function GET(request: NextRequest) {
    const session = await auth();
    const pending = decodePending(
        request.cookies.get(COOKIE_NAME)?.value,
    );

    if (!session?.user?.id || !pending) {
        return redirectWithStatus(request, "/", "oauth_expired");
    }

    if (
        pending.userId !== session.user.id
        || Date.now() - pending.createdAt > MAX_AGE_MS
    ) {
        return redirectWithStatus(
            request,
            pending.returnTo || "/",
            "oauth_expired",
        );
    }

    const error = request.nextUrl.searchParams.get("error");
    if (error) {
        return redirectWithStatus(
            request,
            pending.returnTo,
            "oauth_denied",
        );
    }

    const returnedState = request.nextUrl.searchParams.get("state");
    if (returnedState && returnedState !== pending.state) {
        return redirectWithStatus(
            request,
            pending.returnTo,
            "oauth_invalid_state",
        );
    }

    const code = request.nextUrl.searchParams.get("code");
    if (!code) {
        return redirectWithStatus(
            request,
            pending.returnTo,
            "oauth_missing_code",
        );
    }

    try {
        const token = await exchangeBandAuthorizationCode(code);

        const profile = await fetchBandProfile(token.access_token)
            .catch(() => null);

        const expiresAt = typeof token.expires_in === "number"
            && Number.isFinite(token.expires_in)
            && token.expires_in > 0
            ? new Date(Date.now() + token.expires_in * 1000)
            : null;

        await (prisma as any).bandConnection.upsert({
            where: {
                userId: session.user.id,
            },
            create: {
                userId: session.user.id,
                bandUserKey: profile?.user_key || token.user_key,
                encryptedAccessToken: encryptBandToken(
                    token.access_token,
                ),
                encryptedRefreshToken: token.refresh_token
                    ? encryptBandToken(token.refresh_token)
                    : null,
                scope: token.scope || null,
                expiresAt,
            },
            update: {
                bandUserKey: profile?.user_key || token.user_key,
                encryptedAccessToken: encryptBandToken(
                    token.access_token,
                ),
                encryptedRefreshToken: token.refresh_token
                    ? encryptBandToken(token.refresh_token)
                    : null,
                scope: token.scope || null,
                expiresAt,
            },
        });

        return redirectWithStatus(
            request,
            pending.returnTo,
            "connected",
        );
    } catch (error) {
        console.error("BAND OAuth callback failed:", error);

        return redirectWithStatus(
            request,
            pending.returnTo,
            "oauth_failed",
        );
    }
}
