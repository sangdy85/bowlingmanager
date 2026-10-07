import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { verifyCenterAdmin } from '@/lib/auth-utils';
import { exchangeBandAuthorizationCode, verifyBandOAuthState } from '@/lib/band/auth';
import { encryptBandToken } from '@/lib/band/token-crypto';

const COOKIE_NAME = 'bowling_band_oauth';

function redirectAndClear(
    request: NextRequest,
    target: URL,
) {
    const response = NextResponse.redirect(target);
    response.cookies.delete(COOKIE_NAME);
    return response;
}

function editUrl(request: NextRequest, centerId: string, result: string) {
    return new URL(`/centers/${centerId}/edit?band=${result}`, request.url);
}

export async function GET(request: NextRequest) {
    const session = await auth();

    if (!session?.user?.id) {
        return redirectAndClear(
            request,
            new URL('/login', request.url),
        );
    }

    const pending = request.cookies.get(COOKIE_NAME)?.value;
    if (!pending) {
        return redirectAndClear(
            request,
            new URL('/centers?band=state-error', request.url),
        );
    }

    let stateData: { centerId: string; userId: string };
    try {
        stateData = await verifyBandOAuthState(pending);

        if (stateData.userId !== session.user.id) {
            throw new Error('OAuth user mismatch.');
        }

        await verifyCenterAdmin(stateData.centerId);
    } catch {
        return redirectAndClear(
            request,
            new URL('/centers?band=state-error', request.url),
        );
    }

    const code = request.nextUrl.searchParams.get('code');
    if (!code || request.nextUrl.searchParams.has('error')) {
        return redirectAndClear(
            request,
            editUrl(request, stateData.centerId, 'oauth-error'),
        );
    }

    try {
        const token = await exchangeBandAuthorizationCode(code);
        const expiresAt = token.expiresIn
            ? new Date(Date.now() + token.expiresIn * 1000)
            : null;

        await (prisma as any).bandConnection.upsert({
            where: { centerId: stateData.centerId },
            create: {
                centerId: stateData.centerId,
                connectedByUserId: session.user.id,
                bandUserKey: token.userKey,
                accessTokenEncrypted: encryptBandToken(token.accessToken),
                refreshTokenEncrypted: token.refreshToken
                    ? encryptBandToken(token.refreshToken)
                    : null,
                tokenExpiresAt: expiresAt,
            },
            update: {
                connectedByUserId: session.user.id,
                bandUserKey: token.userKey,
                accessTokenEncrypted: encryptBandToken(token.accessToken),
                refreshTokenEncrypted: token.refreshToken
                    ? encryptBandToken(token.refreshToken)
                    : null,
                tokenExpiresAt: expiresAt,
                bandKey: null,
                bandName: null,
                bandCoverUrl: null,
                enabled: true,
                connectedAt: new Date(),
            },
        });

        return redirectAndClear(
            request,
            editUrl(request, stateData.centerId, 'connected'),
        );
    } catch {
        return redirectAndClear(
            request,
            editUrl(request, stateData.centerId, 'token-error'),
        );
    }
}
