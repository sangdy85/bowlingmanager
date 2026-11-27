// Cancellation belongs to the round entry, not the first registration in a
// multi-round tournament. Keep the deadline independent of the server timezone.
export function unpaidRoundEntryDeadline(createdAt: Date): Date | null {
    const value = new Date(createdAt);
    if (!Number.isFinite(value.getTime())) return null;
    const kst = new Date(value.getTime() + 9 * 60 * 60 * 1000);
    return new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() + 4) - 9 * 60 * 60 * 1000 - 1);
}

export function canAutoCancelUnpaidRound(round: {
    date: Date | null;
    tournament: { startDate: Date; leagueTime: string | null; status: string };
    _count: { individualScores: number; rawScores: number };
}, now: Date): boolean {
    // Even zero-valued imported scores are evidence of an operated round.
    if (round._count.individualScores > 0 || round._count.rawScores > 0 ||
        ['FINISHED', 'CANCELED'].includes(round.tournament.status)) return false;
    const start = new Date(round.date || round.tournament.startDate);
    if (!Number.isFinite(start.getTime())) return false;
    // Never change an entry after the round's calendar day has begun (KST).
    // This conservative boundary also protects rounds with an unknown start time.
    const kst = new Date(start.getTime() + 9 * 60 * 60 * 1000);
    const startOfDay = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()) - 9 * 60 * 60 * 1000;
    return now.getTime() < startOfDay;
}
