export type CompetitionNoticeInput = {
    title: string; organizer: string; format: string;
    registrationStartDate: string; registrationEndDate: string;
    startDate: string; endDate: string; eventTime: string; venue: string;
    fee: string; description: string; rules: string;
    registrationUrl: string; relatedUrl: string; published: boolean;
};

export class CompetitionInputError extends Error {}

function text(input: unknown, label: string, max: number) {
    if (typeof input !== 'string' || !input.trim() || input.trim().length > max) {
        throw new CompetitionInputError(`${label}은(는) 1~${max.toLocaleString('ko-KR')}자로 입력해주세요.`);
    }
    return input.trim();
}

// Store date-only inputs at UTC midnight; display/calendar use their YYYY-MM-DD key.
export function noticeDateKey(date: Date) { return date.toISOString().slice(0, 10); }
export function todayInKorea(now = new Date()) {
    return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
function date(input: unknown, label: string) {
    if (typeof input !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input)) throw new CompetitionInputError(`${label}을(를) 입력해주세요.`);
    const value = new Date(`${input}T00:00:00Z`);
    if (!Number.isFinite(value.getTime()) || noticeDateKey(value) !== input || input < '1900-01-01' || input > '2200-12-31') throw new CompetitionInputError(`${label}이(가) 올바르지 않습니다.`);
    return value;
}
function url(input: unknown, label: string) {
    if (input === '' || input == null) return null;
    if (typeof input !== 'string' || input.length > 2048 || /[\x00-\x20\x7f\\]/.test(input.trim())) throw new CompetitionInputError(`${label} 주소를 확인해주세요.`);
    try {
        const value = new URL(input.trim());
        if (!['http:', 'https:'].includes(value.protocol) || value.username || value.password) throw new Error();
        return value.href;
    } catch { throw new CompetitionInputError(`${label}에는 http 또는 https 주소를 입력해주세요.`); }
}
export function validateCompetitionNotice(input: CompetitionNoticeInput) {
    if (!input || typeof input !== 'object') throw new CompetitionInputError('입력 내용을 확인해주세요.');
    const registrationStartDate = date(input.registrationStartDate, '접수 시작일');
    const registrationEndDate = date(input.registrationEndDate, '접수 마감일');
    const startDate = date(input.startDate, '대회 시작일');
    const endDate = date(input.endDate, '대회 종료일');
    if (registrationEndDate < registrationStartDate) throw new CompetitionInputError('접수 마감일은 시작일보다 빠를 수 없습니다.');
    if (endDate < startDate) throw new CompetitionInputError('대회 종료일은 시작일보다 빠를 수 없습니다.');
    if (registrationEndDate > endDate) throw new CompetitionInputError('접수 마감일은 대회 종료일 이후일 수 없습니다.');
    if (typeof input.published !== 'boolean') throw new CompetitionInputError('공개 여부를 확인해주세요.');
    return {
        title: text(input.title, '대회명', 120), organizer: text(input.organizer, '주관사', 100), format: text(input.format, '대회형식', 100),
        registrationStartDate, registrationEndDate, startDate, endDate,
        eventTime: text(input.eventTime, '시간', 120), venue: text(input.venue, '대회장소', 200), fee: text(input.fee, '참가비', 100),
        description: text(input.description, '대회 안내', 5000), rules: text(input.rules, '대회 요강', 10000),
        registrationUrl: url(input.registrationUrl, '접수 링크'), relatedUrl: url(input.relatedUrl, '관련 링크'), published: input.published,
    };
}
export function noticeDate(date: Date) {
    return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'UTC' }).format(date);
}
export function noticeDateRange(start: Date, end: Date) { return start.getTime() === end.getTime() ? noticeDate(start) : `${noticeDate(start)} ~ ${noticeDate(end)}`; }
export function noticePhase(notice: {registrationStartDate: Date; registrationEndDate: Date; startDate: Date; endDate: Date}, today = todayInKorea()) {
    if (noticeDateKey(notice.endDate) < today) return '종료';
    if (noticeDateKey(notice.startDate) <= today) return '대회 진행';
    if (noticeDateKey(notice.registrationStartDate) > today) return '접수 예정';
    if (noticeDateKey(notice.registrationEndDate) >= today) return '접수 기간';
    return '접수 마감';
}
export function calendarMonth(value: unknown, now = new Date()) {
    if (typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) && value >= '1900-01' && value <= '2200-12') return value;
    return todayInKorea(now).slice(0, 7);
}
export function monthOffset(month: string, offset: number) {
    const date = new Date(`${month}-01T00:00:00Z`); date.setUTCMonth(date.getUTCMonth() + offset);
    return noticeDateKey(date).slice(0, 7);
}
export function monthBounds(month: string) {
    return { start: new Date(`${month}-01T00:00:00Z`), end: new Date(new Date(`${monthOffset(month, 1)}-01T00:00:00Z`).getTime() - 86400000) };
}
export function calendarDays(month: string) {
    const { start, end } = monthBounds(month);
    const first = new Date(start.getTime() - start.getUTCDay() * 86400000);
    const length = Math.ceil((start.getUTCDay() + end.getUTCDate()) / 7) * 7;
    return Array.from({length}, (_, index) => new Date(first.getTime() + index * 86400000));
}
