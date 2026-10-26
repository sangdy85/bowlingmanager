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

export async function createAnnouncementImages(text: string): Promise<BandShareImage[]> {
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
