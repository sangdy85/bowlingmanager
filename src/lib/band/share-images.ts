import type { BandShareTable } from './share-table';

export type BandShareImage = { name: string; dataUrl: string };

// Layout only: announcement scores/rankings still come from the server builder.
export function wrapAnnouncementLines(text: string, measure: (value: string) => number, maxWidth: number): string[] {
    return text.replace(/\r\n?/g, '\n').split('\n').flatMap(paragraph => {
        const lines: string[] = [];
        let line = '';
        for (const character of Array.from(paragraph)) {
            if (line && measure(line + character) > maxWidth) { lines.push(line); line = ''; }
            line += character;
        }
        lines.push(line);
        return lines;
    });
}

export async function createAnnouncementImages(text: string, table?: BandShareTable): Promise<BandShareImage[]> {
    if (table) return createShareTableImages(table);
    if (document.fonts) await document.fonts.ready;
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('이미지 생성을 지원하지 않는 브라우저입니다.');
    context.font = '24px sans-serif';
    const lines = wrapAnnouncementLines(text, value => context.measureText(value).width, 1072);
    const perPage = 38;
    const pageCount = Math.ceil(lines.length / perPage);
    return Array.from({ length: pageCount }, (_, page) => {
        const pageLines = lines.slice(page * perPage, (page + 1) * perPage);
        canvas.height = Math.max(400, 220 + pageLines.length * 38);
        context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = '#10283e'; context.fillRect(0, 0, canvas.width, 106);
        context.font = 'bold 30px sans-serif'; context.fillStyle = '#ffffff';
        context.fillText(`BAND 공지 · ${page + 1}/${pageCount}`, 64, 65);
        context.font = '24px sans-serif'; context.fillStyle = '#10283e';
        pageLines.forEach((line, index) => context.fillText(line, 64, 158 + index * 38));
        context.font = '18px sans-serif'; context.fillStyle = '#64748b';
        context.fillText('BowlingManager · 관리자가 확인한 공유 문구', 64, canvas.height - 28);
        return { name: `볼링매니저_공지_${page + 1}.png`, dataUrl: canvas.toDataURL('image/png') };
    });
}

export function splitShareTablePages(table: BandShareTable) {
    if (!table.rows.length || table.columns.length < 2 || table.rows.some(row => row.cells.length !== table.columns.length)) throw Error('표 내용을 확인해주세요.');
    const perPage = table.twoColumns ? 54 : 27;
    if (table.rows.length > perPage * 20) throw Error('사진 20개를 넘는 명단입니다. 회차를 나눠 준비해주세요.');
    return Array.from({ length: Math.ceil(table.rows.length / perPage) }, (_, i) => table.rows.slice(i * perPage, (i + 1) * perPage));
}

