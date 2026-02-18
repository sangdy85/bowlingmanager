// Helper to combine a date string/object with a tournament's leagueTime (HH:mm).
// Ensures that the round's effective start time is consistently calculated.
export function getEffectiveRoundDate(roundDate: Date | string | null, leagueTime?: string) {
    if (!roundDate) return null;
    const d = new Date(roundDate);
    if (!leagueTime) return d;

    const [h, m] = leagueTime.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return d;

    const res = new Date(d);
    res.setHours(h, m, 0, 0);
    return res;
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
    dbStatus?: string
): TStatus {
    const now = new Date();

    // 0. Manual Finish: If DB status is FINISHED, respect it.
    if (dbStatus === 'FINISHED') return 'FINISHED';

    if (!startDate) return 'UPCOMING';

    const start = new Date(startDate);
    const regStart = registrationStart ? new Date(registrationStart) : null;

    // For individual rounds, we use the next day of the START date as FINISHED criteria.
    // However, if an explicit endDate exists (usually for EVENT/CUSTOM span), use that.
    const finishDate = endDate ? new Date(endDate) : new Date(start);
    const nextDayOfFinish = new Date(finishDate);
    nextDayOfFinish.setHours(0, 0, 0, 0);
    nextDayOfFinish.setDate(nextDayOfFinish.getDate() + 1);

    // 1. FINISHED: After 00:00 of the day after the tournament (or endDate)
    if (now >= nextDayOfFinish) return 'FINISHED';

    // 2. ONGOING: From startDate until FINISHED (midnight)
    if (now >= start) return 'ONGOING';

    // 3. CLOSED: 30 minutes before startDate
    const closedThreshold = new Date(start.getTime() - 30 * 60000);
    if (now >= closedThreshold) return 'CLOSED';

    // 4. OPEN: From registrationStart until CLOSED
    if (regStart && now >= regStart) return 'OPEN';
    if (!regStart) return 'OPEN'; // Fallback

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
