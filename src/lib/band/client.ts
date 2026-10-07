import "server-only";

const BAND_AUTH_BASE = "https://auth.band.us";
const BAND_API_BASE = "https://openapi.band.us";

type BandApiEnvelope<T> = {
    result_code?: number;
    result_data?: T;
};

export type BandTokenResponse = {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
    user_key: string;
};

export type BandSummary = {
    band_key: string;
    name: string;
    cover?: string;
    member_count?: number;
};

function requireBandClientConfig() {
    const clientId = process.env.BAND_CLIENT_ID?.trim();
    const clientSecret = process.env.BAND_CLIENT_SECRET?.trim();
    const redirectUri = process.env.BAND_REDIRECT_URI?.trim();

    if (!clientId || !clientSecret || !redirectUri) {
        throw new Error("BAND OAuth environment variables are not configured.");
    }

    return {
        clientId,
        clientSecret,
        redirectUri,
    };
}

async function readJson<T>(response: Response): Promise<T> {
    const text = await response.text();

    let payload: unknown;
    try {
        payload = text ? JSON.parse(text) : null;
    } catch {
        throw new Error(`BAND returned invalid JSON (HTTP ${response.status}).`);
    }

    if (!response.ok) {
        const error = payload as {
            error?: string;
            error_description?: string;
            result_data?: { message?: string };
        };

        throw new Error(
            error.error_description
            || error.result_data?.message
            || error.error
            || `BAND request failed (HTTP ${response.status}).`,
        );
    }

    return payload as T;
}

function assertBandSuccess<T>(payload: BandApiEnvelope<T>): T {
    if (payload.result_code !== 1 || !payload.result_data) {
        throw new Error("BAND API returned an unsuccessful result.");
    }

    return payload.result_data;
}

export function buildBandAuthorizationUrl(): string {
    const { clientId, redirectUri } = requireBandClientConfig();

    const url = new URL("/oauth2/authorize", BAND_AUTH_BASE);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    return url.toString();
}

export async function exchangeBandAuthorizationCode(
    code: string,
): Promise<BandTokenResponse> {
    const {
        clientId,
        clientSecret,
    } = requireBandClientConfig();

    const url = new URL("/oauth2/token", BAND_AUTH_BASE);
    url.searchParams.set("grant_type", "authorization_code");
    url.searchParams.set("code", code);

    const basic = Buffer.from(
        `${clientId}:${clientSecret}`,
        "utf8",
    ).toString("base64");

    const response = await fetch(url, {
        method: "GET",
        headers: {
            Authorization: `Basic ${basic}`,
            Accept: "application/json",
        },
        cache: "no-store",
    });

    return readJson<BandTokenResponse>(response);
}

export async function fetchBandProfile(accessToken: string) {
    const url = new URL("/v2/profile", BAND_API_BASE);
    url.searchParams.set("access_token", accessToken);

    const response = await fetch(url, {
        cache: "no-store",
        headers: { Accept: "application/json" },
    });

    const payload = await readJson<BandApiEnvelope<{
        user_key: string;
        name: string;
        profile_image_url?: string;
        is_app_member?: boolean;
        message_allowed?: boolean;
    }>>(response);

    return assertBandSuccess(payload);
}

export async function fetchJoinedBands(
    accessToken: string,
): Promise<BandSummary[]> {
    const url = new URL("/v2.1/bands", BAND_API_BASE);
    url.searchParams.set("access_token", accessToken);

    const response = await fetch(url, {
        cache: "no-store",
        headers: { Accept: "application/json" },
    });

    const payload = await readJson<BandApiEnvelope<{
        bands: BandSummary[];
    }>>(response);

    return assertBandSuccess(payload).bands || [];
}

export async function canWriteBandPost(
    accessToken: string,
    bandKey: string,
): Promise<boolean> {
    const url = new URL("/v2/band/permissions", BAND_API_BASE);
    url.searchParams.set("access_token", accessToken);
    url.searchParams.set("band_key", bandKey);
    url.searchParams.set("permissions", "posting");

    const response = await fetch(url, {
        cache: "no-store",
        headers: { Accept: "application/json" },
    });

    const payload = await readJson<BandApiEnvelope<{
        permission?: string[];
        permissions?: string[];
    }>>(response);

    const data = assertBandSuccess(payload);
    const permissions = data.permissions || data.permission || [];

    return permissions.includes("posting");
}

export async function createBandPost(input: {
    accessToken: string;
    bandKey: string;
    content: string;
    doPush?: boolean;
}) {
    const body = new URLSearchParams();
    body.set("access_token", input.accessToken);
    body.set("band_key", input.bandKey);
    body.set("content", input.content);
    body.set("do_push", input.doPush ? "true" : "false");

    const response = await fetch(
        `${BAND_API_BASE}/v2.2/band/post/create`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
                Accept: "application/json",
            },
            body,
            cache: "no-store",
        },
    );

    const payload = await readJson<BandApiEnvelope<{
        band_key: string;
        post_key: string;
    }>>(response);

    return assertBandSuccess(payload);
}

export function isBandConfigured(): boolean {
    try {
        requireBandClientConfig();

        const encryptionKey = process.env.BAND_TOKEN_ENCRYPTION_KEY?.trim();
        return Boolean(encryptionKey);
    } catch {
        return false;
    }
}
