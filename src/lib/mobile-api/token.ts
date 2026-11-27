import "server-only";

import { jwtVerify, SignJWT } from "jose";

export const MOBILE_ACCESS_TOKEN_EXPIRES_IN_SECONDS = 15 * 60;

const MOBILE_TOKEN_ISSUER = "bowlingmanager-mobile-api";
const MOBILE_TOKEN_AUDIENCE = "bowlingmanager-flutter";
const MOBILE_TOKEN_TYPE = "access";
const MOBILE_TOKEN_VERSION = 1;
const MINIMUM_SECRET_BYTES = 32;

function getMobileTokenSecret() {
    const secret = process.env.MOBILE_API_JWT_SECRET;

    if (!secret || new TextEncoder().encode(secret).byteLength < MINIMUM_SECRET_BYTES) {
        throw new Error("MOBILE_API_JWT_SECRET must contain at least 32 bytes.");
    }

    if (process.env.AUTH_SECRET && secret === process.env.AUTH_SECRET) {
        throw new Error("MOBILE_API_JWT_SECRET must be different from AUTH_SECRET.");
    }

    return new TextEncoder().encode(secret);
}

export async function issueMobileAccessToken(userId: string) {
    const accessToken = await new SignJWT({
        tokenType: MOBILE_TOKEN_TYPE,
        tokenVersion: MOBILE_TOKEN_VERSION,
    })
        .setProtectedHeader({ alg: "HS256", typ: "JWT" })
        .setSubject(userId)
        .setIssuer(MOBILE_TOKEN_ISSUER)
        .setAudience(MOBILE_TOKEN_AUDIENCE)
        .setIssuedAt()
        .setExpirationTime(`${MOBILE_ACCESS_TOKEN_EXPIRES_IN_SECONDS}s`)
        .sign(getMobileTokenSecret());

    return {
        accessToken,
        tokenType: "Bearer" as const,
        expiresIn: MOBILE_ACCESS_TOKEN_EXPIRES_IN_SECONDS,
    };
}

export async function verifyMobileAccessToken(token: string): Promise<string | null> {
    const secret = getMobileTokenSecret();

    try {
        const { payload } = await jwtVerify(token, secret, {
            algorithms: ["HS256"],
            issuer: MOBILE_TOKEN_ISSUER,
            audience: MOBILE_TOKEN_AUDIENCE,
        });

        if (
            typeof payload.sub !== "string"
            || payload.tokenType !== MOBILE_TOKEN_TYPE
            || payload.tokenVersion !== MOBILE_TOKEN_VERSION
        ) {
            return null;
        }

        return payload.sub;
    } catch {
        return null;
    }
}
