import { auth } from "@/auth";
import { verifyMobileAccessToken } from "@/lib/mobile-api/token";

/**
 * Bearer authentication takes precedence whenever an Authorization header is
 * present. Invalid or malformed credentials never fall back to a web session,
 * which prevents an ambiguous request from being accepted under another identity.
 * Requests without that header retain Phase 1 compatibility with Auth.js sessions.
 */
export async function getMobileApiUserId(request: Request): Promise<string | null> {
    const authorization = request.headers.get("authorization");

    if (authorization !== null) {
        const bearerMatch = /^Bearer ([^\s]+)$/i.exec(authorization);
        if (!bearerMatch) return null;

        return verifyMobileAccessToken(bearerMatch[1]);
    }

    const session = await auth();
    return session?.user?.id ?? null;
}
