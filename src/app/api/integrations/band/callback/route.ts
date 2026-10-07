import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { verifyCenterAdmin } from '@/lib/auth-utils';
import { exchangeBandAuthorizationCode, verifyBandOAuthState } from '@/lib/band/auth';
import { encryptBandToken } from '@/lib/band/token-crypto';

function editUrl(request: NextRequest, centerId: string, result: string) {
    return new URL(`/centers/${centerId}/edit?band=${result}`, request.url);
}

export async function GET(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.redirect(new URL('/login', request.url));

    const code = request.nextUrl.searchParams.get('code');
    const state = request.nextUrl.searchParams.get('state');
    if (!code || !state || request.nextUrl.searchParams.has('error')) {
        return NextResponse.redirect(new URL('/centers?band=oauth-error', request.url));
    }

    let stateData: { centerId: string; userId: string };
    try {
        stateData = await verifyBandOAuthState(state);
        if (stateData.userId !== session.user.id) throw new Error('OAuth user mismatch.');
        await verifyCenterAdmin(stateData.centerId);
    } catch {
        return NextResponse.redirect(new URL('/centers?band=state-error', request.url));
    }

    try {
        const token = await exchangeBandAuthorizationCode(code);
        const expiresAt = token.expiresIn ? new Date(Date.now() + token.expiresIn * 1000) : null;
        await (prisma as any).bandConnection.upsert({
            where: { centerId: stateData.centerId },
            create: {
                centerId: stateData.centerId,
                connectedByUserId: session.user.id,
                bandUserKey: token.userKey,
                accessTokenEncrypted: encryptBandToken(token.accessToken),
                refreshTokenEncrypted: token.refreshToken ? encryptBandToken(token.refreshToken) : null,
                tokenExpiresAt: expiresAt,
            },
            update: {
                connectedByUserId: session.user.id,
                bandUserKey: token.userKey,
                accessTokenEncrypted: encryptBandToken(token.accessToken),
                refreshTokenEncrypted: token.refreshToken ? encryptBandToken(token.refreshToken) : null,
                tokenExpiresAt: expiresAt,
                bandKey: null,
                bandName: null,
                bandCoverUrl: null,
                enabled: true,
                connectedAt: new Date(),
            },
        });
        return NextResponse.redirect(editUrl(request, stateData.centerId, 'connected'));
    } catch {
        return NextResponse.redirect(editUrl(request, stateData.centerId, 'token-error'));
    }
}
