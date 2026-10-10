import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { verifyCenterAdmin } from '@/lib/auth-utils';
import { exchangeBandAuthorizationCode, verifyBandOAuthState } from '@/lib/band/auth';
import { encryptBandToken } from '@/lib/band/token-crypto';
import { isBandConfigured } from '@/lib/band/config';
import { bandAppUrl } from '@/lib/band/redirect';

const COOKIE_NAME = 'bowling_band_oauth';

function redirectAndClear(
    request: NextRequest,
    target: URL,
) {
    const response = NextResponse.redirect(target);
    response.cookies.set(COOKIE_NAME, '', {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/api/integrations/band',
        maxAge: 0,
    });
    return response;
}

function editUrl(request: NextRequest, centerId: string, result: string) {
    return bandAppUrl(request, `/centers/${encodeURIComponent(centerId)}/edit?band=${result}`);
}

export async function GET(request: NextRequest) {
    let session;
    try {
        session = await auth();
    } catch {
        return redirectAndClear(request, bandAppUrl(request, '/login'));
    }

    if (!session?.user?.id) {
        return redirectAndClear(
            request,
            bandAppUrl(request, '/login'),
        );
    }

    const pending = request.cookies.get(COOKIE_NAME)?.value;
    const returnedState = request.nextUrl.searchParams.get('state');
    if (!pending || !returnedState || pending !== returnedState) {
        return redirectAndClear(
            request,
            bandAppUrl(request, '/centers?band=state-error'),
        );
    }

    let stateData: { centerId: string; userId: string };
    try {
        stateData = await verifyBandOAuthState(returnedState);

        if (stateData.userId !== session.user.id) {
            throw new Error('OAuth user mismatch.');
        }

        await verifyCenterAdmin(stateData.centerId);
    } catch {
        return redirectAndClear(
            request,
            bandAppUrl(request, '/centers?band=state-error'),
        );
    }

    const code = request.nextUrl.searchParams.get('code');
    if (!code?.trim() || request.nextUrl.searchParams.has('error')) {
        return redirectAndClear(
            request,
            editUrl(request, stateData.centerId, 'oauth-error'),
        );
    }

    if (!isBandConfigured()) {
        return redirectAndClear(request, editUrl(request, stateData.centerId, 'not-configured'));
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
                autoRecruitment: false,
                autoFinalResult: false,
                doPush: false,
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
