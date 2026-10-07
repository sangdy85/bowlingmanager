export interface LaneAnnouncementParticipant {
    id: string;
    lane?: number | null;
    guestName?: string | null;
    guestTeamName?: string | null;
    user?: { name?: string | null } | null;
    team?: { name?: string | null } | null;
}

export function getLaneAnnouncement(participants: LaneAnnouncementParticipant[]) {
    // Deliberately project only the three public fields plus a stable rendering key.
    const rows = participants.map(p => ({
        id: p.id,
        name: p.guestName ?? p.user?.name ?? '이름 미등록',
        team: (p.guestTeamName ?? p.team?.name) || '개인',
        lane: Number.isInteger(p.lane) && p.lane! >= 11 ? p.lane! : null,
    }));
    return {
        assigned: rows.filter(p => p.lane !== null).sort((a, b) => a.lane! - b.lane!),
        unassigned: rows.filter(p => p.lane === null),
    };
}
