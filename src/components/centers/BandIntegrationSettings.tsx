'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { disconnectCenterBand, selectCenterBand, sendBandTestPostAction } from '@/app/actions/band-actions';
import type { BandSummary } from '@/lib/band/types';
import styles from './BandIntegrationSettings.module.css';

type SafeConnection = {
    bandKey: string | null;
    bandName: string | null;
    bandCoverUrl: string | null;
    enabled: boolean;
    doPush: boolean;
    connectedAt: string;
} | null;

export default function BandIntegrationSettings({ centerId, connection, oauthResult }: {
    centerId: string; connection: SafeConnection; oauthResult?: string;
}) {
    const router = useRouter();
    const [bands, setBands] = useState<BandSummary[]>([]);
    const [selected, setSelected] = useState(connection?.bandKey || '');
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState(oauthResult === 'connected' ? 'BAND 인증을 완료했습니다. 게시할 BAND를 선택해주세요.' : '');
    const [isError, setIsError] = useState(Boolean(oauthResult && oauthResult !== 'connected'));

    const run = async (task: () => Promise<{ success: boolean; message: string }>) => {
        setBusy(true);
        try {
            const result = await task();
            setMessage(result.message);
            setIsError(!result.success);
            if (result.success) router.refresh();
        }
        catch { setMessage('요청을 처리하지 못했습니다. 로그인과 센터 관리 권한을 확인해주세요.'); setIsError(true); }
        finally { setBusy(false); }
    };

    const loadBands = async () => {
        setBusy(true);
        try {
            const response = await fetch(`/api/integrations/band/bands?centerId=${encodeURIComponent(centerId)}`);
            const body = await response.json();
            if (!response.ok) throw new Error(body.error || 'BAND 목록을 불러오지 못했습니다.');
            setBands(body.bands || []); setMessage('게시할 BAND를 선택해주세요.'); setIsError(false);
        } catch (error) { setMessage(error instanceof Error ? error.message : 'BAND 목록 조회에 실패했습니다.'); setIsError(true); }
        finally { setBusy(false); }
    };

    return <section className={styles.panel} aria-labelledby="band-settings-title">
        <div className={styles.header}>
            <div><h2 id="band-settings-title" className={styles.title}>NAVER BAND 공유</h2><p className={styles.description}>운영 화면에서 [BAND에 공유]를 눌러 내용을 미리 확인한 뒤 선택한 BAND에 게시합니다.</p></div>
            {connection && <span className={styles.badge}>연결됨</span>}
        </div>
        {message && <p className={`${styles.message} ${isError ? styles.error : ''}`}>{message}</p>}
        {!connection ? <a className={styles.button} href={`/api/integrations/band/connect?centerId=${encodeURIComponent(centerId)}`}>NAVER BAND 연결</a> : <div className={styles.stack}>
            <div className={styles.box}>
                <p><strong>게시 BAND:</strong> {connection.bandName || '선택 전'}</p>
                <div className={styles.row}>
                    <button className={`${styles.button} ${styles.secondary}`} disabled={busy} onClick={loadBands}>내 BAND 불러오기</button>
                    {bands.length > 0 && <><select className={styles.select} value={selected} onChange={e => setSelected(e.target.value)} aria-label="게시할 BAND">
                        <option value="">BAND 선택</option>{bands.map(b => <option key={b.bandKey} value={b.bandKey}>{b.name}{b.memberCount != null ? ` (${b.memberCount}명)` : ''}</option>)}
                    </select><button className={styles.button} disabled={busy || !selected} onClick={() => run(() => selectCenterBand(centerId, selected))}>선택 저장</button></>}
                </div>
            </div>
            <div className={styles.row}>
                <button className={`${styles.button} ${styles.secondary}`} disabled={busy || !connection.bandKey} onClick={() => run(() => sendBandTestPostAction(centerId))}>테스트 글 게시</button>
                <button className={`${styles.button} ${styles.danger}`} disabled={busy} onClick={() => { if (confirm('BAND 연결을 해제하시겠습니까?')) run(() => disconnectCenterBand(centerId)); }}>연결 해제</button>
            </div>
        </div>}
    </section>;
}
