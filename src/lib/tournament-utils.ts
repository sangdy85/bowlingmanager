// Helper to combine a date string/object with a tournament's leagueTime (HH:mm).
// Ensures that the round's effective start time is consistently calculated.
export function getEffectiveRoundDate(roundDate: Date | null | string, leagueTime: string | null): Date | null {
    if (!roundDate) return null;
    const date = new Date(roundDate);
    if (isNaN(date.getTime())) return null;

    // Shift to KST for extraction
    const kst = new Date(date.getTime() + 9 * 60 * 60000);
    const yyyy = kst.getUTCFullYear();
    const mm = String(kst.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(kst.getUTCDate()).padStart(2, '0');

    if (!leagueTime) return new Date(`${yyyy}-${mm}-${dd}T00:00:00+09:00`);

    const [hours, minutes] = leagueTime.split(':').map(Number);
    const hh = String(isNaN(hours) ? 0 : hours).padStart(2, '0');
    const min = String(isNaN(minutes) ? 0 : minutes).padStart(2, '0');

    return new Date(`${yyyy}-${mm}-${dd}T${hh}:${min}:00+09:00`);
}

/**
 * Returns the day of the week (0-6) of a date in KST.
 */
export function getKSTDay(dateInput: Date | string | null): number {
    if (!dateInput) return 0;
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return 0;
    const kst = new Date(date.getTime() + 9 * 60 * 60000);
    return kst.getUTCDay();
}

/**
 * Returns the date string (YYYY-MM-DD) of a date in KST.
 */
export function getKSTDateString(dateInput: Date | string | null): string {
    if (!dateInput) return '';
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '';
    const kst = new Date(date.getTime() + 9 * 60 * 60000);
    return kst.toISOString().split('T')[0];
}

// Standard Status Types
export type TStatus = 'UPCOMING' | 'OPEN' | 'CLOSED' | 'ONGOING' | 'FINISHED';

/**
 * Standardizes tournament/round status calculation based on time and optional DB status.
 * @param startDate The main date of the event/round.
 * @param registrationStart The start of recruitment.
 * @param endDate Optional end date of the tournament.
 * @param dbStatus Optional status from the database (to respect manual closing).
 */
export function calculateTournamentStatus(
    startDate: Date | string | null,
    registrationStart: Date | string | null,
    endDate?: Date | string | null,
    dbStatus?: string,
    nowInput?: Date
): TStatus {
    const now = nowInput || new Date();

    // 0. Manual Finish / Planning Priority
    if (dbStatus === 'FINISHED') return 'FINISHED';

    // 1. Missing Start Date -> Always Upcoming (or "일정 미정")
    if (!startDate) return 'UPCOMING';
    const start = new Date(startDate);
    if (isNaN(start.getTime())) return 'UPCOMING';

    // 2. FINISHED: After the day of the tournament (Next day 00:00)
    // User requested: "대회일자가 딱 지났을 때" (Next day starts)
    const finishDate = endDate ? new Date(endDate) : new Date(start);
    const nextDayOfFinish = new Date(finishDate);
    nextDayOfFinish.setHours(0, 0, 0, 0);
    nextDayOfFinish.setDate(nextDayOfFinish.getDate() + 1);
    if (now >= nextDayOfFinish) return 'FINISHED';

    // 3. ONGOING: From scheduled time until FINISHED (midnight)
    // User requested: "대회 예정 시각(now > start)이 지나고 대회일 오후 11시 59분 사이"
    if (now >= start) return 'ONGOING';

    // 4. CLOSED: 30 minutes before startDate
    const closedThreshold = new Date(start.getTime() - 30 * 60000);
    if (now >= closedThreshold) return 'CLOSED';

    // 5. OPEN: From registrationStart until CLOSED
    const regStart = registrationStart ? new Date(registrationStart) : null;
    if (regStart && !isNaN(regStart.getTime()) && now >= regStart) return 'OPEN';

    // 6. UPCOMING: Before registrationStart or if regStart is missing
    return 'UPCOMING';
}

export const STATUS_LABELS: Record<TStatus, string> = {
    UPCOMING: '진행 예정',
    OPEN: '모집 중',
    CLOSED: '마감',
    ONGOING: '진행 중',
    FINISHED: '대회 종료'
};

// Helper to display encoded lane-slot value (Lane * 10 + Slot)
// 11 -> L1-1, 12 -> L1-2, 23 -> L2-3
export function formatLane(laneValue: number | null, isManual: boolean = false) {
    if (!laneValue || laneValue < 11) return '-';
    const lane = Math.floor(laneValue / 10);
    const slot = laneValue % 10;
    const prefix = isManual ? '(수동)' : '';
    return `${prefix}${lane}-${slot}`;
}

/**
 * Converts a Date or ISO string to a KST-indexed 'YYYY-MM-DDTHH:mm' string 
 * for use in <input type="datetime-local">.
 */
export function formatDateForInput(dateInput: Date | string | null): string {
    if (!dateInput) return '';
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '';

    // Convert to KST (UTC+9) string for datetime-local input
    // datetime-local doesn't support timezone offsets, so we manually shift 9 hours
    const kstDate = new Date(date.getTime() + 9 * 60 * 60000);
    return kstDate.toISOString().slice(0, 16);
}

/**
 * Parses a datetime-local input string (YYYY-MM-DDTHH:mm) or date input string (YYYY-MM-DD) as a KST Date (+09:00).
 */
export function parseKSTDate(dateString: string | null): Date | null {
    if (!dateString) return null;

    // If it's only YYYY-MM-DD (10 chars), append T00:00
    let formatted = dateString;
    if (dateString.length === 10) {
        formatted = `${dateString}T00:00`;
    }

    // Append +09:00 to ensure it's interpreted as KST
    const date = new Date(`${formatted}:00+09:00`);
    return isNaN(date.getTime()) ? null : date;
}

/**
 * Formats a Date or UTC string to a KST display string (YYYY. M. D. HH:mm)
 * ignoring the system's local timezone.
 */
export function formatKSTDate(dateInput: Date | string | null): string {
    if (!dateInput) return '일정 미정';
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '일정 미정';

    // Shift to KST (UTC+9)
    const kst = new Date(date.getTime() + 9 * 60 * 60000);

    const y = kst.getUTCFullYear();
    const m = kst.getUTCMonth() + 1;
    const d = kst.getUTCDate();
    const hh = String(kst.getUTCHours()).padStart(2, '0');
    const mm = String(kst.getUTCMinutes()).padStart(2, '0');

    return `${y}. ${m}. ${d}. ${hh}:${mm}`;
}
