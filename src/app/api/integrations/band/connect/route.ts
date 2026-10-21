import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { verifyCenterAdmin } from '@/lib/auth-utils';
import { buildBandAuthorizationUrl, createBandOAuthState } from '@/lib/band/auth';

const COOKIE_NAME = 'bowling_band_oauth';

export async function GET(request: NextRequest) {
    if (process.env.APP_ENV === 'band-staging') {
        return NextResponse.json({ error: '스테이징에서는 실제 BAND OAuth 연결을 사용할 수 없습니다.' }, { status: 403 });
    }
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
