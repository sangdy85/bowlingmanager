import type { BandPostType } from './types';

type ConnectionPolicy = {
    enabled: boolean;
    bandKey?: string | null;
    autoRecruitment: boolean;
    autoFinalResult: boolean;
};

export function bandAutoPublishSkipReason(connection: ConnectionPolicy | null, type: BandPostType): string | null {
    if (!connection?.enabled || !connection.bandKey) return '연결된 BAND가 없어 게시하지 않았습니다.';
    const enabled = type === 'FINAL_RESULT' || type === 'LEAGUE_WEEKLY_RESULT' ? connection.autoFinalResult : connection.autoRecruitment;
    return enabled ? null : '해당 BAND 자동 게시 설정이 꺼져 있습니다.';
}

export function nextBandPostRevision(latestRevision?: number | null): number {
    return latestRevision ? latestRevision + 1 : 1;
}

export function bandPostDedupeKey(tournamentId: string, roundId: string | null | undefined, type: BandPostType, revision: number): string {
    const subject = roundId ? `ROUND:${roundId}` : `TOURNAMENT:${tournamentId}`;
    return `${subject}:${type}:${revision}`;
}
