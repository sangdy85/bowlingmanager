'use client';

import { useEffect, useState } from 'react';
import { getLeagueWeeklyBandStateAction } from '@/app/actions/band-actions';
import BandPublishControl from './BandPublishControl';
import BandUncertainResolution from './BandUncertainResolution';
import styles from './BandPublishStatus.module.css';

export default function LeagueWeeklyBandButton({ centerId, tournamentId, roundId, week, connected, configured, onBusyChange }: {
    centerId: string; tournamentId: string; roundId: string; week: number;
    connected: boolean; configured: boolean; onBusyChange?: (busy: boolean) => void;
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
            <p className={styles.hint}>선택 주차까지의 누적 순위·시상과 해당 주차의 매치 기록을 한 건의 본문으로 게시합니다.</p>
        </div>
        <BandPublishControl
            key={`${roundId}:${week}`}
            centerId={centerId} tournamentId={tournamentId} roundId={roundId} week={week}
            type="LEAGUE_WEEKLY_RESULT" connected={available && ready}
            buttonLabel="📢 선택 주차 BAND 공지"
            onBusyChange={onBusyChange} onSettled={refreshState}
        />
        {!(selected?.configured ?? configured)
            ? <p className={styles.hint}>NAVER BAND 연동 준비 중입니다. 앱 승인과 운영 설정 완료 후 게시할 수 있습니다.</p>
            : !(selected?.connected ?? connected) && <p className={styles.hint}>볼링장 설정에서 BAND를 먼저 연결해주세요.</p>}
        {!state && !error && <p role="status" className={styles.hint}>선택 주차의 완료 상태와 게시 이력을 확인 중입니다.</p>}
        {selected && !ready && <p className={styles.hint}>{selected.matchCount === 0 ? '경기가 없는 주차는 게시할 수 없습니다.' : '해당 주차의 모든 경기가 완료된 후 게시할 수 있습니다.'}</p>}
        {(error || (state && !state.success && state.message)) && <p role="alert" className={styles.feedback}>{error || (state && !state.success ? state.message : '')}</p>}
        {latest && <>
            <p className={styles.hint}>선택 주차 게시 이력: {latest.status} · v{latest.revision}{latest.errorMessage ? ` · ${latest.errorMessage}` : ''}</p>
            <BandUncertainResolution centerId={centerId} post={latest} onResolved={refreshState} />
        </>}
    </div>;
}
