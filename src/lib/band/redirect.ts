import type { NextRequest } from 'next/server';
import { CANONICAL_HOSTNAME, LEGACY_HOSTNAME, PUBLIC_ORIGIN } from '@/lib/public-web';

// Next's internal request URL may use localhost behind the production proxy.
// Only recognize our public hosts; never use an arbitrary forwarded origin.
export function bandAppUrl(request: NextRequest, pathname: string): URL {
    const publicRequest = [
        request.nextUrl.hostname,
        request.headers.get('host'),
        request.headers.get('x-forwarded-host'),
    ].some(value => {
        if (!value) return false;
        try {
            const hostname = new URL(`http://${value.split(',')[0].trim()}`).hostname;
            return hostname === CANONICAL_HOSTNAME || hostname === LEGACY_HOSTNAME;
        } catch {
            return false;
        }
    });

    const origin = process.env.NODE_ENV === 'production' && publicRequest
        ? PUBLIC_ORIGIN
        : request.url;
    return new URL(pathname, origin);
}
