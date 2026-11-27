import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { canonicalHostRedirectUrl } from '@/lib/public-web';

export function middleware(request: NextRequest) {
    const destination = canonicalHostRedirectUrl(request.url, {
        requestHostname: request.nextUrl.hostname,
        host: request.headers.get('host'),
        forwardedHost: request.headers.get('x-forwarded-host'),
    });
    if (destination) {
        return NextResponse.redirect(destination, 308);
    }
    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
