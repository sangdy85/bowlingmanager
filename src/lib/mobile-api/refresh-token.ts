import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { issueMobileAccessToken } from "@/lib/mobile-api/token";

export const MOBILE_REFRESH_TOKEN_EXPIRES_IN_SECONDS = 30 * 24 * 60 * 60;

const REFRESH_TOKEN_BYTES = 32;
const MAX_REFRESH_TOKEN_LENGTH = 512;
const MAX_TRANSACTION_ATTEMPTS = 3;

type RefreshResult =
    | {
        success: true;
        tokens: Awaited<ReturnType<typeof issueMobileTokenPair>>;
    }
    | {
        success: false;
    };

function generateOpaqueRefreshToken() {
    return randomBytes(REFRESH_TOKEN_BYTES).toString("base64url");
}

function hashRefreshToken(refreshToken: string) {
    return createHash("sha256").update(refreshToken, "utf8").digest("hex");
}

function refreshTokenExpiresAt() {
    return new Date(Date.now() + MOBILE_REFRESH_TOKEN_EXPIRES_IN_SECONDS * 1000);
}

function isP2034(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError
        && error.code === "P2034";
}

async function createRefreshToken(userId: string) {
    const refreshToken = generateOpaqueRefreshToken();

    await prisma.mobileRefreshToken.create({
        data: {
            tokenHash: hashRefreshToken(refreshToken),
            familyId: randomUUID(),
            userId,
            expiresAt: refreshTokenExpiresAt(),
        },
    });

    return {
        refreshToken,
        refreshTokenExpiresIn: MOBILE_REFRESH_TOKEN_EXPIRES_IN_SECONDS,
    };
}

export async function issueMobileTokenPair(userId: string) {
    const accessToken = await issueMobileAccessToken(userId);
    const refreshToken = await createRefreshToken(userId);

    return {
        ...accessToken,
        ...refreshToken,
    };
}

export async function rotateMobileRefreshToken(
    refreshToken: string,
): Promise<RefreshResult> {
    if (!refreshToken || refreshToken.length > MAX_REFRESH_TOKEN_LENGTH) {
        return { success: false };
    }

    const tokenHash = hashRefreshToken(refreshToken);

    for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
        try {
            return await prisma.$transaction(async (tx) => {
                const now = new Date();
                const currentToken = await tx.mobileRefreshToken.findUnique({
                    where: { tokenHash },
                    select: {
                        id: true,
                        familyId: true,
                        userId: true,
                        expiresAt: true,
                        usedAt: true,
                        revokedAt: true,
                    },
                });

                if (!currentToken) return { success: false };

                if (currentToken.usedAt || currentToken.revokedAt) {
                    await tx.mobileRefreshToken.updateMany({
                        where: {
                            familyId: currentToken.familyId,
                            revokedAt: null,
                        },
                        data: { revokedAt: now },
                    });
                    return { success: false };
                }

                if (currentToken.expiresAt <= now) {
                    await tx.mobileRefreshToken.updateMany({
                        where: {
                            id: currentToken.id,
                            revokedAt: null,
                        },
                        data: { revokedAt: now },
                    });
                    return { success: false };
                }

                const claimed = await tx.mobileRefreshToken.updateMany({
                    where: {
                        id: currentToken.id,
                        usedAt: null,
                        revokedAt: null,
                        expiresAt: { gt: now },
                    },
                    data: { usedAt: now },
                });

                if (claimed.count !== 1) {
                    await tx.mobileRefreshToken.updateMany({
                        where: {
                            familyId: currentToken.familyId,
                            revokedAt: null,
                        },
                        data: { revokedAt: now },
                    });
                    return { success: false };
                }

                const nextRefreshToken = generateOpaqueRefreshToken();
                await tx.mobileRefreshToken.create({
                    data: {
                        tokenHash: hashRefreshToken(nextRefreshToken),
                        familyId: currentToken.familyId,
                        userId: currentToken.userId,
                        expiresAt: refreshTokenExpiresAt(),
                    },
                });

                const nextAccessToken = await issueMobileAccessToken(currentToken.userId);

                return {
                    success: true,
                    tokens: {
                        ...nextAccessToken,
                        refreshToken: nextRefreshToken,
                        refreshTokenExpiresIn: MOBILE_REFRESH_TOKEN_EXPIRES_IN_SECONDS,
                    },
                };
            }, {
                isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            });
        } catch (error) {
            if (attempt < MAX_TRANSACTION_ATTEMPTS && isP2034(error)) continue;
            throw error;
        }
    }

    return { success: false };
}

export async function revokeMobileRefreshTokenFamily(refreshToken: string) {
    if (!refreshToken || refreshToken.length > MAX_REFRESH_TOKEN_LENGTH) return;

    const tokenHash = hashRefreshToken(refreshToken);

    for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
        try {
            await prisma.$transaction(async (tx) => {
                const token = await tx.mobileRefreshToken.findUnique({
                    where: { tokenHash },
                    select: { familyId: true },
                });

                if (!token) return;

                await tx.mobileRefreshToken.updateMany({
                    where: {
                        familyId: token.familyId,
                        revokedAt: null,
                    },
                    data: { revokedAt: new Date() },
                });
            }, {
                isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            });
            return;
        } catch (error) {
            if (attempt < MAX_TRANSACTION_ATTEMPTS && isP2034(error)) continue;
            throw error;
        }
    }
}
