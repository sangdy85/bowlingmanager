import "server-only";

import {
    createHmac,
    timingSafeEqual,
} from "node:crypto";

export type BandOAuthPending = {
    returnTo: string;
    userId: string;
    createdAt: number;
};

function signingSecret(): string {
    const value = process.env.AUTH_SECRET?.trim();

    if (!value) {
        throw new Error("AUTH_SECRET is required for BAND OAuth state.");
    }

    return value;
}

function sign(encodedPayload: string): string {
    return createHmac("sha256", signingSecret())
        .update(encodedPayload)
        .digest("base64url");
}

export function encodeBandOAuthPending(
    pending: BandOAuthPending,
): string {
    const encoded = Buffer.from(
        JSON.stringify(pending),
        "utf8",
    ).toString("base64url");

    return `${encoded}.${sign(encoded)}`;
}

export function decodeBandOAuthPending(
    value: string | undefined,
): BandOAuthPending | null {
    if (!value) return null;

    const separator = value.lastIndexOf(".");
    if (separator <= 0 || separator >= value.length - 1) {
        return null;
    }

    const encoded = value.slice(0, separator);
    const signature = value.slice(separator + 1);
    const expected = sign(encoded);

    const actualBuffer = Buffer.from(signature, "utf8");
    const expectedBuffer = Buffer.from(expected, "utf8");

    if (
        actualBuffer.length !== expectedBuffer.length
        || !timingSafeEqual(actualBuffer, expectedBuffer)
    ) {
        return null;
    }

    try {
        const decoded = JSON.parse(
            Buffer.from(encoded, "base64url").toString("utf8"),
        ) as BandOAuthPending;

        if (
            !decoded
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
