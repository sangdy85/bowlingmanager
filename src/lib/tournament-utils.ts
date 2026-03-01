// Helper to combine a date string/object with a tournament's leagueTime (HH:mm).
// Ensures that the round's effective start time is consistently calculated.
export function getEffectiveRoundDate(
    roundDate: Date | null | string,
    leagueTime: string | null,
    tournamentType?: string // Added to distinguish EVENT type
): Date | null {
    if (!roundDate) return null;
    const date = new Date(roundDate);
    if (isNaN(date.getTime())) return null;

    // To check if it's midnight KST, we add 9 hours and use UTC methods
    const kst = new Date(date.getTime() + 9 * 60 * 60000);
    const h = kst.getUTCHours();
    const m = kst.getUTCMinutes();

    // If it's NOT exactly 00:00 KST, we respect the manually set time (EVENT/MANUAL)
    if (h !== 0 || m !== 0) {
        return date;
    }

    // For EVENT type, we ALWAYS respect the date field time even if it's 00:00.
    // We don't want leagueTime (which is for recurring leagues) to overwrite a specific event time.
    if (tournamentType === 'EVENT') {
        return date;
    }

    // If it IS exactly 00:00 KST, and we have a target leagueTime, apply it.
    if (leagueTime && leagueTime.includes(':')) {
        const [targetH, targetM] = leagueTime.split(':').map(Number);
        const y = kst.getUTCFullYear();
        const mm = String(kst.getUTCMonth() + 1).padStart(2, '0');
        const d = String(kst.getUTCDate()).padStart(2, '0');
        const hh = String(isNaN(targetH) ? 0 : targetH).padStart(2, '0');
        const min = String(isNaN(targetM) ? 0 : targetM).padStart(2, '0');
        return new Date(`${y}-${mm}-${d}T${hh}:${min}:00+09:00`);
    }

    // Otherwise, keep as is (KST 00:00)
    return date;
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

    const start = startDate ? (typeof startDate === 'string' ? new Date(startDate) : startDate) : null;
    const regStart = registrationStart ? (typeof registrationStart === 'string' ? new Date(registrationStart) : registrationStart) : null;

    // 1. FINISHED: After the legal end of the tournament (Next day 00:00 KST)
    const finishDate = endDate ? new Date(endDate) : start;
    if (finishDate && !isNaN(finishDate.getTime())) {
        const kstFinish = new Date(finishDate.getTime() + 9 * 60 * 60000);
        // Set to 00:00:00 of the NEXT day in KST
        const nextDayKST = new Date(Date.UTC(kstFinish.getUTCFullYear(), kstFinish.getUTCMonth(), kstFinish.getUTCDate() + 1));
        const nextDayUTC = new Date(nextDayKST.getTime() - 9 * 60 * 60000);

        if (now >= nextDayUTC) return 'FINISHED';
    }

    // 2. ONGOING: From scheduled time until FINISHED
    if (start && !isNaN(start.getTime()) && now >= start) return 'ONGOING';

    // 3. CLOSED: 30 minutes before startDate until startDate
    if (start && !isNaN(start.getTime())) {
        const closedThreshold = new Date(start.getTime() - 30 * 60000);
        if (now >= closedThreshold) return 'CLOSED';
    }

    // 4. OPEN: From registrationStart until CLOSED (30m before start)
    if (regStart && !isNaN(regStart.getTime()) && now >= regStart) return 'OPEN';

    // 5. UPCOMING: Before registrationStart
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
export function parseKSTDate(dateInput: string | Date | null): Date | null {
    if (!dateInput) return null;

    // Handle Date object directly
    if (dateInput instanceof Date) return dateInput;

    const dateString = String(dateInput);

    // Handle full ISO strings or strings with timezone already
    if (dateString.includes('Z') || (dateString.includes('+') && dateString.length > 19)) {
        return new Date(dateString);
    }

    let formatted = dateString;
    // If only YYYY-MM-DD
    if (dateString.length === 10) {
        formatted = `${dateString}T00:00`;
    } else if (dateString.length === 16) { // YYYY-MM-DDTHH:mm
        formatted = `${dateString}:00`; // Add seconds
    }
    // If it's already YYYY-MM-DDTHH:mm:ss, no change needed

    // Append +09:00 to ensure it's interpreted as KST
    const date = new Date(`${formatted}+09:00`);
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

/**
 * Formats a Date to "M월 D일 (요일)" in KST.
 */
export function formatKSTDayLabel(dateInput: Date | string | null): string {
    if (!dateInput) return '일정 미정';
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '일정 미정';

    const kst = new Date(date.getTime() + 9 * 60 * 60000);
    const m = kst.getUTCMonth() + 1;
    const d = kst.getUTCDate();
    const dayOfWeek = kst.getUTCDay();
    const weekDays = ['일', '월', '화', '수', '목', '금', '토'];

    return `${m}월 ${d}일 (${weekDays[dayOfWeek]})`;
}

/**
 * Formats a Date to "MM월 DD일" in KST.
 */
export function formatKSTMonthDay(dateInput: Date | string | null): string {
    if (!dateInput) return '날짜 미정';
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '날짜 미정';

    const kst = new Date(date.getTime() + 9 * 60 * 60000);
    const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
    const d = String(kst.getUTCDate()).padStart(2, '0');

    return `${m}월 ${d}일`;
}
