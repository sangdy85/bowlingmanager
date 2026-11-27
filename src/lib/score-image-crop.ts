export type ScoreImageCrop = { x: number; y: number; width: number; height: number };

export function parseScoreImageCrop(value: unknown): ScoreImageCrop | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    let parsed: unknown = value;
    if (typeof value === 'string') {
        if (value.length > 500) throw new Error('사진 영역을 다시 선택해주세요.');
        try { parsed = JSON.parse(value); } catch { throw new Error('사진 영역을 다시 선택해주세요.'); }
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('사진 영역을 다시 선택해주세요.');
    const { x, y, width, height } = parsed as Record<string, unknown>;
    if (![x, y, width, height].every(v => typeof v === 'number' && Number.isFinite(v))) throw new Error('사진 영역을 다시 선택해주세요.');
    const crop = { x, y, width, height } as ScoreImageCrop;
    if (crop.x < 0 || crop.y < 0 || crop.width <= 0 || crop.height <= 0 || crop.x + crop.width > 1 || crop.y + crop.height > 1) throw new Error('사진 영역을 다시 선택해주세요.');
    return crop;
}
