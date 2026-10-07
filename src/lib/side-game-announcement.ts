export type AnnouncementCategory = 'STANDARD' | 'BALL' | 'EXTRA';
export type AnnouncementGroup = { category: AnnouncementCategory; label: string; names: string[] };

// A read-only projection of the current selection. It never writes participation.
export function buildSideGameAnnouncementGroups(
    players: ReadonlyArray<{ regId: string; name: string }>,
    participation: Readonly<Record<string, ReadonlySet<AnnouncementCategory>>>,
    gameCount = 3,
): AnnouncementGroup[] {
    const categories: { category: AnnouncementCategory; label: string }[] = [
        { category: 'STANDARD', label: '기본 사이드' },
        { category: 'BALL', label: '볼사이드 (2G)' },
        { category: 'EXTRA', label: `번외 (${gameCount}G)` },
    ];
    return categories.map(group => ({ ...group, names: players.filter(player => participation[player.regId]?.has(group.category)).map(player => player.name) }));
}

export function formatSideGameAnnouncement(groups: readonly AnnouncementGroup[], roundNumber?: number): string {
    return [`[${roundNumber == null ? '' : `${roundNumber}회차 `}사이드 게임 명단]`, ...groups.map(group => `■ ${group.label} (${group.names.length}명)\n${group.names.length ? group.names.join('\n') : '참여자가 없습니다.'}`)].join('\n\n');
}
