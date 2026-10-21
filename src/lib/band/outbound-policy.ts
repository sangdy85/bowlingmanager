// This gate is deliberately independent of the UI, OAuth state or BAND token.
// Live posting requires both an explicitly production environment and opt-in.
// In BAND staging, all outbound posting is disabled even with a connected demo BAND.
export function bandExternalPostingAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
    return env.APP_ENV === 'production' && env.BAND_EXTERNAL_POSTING_ENABLED === 'true';
}

export const BAND_POSTING_DISABLED_MESSAGE =
    '외부 BAND 게시가 비활성화된 환경입니다. 미리보기만 사용할 수 있습니다.';
