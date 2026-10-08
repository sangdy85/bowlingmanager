'use client';

import BandPublishControl from './BandPublishControl';

export type LeagueWeeklyBandPost = {
    roundId: string | null;
    type: string;
    status: string;
    revision: number;
    createdAt: string;
    postedAt: string | null;
    errorMessage: string | null;
};

export default function LeagueWeeklyBandButton({
    centerId,
    tournamentId,
    roundId,
    connected,
    latestPost,
}: {
    centerId: string;
    tournamentId: string;
    roundId: string;
    connected: boolean;
    latestPost?: LeagueWeeklyBandPost;
}) {
    return <div style={{
        width: '100%',
        maxWidth: '300px',
        padding: '12px',
        border: '1px solid #bfdbfe',
        borderRadius: '12px',
        background: '#eff6ff',
        display: 'grid',
        gap: '8px',
        textAlign: 'center',
    }}>
        <BandPublishControl
            centerId={centerId}
            tournamentId={tournamentId}
            roundId={roundId}
            type="LEAGUE_WEEKLY_RESULT"
            connected={connected}
            buttonLabel={latestPost ? '📢 BAND 주차 결과 다시 게시 · 미리보기' : '📢 BAND 주차 결과 미리보기'}
        />
        {!connected && <small style={{ color: '#475569' }}>볼링장 설정에서 BAND를 먼저 연결해주세요.</small>}
        {latestPost && (
            <small style={{ color: latestPost.status === 'FAILED' ? '#b91c1c' : '#334155' }}>
                게시 이력: {latestPost.status} · v{latestPost.revision}
                {latestPost.errorMessage ? ` · ${latestPost.errorMessage}` : ''}
            </small>
        )}
    </div>;
}
