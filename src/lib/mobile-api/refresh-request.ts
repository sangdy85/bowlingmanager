type RefreshTokenBody = {
    refreshToken?: unknown;
};

export async function readRefreshToken(request: Request): Promise<string | null> {
    let body: unknown;

    try {
        body = await request.json();
    } catch {
        return null;
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) return null;

    const refreshToken = (body as RefreshTokenBody).refreshToken;
    return typeof refreshToken === "string" && refreshToken
        ? refreshToken
        : null;
}
