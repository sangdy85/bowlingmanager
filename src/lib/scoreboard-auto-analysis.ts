import type { GeminiParsedRow, ScoreboardOcrResult } from './scoreboard-ocr';
import type { ScoreImageCrop } from './score-image-crop';

export function scoreRecognitionCoverage(rows: GeminiParsedRow[], expectedGameCount = 0) {
    const width = expectedGameCount || Math.max(0, ...rows.map(row => (row.scoreSlots ?? row.scores).length));
    const total = width * rows.length;
    const valid = rows.reduce((sum, row) => sum + Array.from({ length: width }, (_, index) => (row.scoreSlots ?? row.scores)[index])
        .filter(value => Number.isInteger(value) && value !== null && value >= 0 && value <= 300).length, 0);
    return { valid, total, ratio: total ? valid / total : 0 };
}

function partial(result: ScoreboardOcrResult) {
    return !!result.message?.includes('일부만 인식') || !!result.data?.some(row => row.reviewWarnings?.some(warning => warning.includes('일부만 인식')));
}

// This measures readable, validated slots, not OCR accuracy or undetected/missing players.
export async function analyzeScoreboardAutomatically(
    request: (engine: 2 | 3, crop?: ScoreImageCrop) => Promise<ScoreboardOcrResult>,
    options: { expectedGameCount?: number; preciseOnly?: boolean; forcePrecision?: boolean; isCurrent?: () => boolean; onPrecision?: () => void; knownMembers?: string[] } = {},
) {
    const engine = options.preciseOnly ? 3 : 2;
    const first = await request(engine);
    const initialCoverage = scoreRecognitionCoverage(first.data ?? [], options.expectedGameCount);
    const output = (result: ScoreboardOcrResult, usedEngine: 2 | 3, precisionAttempted: boolean, precisionIssue?: string) => ({
        result, engine: usedEngine, coverage: scoreRecognitionCoverage(result.data ?? [], options.expectedGameCount),
        initialCoverage, precisionAttempted, precisionIssue, suggestedCrop:first.suggestedCrop,
    });
    // The shared server already chose Gemini -> 3 -> 2. Do not run the legacy
    // 80% policy again, including on errors, partial results and manual retries.
    if (first.provider) return output(first, first.provider === 'ocr-space-3' ? 3 : 2, false);
    // Quota, configuration, network and invalid-file failures must not spend another provider request.
    const unreadable = !first.success && first.errorType !== 'QUOTA' && /게임 수를 읽지 못|점수 행을 읽지 못/.test(first.message ?? '');
    const belowThreshold = initialCoverage.valid * 100 < initialCoverage.total * 80 || !initialCoverage.total;
    if (engine === 3 || options.isCurrent?.() === false || (!unreadable && (!first.success || (!options.forcePrecision && !belowThreshold && !partial(first))))) {
        return output(first, engine, false);
    }
    options.onPrecision?.();
    let precise: ScoreboardOcrResult;
    try { precise = await request(3, first.suggestedCrop); }
    catch { precise = { success: false, errorType: 'GENERAL', message: '정밀 분석에 연결하지 못했습니다.' }; }
    if (!precise.success || !precise.data?.length) {
        if (first.success && first.data?.length) return output(first, 2, true, precise.message || '정밀 분석을 완료하지 못했습니다.');
        return output(precise, 3, true);
    }
    const preciseCoverage = scoreRecognitionCoverage(precise.data, options.expectedGameCount);
    // Keep whole rows from one result. Never merge names/game positions across engines.
    if (first.success && first.data?.length && (precise.data.length < first.data.length || (!partial(first) && partial(precise)) || (!partial(first) && preciseCoverage.ratio < initialCoverage.ratio))) {
        return output(first, 2, true, '정밀 분석에서 선수나 점수 칸이 더 누락되어 기본 결과를 유지했습니다.');
    }
    const roster = options.knownMembers ?? [];
    const uniqueMember = (name: string) => roster.filter(member => member.replace(/\s/g,'') === name.replace(/\s/g,'')).length === 1;
    const namesUsed = new Set(precise.data.filter(row => uniqueMember(row.memberName)).map(row => row.memberName.replace(/\s/g,'')));
    const reconciled = precise.data.map(row => {
        if (uniqueMember(row.memberName)) return row;
        const slots = row.scoreSlots ?? row.scores;
        const candidates = (first.data ?? []).filter(basic => {
            if (!uniqueMember(basic.memberName) || namesUsed.has(basic.memberName.replace(/\s/g,''))) return false;
            const other = basic.scoreSlots ?? basic.scores;
            if (other.length !== slots.length) return false;
            let agreements = 0;
            for (let i=0;i<slots.length;i++) if (slots[i] != null && other[i] != null) {
                if (slots[i] !== other[i]) return false;
                agreements++;
            }
            return agreements >= 3;
        });
        if (candidates.length !== 1) return row;
        const memberName = candidates[0].memberName;
        namesUsed.add(memberName.replace(/\s/g,''));
        return { ...row, memberName, reviewWarnings:[...(row.reviewWarnings ?? []), `이름 확인: '${row.memberName}'는 기본 분석의 '${memberName}'와 3게임 이상 점수가 일치해 보완했습니다. 원본에서 이름을 확인해주세요.`] };
    });
    return output({ ...precise, data:reconciled }, 3, true);
}
