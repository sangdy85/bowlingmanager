import { analyzeWithFreeGemini, type FreeGeminiResult } from '@/lib/gemini-free-scoreboard';
import { analyzeWithOcrSpace } from '@/lib/ocr-space-scoreboard';
import type { ScoreboardImageInput, ScoreboardOcrResult } from './scoreboard-ocr';

type Dependencies = {
    gemini: (input: ScoreboardImageInput) => Promise<FreeGeminiResult>;
    ocr: (input: ScoreboardImageInput) => Promise<ScoreboardOcrResult>;
};

// Shared server policy for both web actions and native clients. Old engine fields
// cannot bypass priority or usage reservations. Successful partial results remain reviewable.
export function createScoreboardProviderCascade(deps: Dependencies = { gemini: analyzeWithFreeGemini, ocr: analyzeWithOcrSpace }) {
    return async (input: ScoreboardImageInput): Promise<ScoreboardOcrResult> => {
        const bounded = { ...input, deadlineAt: Math.min(input.deadlineAt ?? Infinity, Date.now() + 80_000) };
        const gemini = await deps.gemini(bounded);
        if (gemini.success || !gemini.fallbackAllowed) {
            const { fallbackAllowed: _fallback, ...result } = gemini;
            return { ...result, provider: 'gemini-free' };
        }
        if (bounded.deadlineAt - Date.now() < 2000) return { success: false, provider: 'gemini-free', errorType: 'GENERAL', message: '사진 분석 시간이 초과되었습니다. 다시 시도해주세요.' };
        const precise = await deps.ocr({ ...bounded, engine: 3 });
        if (precise.success || precise.errorType !== 'QUOTA' || precise.quotaScope === 'MEMBER') return { ...precise, provider: 'ocr-space-3' };
        if (bounded.deadlineAt - Date.now() < 2000) return { ...precise, provider: 'ocr-space-3' };
        const basic = await deps.ocr({ ...bounded, engine: 2 });
        return { ...basic, provider: 'ocr-space-2' };
    };
}

export const analyzeWithProviderCascade = createScoreboardProviderCascade();
