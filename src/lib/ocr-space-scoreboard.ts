import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { OcrSpaceError, ocrUsageBuckets, readOcrSpaceConfig, type OcrSpaceConfig } from '@/lib/ocr-space-limits';
import { reserveScoreboardProviderUsage, ScoreboardMemberQuotaError } from '@/lib/scoreboard-member-quota';
import { parseScoreboardText } from '@/lib/scoreboard-text';
import { parseScoreImageCrop, type ScoreImageCrop } from '@/lib/score-image-crop';
import { readScoreboardLayout } from '@/lib/scoreboard-layout';
import type { ScoreboardOcrResult } from './scoreboard-ocr';

type Input = { userId: string; image: Buffer; mimeType: string; knownMembers: string[]; engine?: 2 | 3; expectedGameCount?: number; crop?: ScoreImageCrop; forceRefresh?: boolean; deadlineAt?: number };
type RawResult = { text: string; partial: boolean; layoutText?: string; suggestedCrop?: ScoreImageCrop };

export async function prepareOcrImage(image: Buffer, mimeType: string, cropInput?: ScoreImageCrop) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType) || !image.length || image.length > 10 * 1024 * 1024) {
        throw new OcrSpaceError('JPEG, PNG, WebP 사진을 10MB 이하로 올려주세요.');
    }
    try {
        const metadata = await sharp(image, { limitInputPixels: 40_000_000 }).metadata();
        if (!['jpeg', 'png', 'webp'].includes(metadata.format || '') || (metadata.pages || 1) > 1) throw new Error();
        const crop = parseScoreImageCrop(cropInput);
        const pipeline = sharp(image, { limitInputPixels: 40_000_000 }).rotate().flatten({ background: '#ffffff' });
        if (crop) {
            const swapped = [5, 6, 7, 8].includes(metadata.orientation || 1);
            const width = (swapped ? metadata.height : metadata.width)!;
            const height = (swapped ? metadata.width : metadata.height)!;
            const left = Math.floor(crop.x * width), top = Math.floor(crop.y * height);
            const right = Math.min(width, Math.ceil((crop.x + crop.width) * width));
            const bottom = Math.min(height, Math.ceil((crop.y + crop.height) * height));
            if (right - left < 64 || bottom - top < 64) throw new OcrSpaceError('선택한 사진 영역이 너무 작습니다. 이름과 점수 열을 함께 포함해주세요.');
            pipeline.extract({ left, top, width: right - left, height: bottom - top });
        }
        if (!crop && image.length <= 1_000_000 && metadata.format !== 'webp' && (!metadata.orientation || metadata.orientation === 1)) {
            // Decode once to reject truncated files before reserving a request.
            await sharp(image, { limitInputPixels: 40_000_000 }).stats();
            return { bytes: image, mimeType: metadata.format === 'png' ? 'image/png' : 'image/jpeg' };
        }
        for (const size of crop ? [4000, 3600, 3200, 3000, 2500, 2000, 1600] : [3000, 2500, 2000, 1600]) {
            for (const quality of crop ? [92, 84, 76] : [92, 84]) {
                const bytes = await pipeline.clone()
                    .resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true }).jpeg({ quality, ...(crop ? { chromaSubsampling: '4:4:4' as const } : {}) }).toBuffer();
                if (bytes.length <= 1_000_000) return { bytes, mimeType: 'image/jpeg' };
            }
        }
        throw new OcrSpaceError('사진을 1MB 이하로 줄일 수 없습니다. 점수판 부분을 잘라 올려주세요.');
    } catch (error) {
        if (error instanceof OcrSpaceError) throw error;
        throw new OcrSpaceError('사진을 읽지 못했습니다. 손상되지 않은 점수판 사진을 올려주세요.');
    }
}

