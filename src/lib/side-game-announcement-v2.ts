export type AnnouncementCategory = 'STANDARD' | 'BALL' | 'EXTRA';

export type SideGameAnnouncementRow = {
    regId: string;
    name: string;
    standard: true;
    extra: boolean;
    ball: boolean;
};

export function buildSideGameAnnouncementRows(
    players: ReadonlyArray<{ regId: string; name: string }>,
    participation: Readonly<Record<string, ReadonlySet<AnnouncementCategory>>>,
): SideGameAnnouncementRow[] {
    return players
        .filter(player => participation[player.regId]?.has('STANDARD'))
        .map(player => ({
            regId: player.regId,
            name: player.name,
            standard: true,
            extra: participation[player.regId]?.has('EXTRA') || false,
            ball: participation[player.regId]?.has('BALL') || false,
        }));
}

export function splitSideGameAnnouncementRows(
    rows: readonly SideGameAnnouncementRow[],
): [SideGameAnnouncementRow[], SideGameAnnouncementRow[]] {
    const midpoint = Math.ceil(rows.length / 2);
    return [rows.slice(0, midpoint), rows.slice(midpoint)];
}

export function formatSideGameAnnouncement(
    rows: readonly SideGameAnnouncementRow[],
    roundNumber?: number,
): string {
    const [left, right] = splitSideGameAnnouncementRows(rows);
    const header = ['이름', '사이드', '번외', '볼사이드'];
    const lines = [
        `[${roundNumber == null ? '' : `${roundNumber}회차 `}사이드 게임 명단]`,
        [...header, '', ...header].join('\t'),
    ];

    const rowCount = Math.max(left.length, right.length);
    for (let index = 0; index < rowCount; index++) {
        const leftRow = left[index];
        const rightRow = right[index];
        const cells = [
            leftRow?.name || '',
            leftRow ? 'O' : '',
            leftRow?.extra ? 'O' : '',
            leftRow?.ball ? 'O' : '',
            '',
            rightRow?.name || '',
            rightRow ? 'O' : '',
            rightRow?.extra ? 'O' : '',
            rightRow?.ball ? 'O' : '',
        ];
        lines.push(cells.join('\t'));
    }

    return lines.join('\n');
}
