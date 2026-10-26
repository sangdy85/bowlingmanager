'use client';

import { useEffect, useState } from 'react';
import { getLeagueWeeklyBandStateAction } from '@/app/actions/band-actions';
import BandPublishControl from './BandPublishControl';
import BandOfficialShareControl from './BandOfficialShareControl';
import type { BandShareImage } from '@/lib/band/share-images';
import BandUncertainResolution from './BandUncertainResolution';
import styles from './BandPublishStatus.module.css';

export default function LeagueWeeklyBandButton({ centerId, tournamentId, roundId, week, connected, configured, onBusyChange, onPrepareImages }: {
    centerId: string; tournamentId: string; roundId: string; week: number;
    connected: boolean; configured: boolean; onBusyChange?: (busy: boolean) => void;
    onPrepareImages?: () => Promise<BandShareImage[]>;
}) {
    const [refresh, setRefresh] = useState(0);
    const [state, setState] = useState<Awaited<ReturnType<typeof getLeagueWeeklyBandStateAction>> | null>(null);
    const [error, setError] = useState('');
    useEffect(() => {
        let current = true;
        setState(null);
        setError('');
        getLeagueWeeklyBandStateAction({ centerId, tournamentId, roundId, week }).then(result => {
            if (current) setState(result);
        }).catch(() => {
            if (current) setError('선택 주차의 게시 상태를 확인하지 못했습니다. 새로고침 후 다시 시도해주세요.');
        });
        return () => { current = false; };
    }, [centerId, tournamentId, roundId, week, refresh]);
    const selected = state?.success && state.roundId === roundId && state.week === week ? state : null;
    const ready = Boolean(selected?.ready);
    const available = selected ? selected.configured && selected.connected : configured && connected;
    const latest = selected?.latestPost;
    const refreshState = () => setRefresh(value => value + 1);

    return <div className={styles.weeklyArea} aria-label={`${week}주차 BAND 공지`}>
        <div>
            <strong>{week}주차 공지 · 공식 결과표 4종 기록</strong>
            <p className={styles.hint}>선택 주차의 결과표 4종을 사진으로 준비하고, 대회명·주차·항목명과 안내 문구를 함께 공유합니다.</p>
        </div>
        <BandOfficialShareControl
            key={`share:${roundId}:${week}`}
            centerId={centerId} tournamentId={tournamentId} roundId={roundId} week={week}
            type="LEAGUE_WEEKLY_RESULT" buttonLabel="📢 선택 주차 BAND 공유하기"
            onBusyChange={onBusyChange}
            onPrepareImages={onPrepareImages}
        />
        <p className={styles.hint}>공식 공유하기는 BAND 연결 없이 사용할 수 있습니다. PNG 4종은 다운로드한 뒤 BAND에서 직접 첨부해주세요.</p>
        <details className={styles.apiDetails}>
            <summary>BAND 자동 게시: {configured ? '기존 API 연결 기능' : 'API 승인 필요'}</summary>
            <BandPublishControl
                key={`api:${roundId}:${week}`}
                centerId={centerId} tournamentId={tournamentId} roundId={roundId} week={week}
                type="LEAGUE_WEEKLY_RESULT" connected={available && ready}
                buttonLabel="API 게시 미리보기" onBusyChange={onBusyChange} onSettled={refreshState}
            />
            {!configured ? <p className={styles.hint}>API 승인 및 운영 설정 전에는 자동 게시를 사용할 수 없습니다.</p>
                : !connected && <p className={styles.hint}>API 게시를 사용하려면 볼링장 설정에서 BAND를 연결해주세요.</p>}
        </details>
        {!state && !error && <p role="status" className={styles.hint}>선택 주차의 완료 상태와 게시 이력을 확인 중입니다.</p>}
        {selected && !ready && <p className={styles.hint}>{selected.matchCount === 0 ? '경기가 없는 주차는 게시할 수 없습니다.' : '해당 주차의 모든 경기가 완료된 후 게시할 수 있습니다.'}</p>}
        {(error || (state && !state.success && state.message)) && <p role="alert" className={styles.feedback}>{error || (state && !state.success ? state.message : '')}</p>}
        {latest && <>
            <p className={styles.hint}>선택 주차 게시 이력: {latest.status} · v{latest.revision}{latest.errorMessage ? ` · ${latest.errorMessage}` : ''}</p>
            <BandUncertainResolution centerId={centerId} post={latest} onResolved={refreshState} />
        </>}
    </div>;
}