export async function requestOcrSpace(apiKey: string, engine: 2 | 3, image: { bytes: Buffer; mimeType: string }, timeoutMs = 70_000): Promise<RawResult> {
    const form = new FormData();
    form.set('file', new Blob([new Uint8Array(image.bytes)], { type: image.mimeType }), image.mimeType === 'image/png' ? 'score.png' : 'score.jpg');
    for (const [key, value] of Object.entries({ OCREngine: String(engine), language: 'auto', isTable: 'true', detectOrientation: 'true', isOverlayRequired: engine === 2 ? 'true' : 'false' })) form.set(key, value);
    let response: Response;
    try {
        response = await fetch('https://api.ocr.space/parse/image', {
            method: 'POST', headers: { apikey: apiKey }, body: form,
            signal: AbortSignal.timeout(Math.max(1, Math.min(70_000, Math.floor(timeoutMs)))), redirect: 'error',
        });
    } catch {
        throw new OcrSpaceError('OCR 서버에 연결하지 못했거나 시간이 초과되었습니다. 자동 재시도는 하지 않았습니다.');
    }
    let payload: Record<string, unknown>;
    try { payload = await response.json(); } catch { throw new OcrSpaceError('OCR 서버 응답을 읽지 못했습니다.'); }
    // Inspect known provider codes, but never return raw upstream messages (which can contain credentials).
    const errorText = JSON.stringify([payload.error, payload.ErrorMessage, payload.ErrorDetails]);
    if (response.status === 429 || /E213|E216|E217|rate limit|maximum.*request|quota/i.test(errorText)) {
        throw new OcrSpaceError('OCR 제공 업체의 무료 사용 한도에 도달했습니다. 잠시 후 또는 다음 이용 기간에 시도해주세요.', 'QUOTA');
    }
    if (/E550|E572|invalid.*api.?key/i.test(errorText)) throw new OcrSpaceError('OCR.space API 키 설정을 확인해주세요.');
    if (!response.ok || payload.IsErroredOnProcessing === true || ![1, 2].includes(Number(payload.OCRExitCode))) {
        throw new OcrSpaceError('OCR 서버가 사진을 처리하지 못했습니다. 사진 크기와 상태를 확인해주세요.');
    }
    const pages = Array.isArray(payload.ParsedResults) ? payload.ParsedResults : [];
    const text = pages.map(page => typeof page?.ParsedText === 'string' ? page.ParsedText : '').join('\n');
    if (!text.trim()) throw new OcrSpaceError('사진에서 글자를 찾지 못했습니다. 점수판이 선명한 사진을 올려주세요.');
    let layout;
    if (engine === 2 && pages.some(page => Array.isArray(page?.TextOverlay?.Lines) && page.TextOverlay.Lines.length)) {
        const metadata = await sharp(image.bytes, { limitInputPixels: 40_000_000 }).metadata();
        layout = readScoreboardLayout(pages, metadata.width ?? 0, metadata.height ?? 0);
    }
    return { text, partial: Number(payload.OCRExitCode) === 2 || pages.some(page => Number(page?.FileParseExitCode) !== 1) || !!layout?.partial,
        ...(layout ? { layoutText: layout.text, suggestedCrop: layout.suggestedCrop } : {}) };
}

type Dependencies = {
    config: () => OcrSpaceConfig;
    reserve: (config: OcrSpaceConfig, userId: string, engine: 2 | 3) => Promise<void>;
    prepare: typeof prepareOcrImage;
    request: typeof requestOcrSpace;
};
const defaults: Dependencies = {
    config: readOcrSpaceConfig,
    reserve: async (config, userId, engine) => {
        await reserveScoreboardProviderUsage(userId, ocrUsageBuckets(config, userId, engine));
    },
    prepare: prepareOcrImage, request: requestOcrSpace,
};

