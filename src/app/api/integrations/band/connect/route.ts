import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { verifyCenterAdmin } from '@/lib/auth-utils';
import { buildBandAuthorizationUrl } from '@/lib/band/auth';

export async function GET(request: NextRequest) {
    const centerId = request.nextUrl.searchParams.get('centerId');
    const session = await auth();
    if (!session?.user?.id) return NextResponse.redirect(new URL('/login', request.url));
    if (!centerId) return NextResponse.json({ error: 'centerId가 필요합니다.' }, { status: 400 });

    try {
        await verifyCenterAdmin(centerId);
        return NextResponse.redirect(await buildBandAuthorizationUrl(centerId, session.user.id));
    } catch {
        return NextResponse.redirect(new URL(`/centers/${centerId}/edit?band=connect-error`, request.url));
    }
}
