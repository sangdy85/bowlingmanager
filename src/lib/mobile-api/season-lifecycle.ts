export const SEASON_LIFECYCLE_STATUSES = ["UPCOMING", "ACTIVE", "ENDED"] as const;
export type SeasonLifecycleStatus = typeof SEASON_LIFECYCLE_STATUSES[number];
export type SeasonDateRange = { startDate: Date; endDate: Date; status: string };

export function seasonYearRange(year: number) {
    return {
        start: new Date(`${year}-01-01T00:00:00.000+09:00`),
        end: new Date(`${year}-12-31T23:59:59.999+09:00`),
    };
}

export function seasonLifecycleStatus(season: SeasonDateRange, now = new Date()): SeasonLifecycleStatus {
    if (season.status === "COMPLETED" || now > season.endDate) return "ENDED";
    if (now < season.startDate) return "UPCOMING";
    return "ACTIVE";
}

export function seasonOverlapsYear(season: Pick<SeasonDateRange, "startDate" | "endDate">, year: number) {
    const { start, end } = seasonYearRange(year);
    return season.startDate <= end && season.endDate >= start;
}

export function isCurrentSeason(season: SeasonDateRange, now = new Date()) {
    return seasonLifecycleStatus(season, now) === "ACTIVE";
}
