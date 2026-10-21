import type { BandSummary } from './types';
import { bandExternalPostingAllowed, BAND_POSTING_DISABLED_MESSAGE } from './outbound-policy';

const BAND_API_ORIGIN = 'https://openapi.band.us';

export class BandApiError extends Error {
    constructor(
        message: string,
        public readonly code: string,
        public readonly status: number,
    ) {
        super(message);
        this.name = 'BandApiError';
    }
}

export function bandErrorMessage(error: unknown): string {
    if (error instanceof BandApiError) {
        if (error.code === 'EXTERNAL_POSTING_DISABLED') return BAND_POSTING_DISABLED_MESSAGE;
        if (error.code === '60400' || error.status === 403) {
            return 'BAND 게시 권한이 없습니다. 밴드의 글쓰기 권한 설정을 확인해주세요.';
        }
        if (error.code === '10401' || error.code === 'invalid_token' || error.status === 401) {
            return 'BAND 연결 인증이 만료되었습니다. BAND를 다시 연결해주세요.';
        }
    }
    return 'NAVER BAND 요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.';
}

async function readBandResponse(response: Response): Promise<any> {
    let body: any = null;
    try {
        body = await response.json();
    } catch {
        throw new BandApiError('Invalid BAND response.', 'INVALID_RESPONSE', response.status);
    }

    if (!response.ok || body?.result_code !== 1) {
        const rawCode = body?.result_data?.error_code ?? body?.result_code ?? response.status;
        throw new BandApiError('BAND API request failed.', String(rawCode), response.status);
    }
    return body.result_data;
}

export async function getBands(accessToken: string): Promise<BandSummary[]> {
    if (process.env.APP_ENV === 'band-staging') {
        throw new BandApiError(BAND_POSTING_DISABLED_MESSAGE, 'EXTERNAL_POSTING_DISABLED', 409);
    }
    const url = new URL('/v2.1/bands', BAND_API_ORIGIN);
    url.searchParams.set('access_token', accessToken);
    const data = await readBandResponse(await fetch(url, { cache: 'no-store' }));
    return (Array.isArray(data?.bands) ? data.bands : []).map((band: any) => ({
        bandKey: String(band.band_key),
        name: String(band.name || ''),
        cover: band.cover ? String(band.cover) : null,
        memberCount: Number.isFinite(Number(band.member_count)) ? Number(band.member_count) : null,
    }));
}

export async function getPermissions(accessToken: string, bandKey: string): Promise<string[]> {
    if (process.env.APP_ENV === 'band-staging') {
        throw new BandApiError(BAND_POSTING_DISABLED_MESSAGE, 'EXTERNAL_POSTING_DISABLED', 409);
    }
    const url = new URL('/v2/band/permissions', BAND_API_ORIGIN);
    url.searchParams.set('access_token', accessToken);
    url.searchParams.set('band_key', bandKey);
    url.searchParams.set('permissions', 'posting');
    const data = await readBandResponse(await fetch(url, { cache: 'no-store' }));
    const permissions = data?.permissions ?? data?.permission;
    return Array.isArray(permissions) ? permissions.map(String) : [];
}

export async function createPost(input: {
    accessToken: string;
    bandKey: string;
    content: string;
    doPush?: boolean;
}): Promise<{ bandKey: string; postKey: string }> {
    if (!bandExternalPostingAllowed()) {
        throw new BandApiError(BAND_POSTING_DISABLED_MESSAGE, 'EXTERNAL_POSTING_DISABLED', 409);
    }
    const body = new URLSearchParams({
        access_token: input.accessToken,
        band_key: input.bandKey,
        content: input.content,
        do_push: input.doPush ? 'true' : 'false',
    });
    const data = await readBandResponse(await fetch(`${BAND_API_ORIGIN}/v2.2/band/post/create`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body,
        cache: 'no-store',
    }));
    return { bandKey: String(data.band_key), postKey: String(data.post_key) };
}
