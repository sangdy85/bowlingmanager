import type { GeminiParsedRow } from './scoreboard-ocr';
import { normalizeScoreAnnotation, normalizeNameAnnotation, isStandaloneHandicapAnnotation, isScoreboardNameHeader, isScoreboardSummaryLabel } from '@/lib/scoreboard-annotations';

export function parseScoreCell(raw: string): number | null {
    const text = normalizeScoreAnnotation(raw);
    const pair = /^(\d{1,3})\s*[/／]\s*(\d{1,3})$/.exec(text);
    if (pair) {
        const values = pair.slice(1).map(Number);
        return values.every(value => value <= 300) ? Math.max(...values) : null;
    }
    const single = /^(\d{1,3})$/.exec(text);
    return single && Number(single[1]) <= 300 ? Number(single[1]) : null;
}

// A missing column can shift every following game. Keep positions unresolved rather than guessing.
export function parseScoreboardText(text: string, knownMembers: string[], expectedGameCount = 0): GeminiParsedRow[] {
    if (typeof text !== 'string' || text.length > 200_000) throw new Error('인식 결과의 크기를 확인해주세요.');
    const headers = [...text.slice(0, 8000).matchAll(/(?:^|[\s|])(\d{1,2})\s*[Gg](?=$|[\s|])/g)].map(match => Number(match[1]));
    const gameCount = expectedGameCount || Math.max(0, ...headers);
    if (!Number.isInteger(gameCount) || gameCount < 1 || gameCount > 12) {
        throw new Error('게임 수를 읽지 못했습니다. 게임 수를 선택한 뒤 다시 분석해주세요. 같은 사진의 인식 결과는 10분 동안 재사용됩니다.');
    }
    const roster = new Map<string, string[]>();
    for (const name of knownMembers) {
        const key = name.replace(/\s/g, '');
        roster.set(key, [...(roster.get(key) || []), name]);
    }
    const rows: GeminiParsedRow[] = [];
    let gameColumns: number[] | undefined;
    let headerWidth = 0;
    let headerNameColumn = -1;
    for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || /^#|^[\s|:\-]+$/.test(line)) continue;
        const tableCells = splitTableCells(line);
        if (tableCells) {
            const labels = tableCells.map(value => /^(\d{1,2})\s*[Gg]$/.exec(value)).filter(value => value !== null);
            const columns = Array.from({ length: gameCount }, (_, index) => tableCells.findIndex(value => new RegExp(`^${index + 1}\\s*[Gg]$`).test(value)));
            if (labels.length === gameCount && columns.every(index => index >= 0) && new Set(columns).size === gameCount) {
                gameColumns = columns;
                headerWidth = tableCells.length;
                headerNameColumn = tableCells.findIndex(isScoreboardNameHeader);
                continue;
            }
            if (labels.length) { gameColumns = undefined; headerWidth = 0; headerNameColumn = -1; continue; }
        }
        // A Korean lane marker and annotations such as SA must never determine the name/game offsets.
        const headerMapped = gameColumns && tableCells?.length === headerWidth && headerNameColumn >= 0 && headerNameColumn < Math.min(...gameColumns);
        if (!headerMapped && /(?:^|[|\t\s])(레인|핸디|성명|이름|합계|평균)(?:$|[|\t\s])/.test(line)) continue;
        let fallbackNameColumn = -1;
        if (!headerMapped && tableCells) {
            const candidates = tableCells.map((value,index) => ({index,name:(roster.has(value.replace(/\s/g,'')) ? value : normalizeNameAnnotation(value)).replace(/\s/g,'')}))
                .filter(item => /^[가-힣]{2,6}$/.test(item.name) && !isScoreboardSummaryLabel(item.name) && !isScoreboardNameHeader(item.name));
            const known = candidates.filter(item => roster.has(item.name));
            if (known.length === 1) fallbackNameColumn = known[0].index;
            else if (candidates.length === 1) fallbackNameColumn = candidates[0].index;
        }
        const sourceName = headerMapped && tableCells ? tableCells[headerNameColumn] : fallbackNameColumn >= 0 && tableCells ? tableCells[fallbackNameColumn] : line;
        const nameText = roster.has(sourceName.replace(/\s/g,'')) ? sourceName : normalizeNameAnnotation(sourceName);
        const name = /[가-힣]+(?:[ \t]+[가-힣]+)*/.exec(nameText);
        if (!name) continue;
        const compactName = name[0].replace(/\s/g, '');
        const tail = headerMapped ? '' : fallbackNameColumn >= 0 && tableCells ? tableCells.slice(fallbackNameColumn+1).join('\t') : nameText.slice(name.index + name[0].length).replace(/^ +/, '');
        if (compactName.length < 2 || compactName.length > 6 || (!headerMapped && !/\d/.test(tail))) continue;
        if (isScoreboardSummaryLabel(compactName) || isScoreboardNameHeader(compactName)) continue;
        let cells: string[];
        const nameColumn = fallbackNameColumn >= 0 ? fallbackNameColumn : tableCells?.findIndex(value => value.replace(/\s/g, '') === compactName) ?? -1;
        const mapped = headerMapped || (gameColumns && tableCells?.length === headerWidth && nameColumn >= 0 && nameColumn < Math.min(...gameColumns));
        if (mapped && gameColumns && tableCells) {
            // Explicit game headers let us exclude lane/handicap/total columns, including an empty total.
            cells = gameColumns.map(index => tableCells[index]);
        } else if (fallbackNameColumn >= 0 && tableCells) cells = tableCells.slice(fallbackNameColumn+1);
        else if (tail.includes('|')) cells = tail.replace(/^\|/, '').split('|').map(value => value.trim());
        else if (tail.includes('\t')) cells = tail.replace(/^\t/, '').split('\t').map(value => value.trim());
        else cells = tail.trim().split(/\s+/);
        // OCR table formats add a closing delimiter; internal empty cells remain in place.
        if (!mapped && fallbackNameColumn < 0 && cells.at(-1) === '') cells.pop();
        // Only remove an unmistakable leading handicap when all expected game positions remain.
        if (!mapped && cells.length === gameCount+1 && isStandaloneHandicapAnnotation(cells[0])) cells.shift();
        const warnings: string[] = [];
        let scoreSlots: (number | null)[];
        if (cells.length !== gameCount) {
            scoreSlots = Array(gameCount).fill(null);
            warnings.push(`점수 칸 수가 다릅니다. 게임 위치를 원본과 대조해주세요. 읽은 값: ${cells.join(' / ')}`);
        } else {
            scoreSlots = cells.map(parseScoreCell);
            // A handicap belongs to the player, not the game. Inconsistent pairs often mean lost digits.
            const pairs = cells.map(value => /^(\d{1,3})\s*[/／]\s*(\d{1,3})$/.exec(normalizeScoreAnnotation(value)));
            const differences = pairs.map(pair => pair && pair.slice(1).every(value => Number(value) <= 300) ? Math.abs(Number(pair[1]) - Number(pair[2])) : null);
            const frequencies = new Map<number, number>();
            for (const difference of differences) if (difference !== null) frequencies.set(difference, (frequencies.get(difference) || 0) + 1);
            const ranked = [...frequencies].sort((a, b) => b[1] - a[1]);
            if (ranked.length > 1) {
                const consistent = ranked[0][1] >= 2 && ranked[0][1] > ranked[1][1] ? ranked[0][0] : null;
                differences.forEach((difference, index) => {
                    if (difference !== null && (consistent === null || difference !== consistent)) {
                        scoreSlots[index] = null;
                        warnings.push(`${index + 1}게임: 핸디 전후 점수 차이가 다른 게임과 다릅니다. '${cells[index]}'를 원본에서 확인해주세요.`);
                    }
                });
            }
            scoreSlots.forEach((value, index) => {
                if (value !== null && value > 0 && value < 100 && scoreSlots.filter((other, otherIndex) => otherIndex !== index && other !== null && other >= 150).length >= 2) {
                    scoreSlots[index] = null;
                    warnings.push(`${index + 1}게임: '${cells[index]}'는 자릿수가 빠졌을 수 있습니다. 원본에서 확인해주세요. 낮은 점수가 맞으면 그대로 입력할 수 있습니다.`);
                }
            });
            if (scoreSlots.includes(null)) warnings.push(`빈칸은 직접 확인해주세요. 읽은 값: ${cells.join(' / ')}`);
        }
        const matches = roster.get(compactName) || [];
        if (matches.length > 1) warnings.push('동명이인이 있어 회원을 자동으로 지정하지 않았습니다.');
        rows.push({
            memberName: matches.length === 1 ? matches[0] : compactName,
            scores: scoreSlots.every((value): value is number => value !== null) ? scoreSlots : [],
            scoreSlots,
            reviewWarnings: warnings,
        });
    }
    if (!rows.length) throw new Error('점수 행을 읽지 못했습니다. 점수판 영역을 잘라 다시 올려주세요.');
    if (rows.length > 50) throw new Error('한 번에 50명까지 분석할 수 있습니다. 사진을 나눠주세요.');
    return rows;
}

function splitTableCells(line: string): string[] | undefined {
    if (line.includes('|')) {
        const cells = line.split('|').map(value => value.trim());
        if (line.startsWith('|')) cells.shift();
        if (line.endsWith('|')) cells.pop();
        return cells;
    }
    return line.includes('\t') ? line.split('\t').map(value => value.trim()) : undefined;
}
