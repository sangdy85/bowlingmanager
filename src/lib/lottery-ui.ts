export interface LotteryParticipant {
    registrationId: string;
    createdAt?: string | Date;
    registration: { guestName?: string | null; guestTeamName?: string | null; user?: { name?: string | null } | null; team?: { name?: string | null } | null; entryGroupId?: string | null };
}

export function participantName(participant: LotteryParticipant) {
    return participant.registration.guestName ?? participant.registration.user?.name ?? '이름 미등록';
}

export function getEligibleCandidates<T extends LotteryParticipant>(participants: T[], winnerIds: string[], excludedIds: string[], maxParticipants: number): T[] {
    const waiting = new Set(maxParticipants > 0 ? [...participants]
        .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime())
        .slice(maxParticipants).map(p => p.registrationId) : []);
    const blocked = new Set([...winnerIds, ...excludedIds, ...waiting]);
    const seen = new Set<string>();
    return participants.filter(p => {
        if (blocked.has(p.registrationId) || seen.has(p.registrationId)) return false;
        seen.add(p.registrationId);
        return true;
    });
}

// Equal-sized sectors start at 12 o'clock. Stop at the selected sector's centre.
export function getSpinRotation(index: number, count: number) {
    if (!Number.isInteger(count) || count < 1 || !Number.isInteger(index) || index < 0 || index >= count) throw new Error('Invalid wheel sector');
    return 5 * 360 + 360 - (index + 0.5) * 360 / count;
}

export function randomCandidateIndex(count: number) {
    if (!Number.isInteger(count) || count < 1 || count > 0xffffffff) throw new Error('Invalid pool size');
    const values = new Uint32Array(1);
    const limit = Math.floor(0x100000000 / count) * count;
    do { crypto.getRandomValues(values); } while (values[0] >= limit);
    return values[0] % count;
}