// Only successful raw text is cached; images/keys are never persisted. Reparse against the current roster.
export function createOcrSpaceAnalyzer(deps: Dependencies = defaults) {
    const cache = new Map<string, { expires: number; raw: RawResult }>();
    const pending = new Map<string, Promise<RawResult>>();
    const active = { 2: 0, 3: 0 };
    return async (input: Input): Promise<ScoreboardOcrResult> => {
        try {
            if (!input.userId) throw new OcrSpaceError('로그인이 필요합니다.');
            if (input.deadlineAt !== undefined && !Number.isFinite(input.deadlineAt)) throw new OcrSpaceError('사진 분석 요청 시간을 확인해주세요.');
            const engine = input.engine ?? 2;
            const crop = parseScoreImageCrop(input.crop);
            if (![2, 3].includes(engine) || !Number.isInteger(input.expectedGameCount ?? 0) || (input.expectedGameCount ?? 0) < 0 || (input.expectedGameCount ?? 0) > 12) throw new OcrSpaceError('분석 방식과 게임 수를 확인해주세요.');
            const config = deps.config();
            const key = createHash('sha256').update(JSON.stringify([input.userId, config.apiKey, engine, crop])).update(input.image).digest('hex');
            const now = Date.now();
            for (const [id, entry] of cache) if (entry.expires <= now) cache.delete(id);
            // Explicit retries make a new, quota-counted request. Concurrent clicks still share one request.
            let raw = input.forceRefresh || pending.has(key) ? undefined : cache.get(key)?.raw;
            if (!raw) {
                let task = pending.get(key);
                if (!task) {
                    if (active[engine] >= (engine === 2 ? 2 : 1)) throw new OcrSpaceError('다른 사진을 분석하고 있습니다. 잠시 후 다시 시도해주세요.');
                    active[engine]++;
                    task = (async () => {
                        const image = await deps.prepare(input.image, input.mimeType, crop);
                        if (input.deadlineAt !== undefined && input.deadlineAt - Date.now() < 2000) throw new OcrSpaceError('정밀 분석을 완료할 시간이 부족합니다. 기본 결과를 확인하거나 다시 분석해주세요.');
                        // Reserve durably BEFORE calling the provider. Failures remain counted; no automatic retries.
                        await deps.reserve(config, input.userId, engine);
                        const result = await deps.request(config.apiKey, engine, image, input.deadlineAt === undefined ? 70_000 : Math.max(1, input.deadlineAt - Date.now()));
                        if (cache.size >= 30) cache.delete(cache.keys().next().value!);
                        cache.set(key, { expires: Date.now() + 10 * 60_000, raw: result });
                        return result;
                    })().finally(() => { pending.delete(key); active[engine]--; });
                    pending.set(key, task);
                }
                raw = await task;
            }
            const data = parseScoreboardText(raw.layoutText ?? raw.text, input.knownMembers, input.expectedGameCount);
            const base = crop ?? { x:0, y:0, width:1, height:1 };
            const left = base.x+(raw.suggestedCrop?.x ?? 0)*base.width, top = base.y+(raw.suggestedCrop?.y ?? 0)*base.height;
            const suggestedCrop = raw.suggestedCrop ? parseScoreImageCrop({ x:left, y:top, width:Math.min(raw.suggestedCrop.width*base.width,base.x+base.width-left,1-left), height:Math.min(raw.suggestedCrop.height*base.height,base.y+base.height-top,1-top) }) : undefined;
            if (raw.partial) {
                // Missing output may include entire players. Explicitly flag every returned row.
                for (const row of data) row.reviewWarnings?.push('일부만 인식되었습니다. 누락된 선수와 점수를 원본에서 확인해주세요.');
            }
            return { success: true, data, suggestedCrop, message: raw.partial ? '일부만 인식되었습니다. 누락된 선수와 점수를 확인해주세요.' : '인식한 이름과 점수를 원본과 대조한 뒤 저장해주세요.' };
        } catch (error) {
            if (error instanceof ScoreboardMemberQuotaError) return { success: false, errorType: 'QUOTA', quotaScope: 'MEMBER', message: error.message };
            return { success: false, errorType: error instanceof OcrSpaceError ? error.errorType : 'GENERAL',
                message: error instanceof OcrSpaceError ? error.message : error instanceof Error && /게임 수|점수 행|50명|인식 결과|사진 영역/.test(error.message) ? error.message : 'OCR 분석을 시작하지 못했습니다. 서버 설정과 사용량 저장소를 확인해주세요.' };
        }
    };
}

export const analyzeWithOcrSpace = createOcrSpaceAnalyzer();
