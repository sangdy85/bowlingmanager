// This is an internal conservative safety cap, not a documented NAVER BAND API limit.
export const BAND_POST_MAX_UTF8_BYTES = 16000;

export function bandPostContentSize(content: string): number {
    return Buffer.byteLength(content, 'utf8');
}

export function bandPostContentIssue(content: string): string | null {
    const bytes = bandPostContentSize(content);
    if (!content.trim()) return '게시할 BAND 글 본문이 비어 있습니다.';
    if (bytes > BAND_POST_MAX_UTF8_BYTES) {
        return `BAND 글 본문이 내부 안전 기준(${BAND_POST_MAX_UTF8_BYTES.toLocaleString('ko-KR')} UTF-8 바이트)을 초과했습니다. 현재 ${bytes.toLocaleString('ko-KR')}바이트입니다. 전체 결과 링크를 활용하도록 내용을 줄인 뒤 다시 미리보기 해주세요.`;
    }
    return null;
}
