import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { verifyCenterAdmin } from '@/lib/auth-utils';
import { buildBandAuthorizationUrl, createBandOAuthState } from '@/lib/band/auth';
import { isBandConfigured } from '@/lib/band/config';
import { bandAppUrl } from '@/lib/band/redirect';

const COOKIE_NAME = 'bowling_band_oauth';

export async function GET(request: NextRequest) {
    const centerId = request.nextUrl.searchParams.get('centerId');
    const session = await auth();

    if (!session?.user?.id) {
        return NextResponse.redirect(bandAppUrl(request, '/login'));
    }
    if (!centerId?.trim()) {
        return NextResponse.json({ error: 'centerId가 필요합니다.' }, { status: 400 });
    }

    try {
        await verifyCenterAdmin(centerId);

        if (!isBandConfigured()) {
            return NextResponse.redirect(bandAppUrl(request, `/centers/${encodeURIComponent(centerId)}/edit?band=not-configured`));
        }

        const pending = await createBandOAuthState(centerId, session.user.id);
        const response = NextResponse.redirect(buildBandAuthorizationUrl(pending));

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
            bandAppUrl(request, `/centers/${encodeURIComponent(centerId)}/edit?band=connect-error`),
        );
    }
}
