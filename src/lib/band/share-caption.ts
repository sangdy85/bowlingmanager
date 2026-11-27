import type { BandPostType } from './types';

export type BandShareDefaults = { aboveImageText: string; belowImageText: string };
export const BAND_SHARE_TEXT_LIMIT = 2000;
export const BAND_SHARE_SITE_NOTICE = '경기 결과는 아래 홈페이지에서도 확인 가능합니다!\nhttps://bowlingmanager.co.kr/';

function captionDate(value: Date | string): string {
    const parts = new Intl.DateTimeFormat('ko-KR', {
        timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
    }).formatToParts(new Date(value));
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)!.value;
    return `${part('year')}.${part('month')}.${part('day')} (${part('weekday')})`;
}

export function readBandShareDefaults(raw: string | null | undefined): BandShareDefaults {
    try {
        const value = JSON.parse(raw || '{}')?.bandOfficialShare;
        return {
            aboveImageText: typeof value?.aboveImageText === 'string' ? value.aboveImageText : '',
            belowImageText: typeof value?.belowImageText === 'string' ? value.belowImageText : '',
        };
    } catch { return { aboveImageText: '', belowImageText: '' }; }
}

export function buildBandShareCaption(name: string, round: number | null, type: BandPostType, defaults: BandShareDefaults,
    dates: { eventDate: Date | string; now: Date }) {
    const labels: Record<BandPostType, string> = {
        RECRUITMENT: '모집 안내', PARTICIPANTS: '참가자 명단', LANE_ASSIGNMENT: '레인 배정',
        FINAL_RESULT: '최종 결과', LEAGUE_WEEKLY_RESULT: '공식 결과표 4종',
    };
    const scope = round ? `${round}${type === 'LEAGUE_WEEKLY_RESULT' ? '주차' : '회차'}` : '';
    const heading = [name, [scope, labels[type]].filter(Boolean).join(' · ')].join('\n');
    const date = captionDate(type === 'LEAGUE_WEEKLY_RESULT' || type === 'FINAL_RESULT' ? dates.eventDate : dates.now);
    return {
        shareText: [heading, `📅 ${date}`, BAND_SHARE_SITE_NOTICE, defaults.aboveImageText.trim()].filter(Boolean).join('\n\n'),
        belowImageText: defaults.belowImageText.trim(),
    };
}

export function combineBandShareText(above: string, below: string): string {
    return [above.trim(), below.trim()].filter(Boolean).join('\n\n');
}
