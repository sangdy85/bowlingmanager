export const BAND_NOT_CONFIGURED_MESSAGE = 'NAVER BAND 연동 준비 중입니다. 앱 승인과 운영 설정이 완료되면 연결·게시 기능을 사용할 수 있습니다.';

// Read only when requested on the server, so missing optional credentials do
// not prevent the app or unrelated routes from starting. Never return secrets.
export function isBandConfigured(): boolean {
    if (!['BAND_CLIENT_ID', 'BAND_CLIENT_SECRET', 'BAND_REDIRECT_URI']
        .every(name => Boolean(process.env[name]?.trim()))) return false;
    const key = process.env.BAND_TOKEN_ENCRYPTION_KEY?.trim();
    if (!key) return false;
    return (/^[0-9a-f]{64}$/i.test(key) ? Buffer.from(key, 'hex') : Buffer.from(key, 'base64')).length === 32;
}
