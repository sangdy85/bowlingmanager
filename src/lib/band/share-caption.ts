import type { BandPostType } from './types';

export type BandShareDefaults = { aboveImageText: string; belowImageText: string };
export const BAND_SHARE_TEXT_LIMIT = 2000;

export function readBandShareDefaults(raw: string | null | undefined): BandShareDefaults {
    try {
        const value = JSON.parse(raw || '{}')?.bandOfficialShare;
        return {
            aboveImageText: typeof value?.aboveImageText === 'string' ? value.aboveImageText : '',
            belowImageText: typeof value?.belowImageText === 'string' ? value.belowImageText : '',
        };
    } catch { return { aboveImageText: '', belowImageText: '' }; }
}

export function buildBandShareCaption(name: string, round: number | null, type: BandPostType, defaults: BandShareDefaults) {
    const labels: Record<BandPostType, string> = {
        RECRUITMENT: '모집 안내', PARTICIPANTS: '참가자 명단', LANE_ASSIGNMENT: '레인 배정',
        FINAL_RESULT: '최종 결과', LEAGUE_WEEKLY_RESULT: '공식 결과표 4종',
    };
    const scope = round ? `${round}${type === 'LEAGUE_WEEKLY_RESULT' ? '주차' : '회차'}` : '';
    const heading = [name, [scope, labels[type]].filter(Boolean).join(' · ')].join('\n');
    return {
        shareText: [heading, defaults.aboveImageText.trim()].filter(Boolean).join('\n\n'),
        belowImageText: defaults.belowImageText.trim(),
    };
}

export function combineBandShareText(above: string, below: string): string {
    return [above.trim(), below.trim()].filter(Boolean).join('\n\n');
}
