export type ReviewedScoreRow = { memberName: string; scores: number[] };

export const REVIEWED_SCORE_MAX_BYTES = 1_000_000;
export function normalizeScoreMemberName(name: string) {
    return name.replace(/\s/g, "");
}

// The review tool exports an array, not the raw OCR comparison report.
// Member IDs in a file are deliberately ignored; the selected team's roster wins.
export function parseReviewedScoreImport(text: string, knownMembers: string[]): {
    rows: ReviewedScoreRow[];
    matchedCount: number;
    unmatchedNames: string[];
} {
    if (new TextEncoder().encode(text).byteLength > REVIEWED_SCORE_MAX_BYTES) {
        throw new Error("점수 파일은 1MB 이하여야 합니다.");
    }
    let value: unknown;
    try { value = JSON.parse(text.replace(/^\uFEFF/, "")); }
    catch { throw new Error("점수 JSON 파일 내용을 읽지 못했습니다."); }
    if (!Array.isArray(value) || value.length === 0 || value.length > 50) {
        throw new Error("검토 화면의 '확인한 점수 JSON 저장'으로 저장한 파일을 선택해주세요. 최대 50명까지 불러올 수 있습니다.");
    }
    const candidates = new Map<string, string[]>();
    for (const member of knownMembers) {
        const key = normalizeScoreMemberName(member);
        candidates.set(key, [...(candidates.get(key) || []), member]);
    }
    const seen = new Set<string>();
    const unmatchedNames: string[] = [];
    let matchedCount = 0;
    const rows = value.map((item: unknown, index): ReviewedScoreRow => {
        if (!item || typeof item !== "object") throw new Error(`${index + 1}행의 이름과 점수를 확인해주세요.`);
        const record = item as Record<string, unknown>;
        const name = typeof record.memberName === "string" ? record.memberName.trim() : "";
        if (!name || name.length > 100 || !Array.isArray(record.scores) || record.scores.length === 0 || record.scores.length > 12 ||
            record.scores.some(score => !Number.isInteger(score) || score < 0 || score > 300)) {
            throw new Error(`${index + 1}행의 이름과 점수를 확인해주세요. 점수는 빈칸 없이 0~300의 정수여야 합니다.`);
        }
        const key = normalizeScoreMemberName(name);
        if (seen.has(key)) throw new Error(`'${name}'의 점수가 중복되어 있습니다. 중복 행을 확인해주세요.`);
        seen.add(key);
        const matches = candidates.get(key) || [];
        if (matches.length > 1) throw new Error(`'${name}'과 같은 이름의 팀원이 여러 명입니다. 회원을 구분해 직접 입력해주세요.`);
        if (matches.length === 1) matchedCount++;
        else unmatchedNames.push(name);
        return { memberName: matches[0] || name, scores: [...record.scores] as number[] };
    });
    return { rows, matchedCount, unmatchedNames };
}
