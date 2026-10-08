'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { publishBandPostAction } from '@/app/actions/band-actions';

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
    const router = useRouter();
    const [busy, setBusy] = useState(false);
    const [feedback, setFeedback] = useState('');

    return (
        <div style={{
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
            <button
                type="button"
                disabled={!connected || busy}
                onClick={async () => {
                    const confirmed = window.confirm(
                        '선택한 주차의 팀 순위표, 개인 순위표, 경기 결과, 개인 평균 TOP을 BAND에 게시하시겠습니까?'
                    );
                    if (!confirmed) return;
                    setBusy(true);
                    setFeedback('');
                    try {
                        const response = await publishBandPostAction({
                            centerId,
                            tournamentId,
                            roundId,
                            type: 'LEAGUE_WEEKLY_RESULT',
                        });
                        setFeedback(response.message);
                        if (response.success) router.refresh();
                    } catch {
                        setFeedback('BAND 게시 요청에 실패했습니다. 관리자 권한과 연결 상태를 확인해주세요.');
                    } finally {
                        setBusy(false);
                    }
                }}
                style={{
                    minHeight: '44px',
                    border: '1px solid #2563eb',
                    borderRadius: '9px',
                    padding: '10px 12px',
                    color: '#fff',
                    backgroundColor: !connected || busy ? '#94a3b8' : '#2563eb',
                    fontWeight: 800,
                    cursor: !connected || busy ? 'not-allowed' : 'pointer',
                }}
            >
                {busy ? 'BAND 게시 중…' : latestPost ? '📢 BAND 주차 결과 다시 게시' : '📢 BAND에 주차 결과 게시'}
            </button>
            {!connected && <small style={{ color: '#475569' }}>볼링장 설정에서 BAND를 먼저 연결해주세요.</small>}
            {latestPost && (
                <small style={{ color: latestPost.status === 'FAILED' ? '#b91c1c' : '#334155' }}>
                    게시 이력: {latestPost.status} · v{latestPost.revision}
                    {latestPost.errorMessage ? ` · ${latestPost.errorMessage}` : ''}
                </small>
            )}
            {feedback && <small role="status" style={{ color: '#1d4ed8' }}>{feedback}</small>}
        </div>
    );
}
