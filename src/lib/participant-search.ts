type SearchableParticipant = {
    id: string;
    guestName?: string | null;
    guestTeamName?: string | null;
    user?: { name?: string | null } | null;
    team?: { name?: string | null } | null;
};

// Return IDs only: the table keeps its original order, numbering and waitlist boundary.
export function getParticipantSearchIds(participants: readonly SearchableParticipant[], query: string): Set<string> {
    const words = query.normalize('NFC').toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
    return new Set(participants.filter(participant => {
        const name = participant.guestName ?? participant.user?.name ?? '';
        const team = (participant.guestTeamName ?? participant.team?.name) || '개인';
        const text = `${name} ${team}`.normalize('NFC').toLocaleLowerCase();
        return words.every(word => text.includes(word));
    }).map(participant => participant.id));
}
