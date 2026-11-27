export function normalizeTeamEventGuestName(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const name = value.trim();
    return name && name.length <= 40 ? name : null;
}
