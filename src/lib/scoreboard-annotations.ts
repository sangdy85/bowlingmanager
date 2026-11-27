// Normalize full-width ASCII only. NFKC would turn a circled digit into a score digit.
function normalizeMarks(value: string) {
    return value.replace(/[！-～]/g, char => String.fromCharCode(char.charCodeAt(0)-0xfee0))
        .replace(/[Ⓐⓐ⒜🄰🅰]\uFE0F?/gu, '(A)').trim();
}

const asciiFlag = '(?:S\\s*[./·ㆍ]?\\s*A\\.?|ALL\\s*COVER|A|[○◯◎]|[€ĐđT])';
const koreanFlag = '(?:올\\s*커\\s*버(?:\\s*달\\s*성)?|사\\s*이\\s*드)';
const flag = `(?:${asciiFlag}|${koreanFlag})`;
const wrap = (mark: string) => `(?:\\(\\s*${mark}\\s*\\)|\\[\\s*${mark}\\s*\\]|\\{\\s*${mark}\\s*\\}|${mark})`;
const wrappedFlag = wrap(flag);
const handicapLabel = '(?:핸\\s*디(?:\\s*캡)?|HANDICAP|HDCP|HCP|HD)';
const namedHandicap = `${handicapLabel}\\s*[:：]?\\s*[+−-]?\\s*\\d{1,3}(?:\\s*점)?`;
const parenthesizedHandicap = `(?:\\(\\s*(?:${namedHandicap}|[+−-]\\s*\\d{1,3}(?:\\s*점)?)\\s*\\)|\\[\\s*(?:${namedHandicap}|[+−-]\\s*\\d{1,3}(?:\\s*점)?)\\s*\\])`;
const annotation = `(?:${wrappedFlag}|${parenthesizedHandicap}|${namedHandicap})`;
const leadingAnnotation = new RegExp(`^${annotation}\\s*`, 'iu');
const trailingAnnotation = new RegExp(`\\s*${annotation}$`, 'iu');
const standaloneHandicap = new RegExp(`^(?:${namedHandicap}|${parenthesizedHandicap}|\\+\\s*\\d{1,3}(?:\\s*점)?)$`, 'iu');
const bareHandicap = '(?:\\+\\s*\\d{1,3}(?:\\s*점)?)';
const lane = '(?:레인|LANE)\\s*[:：]?\\s*(?:\\d{1,2}\\s*[A-Z]?|[A-Z]\\s*\\d{0,2}|[가-힣])';
const nameRules = [annotation,`(?:${wrap(asciiFlag)}|${parenthesizedHandicap}|${namedHandicap})`].map(mark => ({
    prefix:new RegExp(`^(?:${mark}|${bareHandicap}|${lane})\\s*`, 'iu'),
    suffix:new RegExp(`\\s*(?:${mark}|${bareHandicap}|${lane})$`, 'iu'),
}));

/** Remove only known annotations at the edges. Digits/letters inside a number are never joined. */
export function normalizeScoreAnnotation(value: string): string {
    let text = normalizeMarks(value);
    for (let i=0;i<16;i++) {
        const next = text.replace(leadingAnnotation,'').replace(trailingAnnotation,'').trim();
        if (next === text) break;
        text = next;
    }
    return text;
}

export function isStandaloneHandicapAnnotation(value: string) {
    const text = normalizeMarks(value);
    return standaloneHandicap.test(text);
}

export function normalizeNameAnnotation(value: string, preserveKorean = false): string {
    let text = normalizeMarks(value);
    // A name cannot contain a handicap amount. Keep this broader rule out of score cells.
    const {prefix,suffix} = nameRules[preserveKorean ? 1 : 0];
    for (let i=0;i<16;i++) {
        const next = text.replace(prefix,'').replace(suffix,'').trim();
        if (next === text) break;
        text = next;
    }
    return text;
}

export function isScoreboardNameHeader(value: string) {
    return /^(이름|성명|성함|선수명|회원명)$/.test(value.replace(/\s/g,''));
}

export function isScoreboardSummaryLabel(value: string) {
    return /^(합계|총계|소계|평균|총점|TOTAL|AVERAGE|AVG)$/i.test(value.replace(/\s/g,''));
}
