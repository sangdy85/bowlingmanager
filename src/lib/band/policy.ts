import type { BandPostType } from './types';

export function nextBandPostRevision(latestRevision?: number | null): number {
    return latestRevision ? latestRevision + 1 : 1;
}

export function bandPostDedupeKey(
    tournamentId: string,
    roundId: string | null | undefined,
    type: BandPostType,
    revision: number,
): string {
    const subject = roundId ? `ROUND:${roundId}` : `TOURNAMENT:${tournamentId}`;
    return `${subject}:${type}:${revision}`;
}
