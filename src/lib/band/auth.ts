import { SignJWT, jwtVerify } from 'jose';
import { randomUUID } from 'node:crypto';

const BAND_AUTHORIZE_URL = 'https://auth.band.us/oauth2/authorize';
const BAND_TOKEN_URL = 'https://auth.band.us/oauth2/token';

function required(name: 'BAND_CLIENT_ID' | 'BAND_CLIENT_SECRET' | 'BAND_REDIRECT_URI'): string {
    const value = process.env[name]?.trim();
    if (!value) throw new Error(`${name} is not configured.`);
    return value;
}

function stateKey(): Uint8Array {
    return new TextEncoder().encode(required('BAND_CLIENT_SECRET'));
}

function isStateId(value: unknown): value is string {
    return typeof value === 'string' && value.length > 0 && value.trim() === value &&
        !/[\u0000-\u001f\u007f]/.test(value);
}

export async function createBandOAuthState(centerId: string, userId: string): Promise<string> {
    if (!isStateId(centerId) || !isStateId(userId)) throw new Error('Invalid BAND OAuth context.');
    return new SignJWT({ centerId, userId, nonce: randomUUID() })
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .setIssuedAt()
        .setExpirationTime('10m')
        .setIssuer('bowlingmanager')
        .setAudience('naver-band-oauth')
        .sign(stateKey());
}

export async function verifyBandOAuthState(state: string): Promise<{ centerId: string; userId: string }> {
    const { payload } = await jwtVerify(state, stateKey(), {
        issuer: 'bowlingmanager',
        audience: 'naver-band-oauth',
        algorithms: ['HS256'],
        requiredClaims: ['iat', 'exp'],
        maxTokenAge: '10m',
    });
    if (!isStateId(payload.centerId) || !isStateId(payload.userId) ||
        typeof payload.nonce !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.nonce) ||
        typeof payload.iat !== 'number' || typeof payload.exp !== 'number' ||
        !Number.isSafeInteger(payload.iat) || !Number.isSafeInteger(payload.exp) ||
        payload.exp <= payload.iat || payload.exp - payload.iat > 600) {
        throw new Error('Invalid BAND OAuth state.');
    }
    return { centerId: payload.centerId, userId: payload.userId };
}

export function buildBandAuthorizationUrl(state: string): string {
    if (!state) throw new Error('BAND OAuth state is required.');
    const url = new URL(BAND_AUTHORIZE_URL);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', required('BAND_CLIENT_ID'));
    url.searchParams.set('redirect_uri', required('BAND_REDIRECT_URI'));
    url.searchParams.set('state', state);
    return url.toString();
}

export async function exchangeBandAuthorizationCode(code: string): Promise<{
    accessToken: string;
    refreshToken: string | null;
    expiresIn: number | null;
    userKey: string | null;
}> {
    const clientId = required('BAND_CLIENT_ID');
    const clientSecret = required('BAND_CLIENT_SECRET');
    const url = new URL(BAND_TOKEN_URL);
    url.searchParams.set('grant_type', 'authorization_code');
    url.searchParams.set('code', code);

    const response = await fetch(url, {
        headers: { authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}` },
        cache: 'no-store',
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.access_token) throw new Error('BAND OAuth token exchange failed.');
    return {
        accessToken: String(body.access_token),
        refreshToken: body.refresh_token ? String(body.refresh_token) : null,
        expiresIn: Number.isFinite(Number(body.expires_in)) ? Number(body.expires_in) : null,
        userKey: body.user_key ? String(body.user_key) : null,
    };
}
