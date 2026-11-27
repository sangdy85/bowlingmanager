'use client';

import { useId, useState } from 'react';
import { saveBandPostSettingsAction } from '@/app/actions/band-post-settings-actions';
import { BAND_SHARE_TEXT_LIMIT, readBandShareDefaults } from '@/lib/band/share-caption';
import styles from './BandPublishStatus.module.css';

export default function BandPostSettings({ centerId, tournamentId, initialSettings }: { centerId: string; tournamentId: string; initialSettings?: string | null }) {
    const id = useId();
    const [draft, setDraft] = useState(() => readBandShareDefaults(initialSettings));
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    return <section className={styles.panel} aria-label="BAND 게시글 설정">
        <h3 className={styles.title}>BAND 게시글 설정</h3>
        <p className={styles.hint}>기본 안내에는 대회명·주차(회차)·항목명·날짜와 홈페이지 안내가 들어갑니다. 결과는 경기일, 명단·레인·모집 안내는 공유 당일 날짜를 사용합니다. 아래 문구는 모든 회차에서 불러오며, 공유할 때 이번 공지만 수정할 수도 있습니다.</p>
        <form onSubmit={async event => {
            event.preventDefault(); if (busy) return; setBusy(true); setMessage('');
            try {
                const result = await saveBandPostSettingsAction({ centerId, tournamentId, ...draft });
                setMessage(result.message);
                if (result.success && result.defaults) setDraft(result.defaults);
            } catch { setMessage('저장하지 못했습니다. 잠시 후 다시 시도해주세요.'); }
            finally { setBusy(false); }
        }}>
            <label className={styles.shareLabel} htmlFor={`${id}-above`}>사진 위에 쓰기 · 기본 문구</label>
            <textarea id={`${id}-above`} className={styles.settingsEditor} rows={3} maxLength={BAND_SHARE_TEXT_LIMIT} disabled={busy}
                value={draft.aboveImageText} placeholder="예: 이번 주 경기에 참여해주셔서 감사합니다."
                onChange={event => { setDraft({ ...draft, aboveImageText: event.target.value }); setMessage(''); }} />
            <label className={styles.shareLabel} htmlFor={`${id}-below`}>사진 아래에 쓰기 · 기본 문구</label>
            <textarea id={`${id}-below`} className={styles.settingsEditor} rows={3} maxLength={BAND_SHARE_TEXT_LIMIT} disabled={busy}
                value={draft.belowImageText} placeholder="예: 다음 주에도 즐거운 경기 부탁드립니다."
                onChange={event => { setDraft({ ...draft, belowImageText: event.target.value }); setMessage(''); }} />
            <p className={styles.previewNote}>비워두면 추가 문구를 넣지 않습니다. 저장한 문구는 다음 미리보기부터 반영됩니다. BAND에서는 사진 첨부 후 문구 위치를 확인해주세요.</p>
            <button type="submit" className={styles.confirmButton} disabled={busy}>{busy ? '저장 중…' : 'BAND 게시글 설정 저장'}</button>
            {message && <p role="status" className={styles.previewNote}>{message}</p>}
        </form>
    </section>;
}
