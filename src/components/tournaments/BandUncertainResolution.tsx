'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { resolveUncertainBandPostAction } from '@/app/actions/band-actions';
import styles from './BandPublishStatus.module.css';

export default function BandUncertainResolution({ centerId, post, onResolved }: {
    centerId: string;
    onResolved?: () => void;
    post: { id: string; status: string; createdAt: string };
}) {
    const router = useRouter();
    const [confirmed, setConfirmed] = useState(false);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    if (!['UNKNOWN', 'PENDING'].includes(post.status)) return null;

    const pendingTooRecent = post.status === 'PENDING' &&
        Date.now() - new Date(post.createdAt).getTime() < 30 * 60 * 1000;
    const resolve = async (resolution: 'POSTED' | 'NOT_POSTED') => {
        if (!confirmed || busy || pendingTooRecent) return;
        const prompt = resolution === 'POSTED'
            ? '실제 BAND 게시글이 존재하는 것을 확인했나요? 게시됨으로 확정하면 같은 글의 재게시가 차단됩니다.'
            : 'BAND에서 게시글이 없는 것을 직접 확인했나요? 미게시로 기록한 뒤 새 미리보기를 통해 다시 게시할 수 있습니다.';
        if (!window.confirm(prompt)) return;

        setBusy(true);
        setMessage('');
        try {
            const result = await resolveUncertainBandPostAction({
                centerId, postId: post.id, resolution, confirmed: true,
            });
            setMessage(result.message);
            if (result.success) { onResolved?.(); router.refresh(); }
        } catch {
            setMessage('게시 이력 확인을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.');
        } finally {
            setBusy(false);
        }
    };

    return <div className={styles.uncertain}>
        <p className={styles.previewWarning}>
            {post.status === 'UNKNOWN'
                ? '게시 전송 결과를 확인할 수 없습니다. BAND에 접속해 실제 게시 여부를 먼저 확인해주세요.'
                : '게시 요청이 처리 중이거나 응답이 지연되고 있습니다.'}
        </p>
        {pendingTooRecent && <p className={styles.hint}>요청 후 30분이 지나야 확인 결과를 정리할 수 있습니다.</p>}
        <label className={styles.approval}>
            <input type="checkbox" checked={confirmed} disabled={busy || pendingTooRecent}
                onChange={event => setConfirmed(event.target.checked)} />
            실제 BAND에서 해당 글의 게시 여부를 직접 확인했습니다.
        </label>
        <div className={styles.resolveActions}>
            <button type="button" disabled={!confirmed || busy || pendingTooRecent}
                onClick={() => resolve('POSTED')}>게시됨 확인</button>
            <button type="button" disabled={!confirmed || busy || pendingTooRecent}
                onClick={() => resolve('NOT_POSTED')}>게시되지 않음 확인</button>
        </div>
        {message && <p role="status" className={styles.feedback}>{message}</p>}
    </div>;
}
