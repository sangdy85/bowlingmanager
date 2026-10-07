import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { verifyCenterAdmin } from '@/lib/auth-utils';
import { buildBandAuthorizationUrl, createBandOAuthState } from '@/lib/band/auth';

const COOKIE_NAME = 'bowling_band_oauth';

export async function GET(request: NextRequest) {
    const centerId = request.nextUrl.searchParams.get('centerId');
    const session = await auth();

    if (!session?.user?.id) {
        return NextResponse.redirect(new URL('/login', request.url));
    }
    if (!centerId) {
        return NextResponse.json({ error: 'centerId가 필요합니다.' }, { status: 400 });
    }

    try {
        await verifyCenterAdmin(centerId);

        const pending = await createBandOAuthState(centerId, session.user.id);
        const response = NextResponse.redirect(buildBandAuthorizationUrl());

        response.cookies.set(COOKIE_NAME, pending, {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            path: '/api/integrations/band',
            maxAge: 10 * 60,
        });

        return response;
    } catch {
        return NextResponse.redirect(
            new URL(`/centers/${centerId}/edit?band=connect-error`, request.url),
        );
    }
}