export async function createShareTableImages(table: BandShareTable): Promise<BandShareImage[]> {
    if (document.fonts) await document.fonts.ready;
    const pages = splitShareTablePages(table);
    const count = table.twoColumns ? 2 : 1;
    const baseWidth = table.columns.reduce((sum, col) => sum + col.width, 0);
    const width = Math.max(1240, baseWidth * count);
    const cellScale = width / count / baseWidth;
    const widths = table.columns.map(col => col.width * cellScale);
    const labels = { PARTICIPANTS: 'PARTICIPANTS', LANE_ASSIGNMENT: 'LANE ASSIGNMENT', FINAL_RESULT: 'FINAL RESULT' };
    return pages.map((rows, pageIndex) => {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) throw Error('표 이미지 생성을 지원하지 않는 브라우저입니다.');
        const font = (bold = false) => `${bold ? 'bold' : 'normal'} 18px Arial, "Malgun Gothic", sans-serif`;
        const groups = count === 2 ? [rows.slice(0, 27), rows.slice(27)] : [rows];
        const rowCount = table.kind === 'FINAL_RESULT' ? 27 : Math.min(27, rows.length);
        const wrapped = groups.map(group => group.map(row => row.cells.map((cell, col) => {
            context.font = font(table.columns[col].bold);
            return wrapAnnouncementLines(cell, value => context.measureText(value).width, widths[col] - 12);
        })));
        const heights = Array.from({ length: rowCount }, (_, i) => Math.max(36,
            ...wrapped.map(group => Math.max(1, ...(group[i] || []).map(lines => lines.length)) * 23 + 10)));
        context.font = 'bold 28px Arial, "Malgun Gothic", sans-serif';
        const titleLines = wrapAnnouncementLines(table.title, value => context.measureText(value).width, width - 64);
        const titleHeight = 66 + titleLines.length * 34;
        const height = titleHeight + 44 + heights.reduce((sum, h) => sum + h, 0) + 38;
        const ratio = Math.min(2, 8192 / width, 8192 / height);
        if (ratio < 1) throw Error('표가 너무 큽니다. 긴 이름이나 대회명을 확인해주세요.');
        canvas.width = Math.ceil(width * ratio); canvas.height = Math.ceil(height * ratio);
        context.scale(ratio, ratio);
        context.fillStyle = '#ffffff'; context.fillRect(0, 0, width, height);
        const gradient = context.createLinearGradient(0, 0, width, titleHeight);
        gradient.addColorStop(0, '#eff6ff'); gradient.addColorStop(1, '#dbeafe');
        context.fillStyle = gradient; context.fillRect(0, 0, width, titleHeight);
        context.textAlign = 'center'; context.textBaseline = 'middle';
        context.fillStyle = '#1d4ed8'; context.font = 'bold 16px Arial, sans-serif';
        context.fillText(labels[table.kind], width / 2, 25);
        context.fillStyle = '#0f172a'; context.font = 'bold 28px Arial, "Malgun Gothic", sans-serif';
        titleLines.forEach((line, i) => context.fillText(line, width / 2, 60 + i * 34));
        const cell = (x: number, y: number, w: number, h: number, lines: string[], background: string, bold: boolean, red = false) => {
            context.fillStyle = background; context.fillRect(x, y, w, h);
            context.strokeStyle = '#000000'; context.lineWidth = 1; context.strokeRect(x + 0.5, y + 0.5, w, h);
            context.font = font(bold); context.fillStyle = red ? '#ef4444' : '#000000';
            lines.forEach((line, i) => context.fillText(line, x + w / 2, y + h / 2 + (i - (lines.length - 1) / 2) * 23));
        };
        groups.forEach((group, groupIndex) => {
            let x = groupIndex * width / count;
            table.columns.forEach((col, i) => { cell(x, titleHeight, widths[i], 44, [col.label], '#E7E9EB', true); x += widths[i]; });
            let y = titleHeight + 44;
            heights.forEach((h, i) => {
                x = groupIndex * width / count;
                const row = group[i];
                table.columns.forEach((col, j) => {
                    const emptyRank = table.kind === 'FINAL_RESULT' && j === 0 ? [String(pageIndex * 27 * count + groupIndex * 27 + i + 1)] : [''];
                    cell(x, y, widths[j], h, wrapped[groupIndex][i]?.[j] || emptyRank, row?.highlight ? '#FFFF00' : '#ffffff', Boolean(col.bold), row?.redColumns?.includes(j));
                    x += widths[j];
                });
                y += h;
            });
        });
        context.font = '14px Arial, "Malgun Gothic", sans-serif'; context.fillStyle = '#475569';
        context.fillText(`BowlingManager · ${table.rows.length}${table.rowUnit || '명'} · ${pageIndex + 1}/${pages.length}`, width / 2, height - 17);
        const safeTitle = table.title.replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').slice(0, 110);
        return { name: `${safeTitle}_${pageIndex + 1}.png`, dataUrl: canvas.toDataURL('image/png') };
    });
}

export function saveBandShareImage(image: BandShareImage) {
    const link = document.createElement('a');
    link.href = image.dataUrl; link.download = image.name; link.click();
}

export function bandShareImageFiles(images: BandShareImage[]): File[] {
    return images.map(image => {
        if (!image.dataUrl.startsWith('data:image/png;base64,')) throw new Error('PNG 형식만 공유할 수 있습니다.');
        const bytes = Uint8Array.from(atob(image.dataUrl.split(',')[1]), char => char.charCodeAt(0));
        return new File([bytes], image.name, { type: 'image/png' });
    });
}

export function canShareBandImages(files: File[], text: string, target: Pick<Navigator, 'canShare' | 'share'> = navigator): boolean {
    if (!files.length || typeof target.share !== 'function' || typeof target.canShare !== 'function') return false;
    try { return target.canShare({ files, text }); } catch { return false; }
}
