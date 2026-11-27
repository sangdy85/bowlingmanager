import type { ScoreImageCrop } from '@/lib/score-image-crop';
import { normalizeNameAnnotation, isStandaloneHandicapAnnotation, isScoreboardNameHeader } from '@/lib/scoreboard-annotations';

type Word = { text: string; x: number; y: number; width: number; height: number };
type Label = { text: string; x: number; y: number; height: number };
const median = (values: number[]) => { const sorted = [...values].sort((a,b) => a-b); return sorted[Math.floor(sorted.length / 2)] ?? 0; };

// Engine 2 provides character/word boxes. Use positions, rather than the provider's text-line ordering.
export function readScoreboardLayout(pages: unknown, imageWidth: number, imageHeight: number): { text: string; partial: boolean; suggestedCrop: ScoreImageCrop } | undefined {
    if (!Array.isArray(pages) || pages.length !== 1 || !Number.isFinite(imageWidth) || !Number.isFinite(imageHeight) || imageWidth <= 0 || imageHeight <= 0) return;
    if (Number((pages[0] as { TextOrientation?: unknown })?.TextOrientation ?? 0) !== 0) return;
    const lines = (pages[0] as { TextOverlay?: { Lines?: unknown } })?.TextOverlay?.Lines;
    if (!Array.isArray(lines) || lines.length > 5000) return;
    const words: Word[] = [], labels: Label[] = [];
    for (const line of lines) {
        if (!line || !Array.isArray(line.Words) || line.Words.length > 1000) return;
        const valid: Word[] = [];
        for (const raw of line.Words) {
            if (!raw || typeof raw.WordText !== 'string' || raw.WordText.length > 200) return;
            const { Left:x, Top:y, Width:width, Height:height } = raw;
            if (![x,y,width,height].every(value => typeof value === 'number' && Number.isFinite(value)) || x < 0 || y < 0 || width <= 0 || height <= 0 || x+width > imageWidth*1.05 || y+height > imageHeight*1.05) return;
            valid.push({ text: raw.WordText.trim(), x, y, width, height });
        }
        if (!valid.length) continue;
        if (words.length+valid.length > 20000) return;
        words.push(...valid);
        const left = Math.min(...valid.map(word => word.x)), right = Math.max(...valid.map(word => word.x+word.width));
        labels.push({ text: valid.map(word => word.text).join('').replace(/\s/g,''), x:(left+right)/2, y:median(valid.map(word => word.y)), height:median(valid.map(word => word.height)) });
    }
    if (words.length > 20000) return;
    const firsts = labels.filter(label => /^1[Gg]$/.test(label.text));
    // Multiple tables or ambiguous headers fall back to the conservative text parser.
    if (firsts.length !== 1) return;
    const first = firsts[0], headerTolerance = first.height * 1.3;
    const games = labels.filter(label => /^([1-9]|1[0-2])[Gg]$/.test(label.text) && Math.abs(label.y-first.y) < headerTolerance).sort((a,b) => a.x-b.x);
    if (!games.length || games.some((label,index) => Number(label.text.slice(0,-1)) !== index+1)) return;
    const headers = labels.filter(label => Math.abs(label.y-first.y) < headerTolerance);
    const names = headers.filter(label => isScoreboardNameHeader(label.text));
    if (names.length !== 1 || names[0].x >= first.x) return;
    const name = names[0], spacing = games.length > 1 ? median(games.slice(1).map((label,index) => label.x-games[index].x)) : (first.x-name.x)*0.8;
    if (spacing <= first.height*1.5 || games.some((label,index) => index && (label.x-games[index-1].x < spacing*0.55 || label.x-games[index-1].x > spacing*1.6))) return;
    const previousName = headers.filter(label => label.x < name.x).sort((a,b) => b.x-a.x)[0];
    const afterName = headers.filter(label => label.x > name.x).sort((a,b) => a.x-b.x)[0];
    const beforeGame = headers.filter(label => label.x < first.x).sort((a,b) => b.x-a.x)[0];
    const last = games[games.length-1], afterGame = headers.filter(label => label.x > last.x).sort((a,b) => a.x-b.x)[0];
    const nameLeft = previousName ? (previousName.x+name.x)/2 : Math.max(0,name.x-spacing/2);
    const nameRight = afterName ? (afterName.x+name.x)/2 : first.x-spacing/2;
    const gameLeft = beforeGame ? (beforeGame.x+first.x)/2 : first.x-spacing/2;
    const gameRight = Math.min(imageWidth, afterGame ? (afterGame.x+last.x)/2 : last.x+spacing/2);
    const boundaries = [gameLeft,...games.slice(1).map((label,index) => (label.x+games[index].x)/2),gameRight];
    const headerBottom = Math.max(...games.map(label => label.y+label.height),name.y+name.height);
    const body = words.filter(word => word.y > headerBottom && word.x+word.width/2 >= gameLeft && word.x+word.width/2 < gameRight && !isStandaloneHandicapAnnotation(word.text));
    const typicalHeight = median(body.filter(word => /\d/.test(word.text)).map(word => word.height));
    if (!typicalHeight) return;
    const numeric = body.filter(word => /\d/.test(word.text));
    const groups: Word[][] = [];
    for (const word of numeric.sort((a,b) => a.y-b.y)) {
        const group = groups.at(-1);
        if (group && word.y-group[0].y <= typicalHeight*0.6) group.push(word); else groups.push([word]);
    }
    if (!groups.length || groups.length > 50) return;
    const rowTops = groups.map(group => median(group.map(word => word.y)));
    const nearestRow = (word: Word) => {
        let index = 0;
        for (let i=1; i<rowTops.length; i++) if (Math.abs(word.y-rowTops[i]) < Math.abs(word.y-rowTops[index])) index=i;
        return Math.abs(word.y-rowTops[index]) <= typicalHeight*0.65 ? index : -1;
    };
    const nameWords = words.filter(word => word.y > headerBottom && word.x+word.width/2 >= nameLeft && word.x+word.width/2 < nameRight && word.height <= typicalHeight*1.8)
        .map(word => ({...word,text:normalizeNameAnnotation(word.text,true)})).filter(word => /^[가-힣\s]+$/.test(word.text));
    const output = [`이름\t${games.map(label => label.text.toUpperCase()).join('\t')}`];
    let partial = false;
    for (let index=0; index<groups.length; index++) {
        const letters = nameWords.filter(word => nearestRow(word) === index).sort((a,b) => a.x-b.x);
        const memberName = normalizeNameAnnotation(letters.map(word => word.text).join(''),true).replace(/\s/g,'');
        if (!/^[가-힣]{2,16}$/.test(memberName)) { partial = true; continue; }
        const cells = games.map((_,column) => body.filter(word => nearestRow(word) === index && word.x+word.width/2 >= boundaries[column] && word.x+word.width/2 < boundaries[column+1]).sort((a,b) => a.x-b.x).map(word => word.text).join(''));
        output.push(`${memberName}\t${cells.join('\t')}`);
    }
    if (output.length < 2) return;
    const top = Math.max(0,Math.min(first.y,name.y)-first.height*0.65);
    const bottom = Math.min(imageHeight,Math.max(...numeric.map(word => word.y+word.height))+typicalHeight*0.5);
    const crop = { x:nameLeft/imageWidth, y:top/imageHeight, width:(gameRight-nameLeft)/imageWidth, height:(bottom-top)/imageHeight };
    if (crop.width < 0.1 || crop.height < 0.03 || crop.x+crop.width > 1 || crop.y+crop.height > 1) return;
    return { text: output.join('\n'), partial, suggestedCrop:crop };
}
