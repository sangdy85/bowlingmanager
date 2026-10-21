'use client';

import { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { updateLuckyDrawResult } from '@/app/actions/round-actions';
import { getRoundFinalResults } from '@/lib/round-final-results';
import { getEligibleCandidates, getPrizeWinnerRegistrationIds, participantName, type LotteryParticipant } from '@/lib/lottery-ui';
import LotteryRace from './LotteryRace';
import { appendRaceWinners, createLotteryRacePlan, RACE_COUNTDOWN_MS, RACE_FINISH_HOLD_MS, RACE_DURATION_MS, type LotteryRacePlan } from '@/lib/lottery-race';
import raceStyles from './LotteryRace.module.css';
import styles from './LotteryAndLane.module.css';
import ui from './ManagementUI.module.css';

function readSavedResult(value: string | null | undefined) {
    if (!value) return { winners: [] as LotteryParticipant[], winnerCount: 1, excludeRankers: true, isFinalized: false, error: false };
    try {
        const data = JSON.parse(value);
        if (!Array.isArray(data.winners) || data.winners.some((p: LotteryParticipant) => !p?.registrationId || !p.registration)) throw new Error('Invalid winners');
        return { winners: data.winners as LotteryParticipant[], winnerCount: Math.min(20, Math.max(1, Math.trunc(Number(data.winnerCount)) || 1)), excludeRankers: data.excludeRankers !== false, isFinalized: !!data.isFinalized, error: false };
    } catch {
        return { winners: [] as LotteryParticipant[], winnerCount: 1, excludeRankers: true, isFinalized: true, error: true };
    }
}

export default function RoundLuckyDrawTab({ round }: { round: any }) {
    const [saved] = useState(() => readSavedResult(round.luckyDrawResult));
    const [winnerCount, setWinnerCount] = useState(saved.winnerCount);
    const [excludeRankers, setExcludeRankers] = useState(saved.excludeRankers);
    const [winners, setWinners] = useState<LotteryParticipant[]>(saved.winners);
    const [isFinalized, setIsFinalized] = useState(saved.isFinalized);
    const [isSaving, setIsSaving] = useState(false);
    const [running, setRunning] = useState(false);
    const [resetRequested, setResetRequested] = useState(false);
    const [race, setRace] = useState<{ pool: LotteryParticipant[]; plan: LotteryRacePlan } | null>(null);
    const durationMs = RACE_DURATION_MS;
    const [feedback, setFeedback] = useState('');
    const pending = useRef<{ pool: LotteryParticipant[]; plan: LotteryRacePlan } | null>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => () => { if (timer.current) clearTimeout(timer.current); pending.current = null; }, []);

    const settings = round.tournament?.settings ? JSON.parse(round.tournament.settings) : {};
    const maxParticipants = settings.roundMaxParticipants?.[round.roundNumber] ?? round.tournament?.maxParticipants ?? settings.maxParticipants ?? 0;
    const supported = ['CHAMP', 'EVENT'].includes(round.tournament?.type);
    const { sortedResults, isTeamEvent } = supported ? getRoundFinalResults(round) : { sortedResults: [], isTeamEvent: false };
    const topIds = getPrizeWinnerRegistrationIds(sortedResults, isTeamEvent);
    const pool = getEligibleCandidates<LotteryParticipant>(round.participants, winners.map(p => p.registrationId), excludeRankers ? topIds : [], maxParticipants);
    const racePool = race?.pool ?? pool;
    const locked = running || isSaving || isFinalized;
    const lastWinner = winners[winners.length - 1];

    const finishDraw = () => {
        const batch = pending.current;
        if (!batch) return;
        pending.current = null;
        if (timer.current) clearTimeout(timer.current);
        setWinners(previous => appendRaceWinners(previous, batch.pool, batch.plan));
        setRunning(false);
        confetti({ particleCount: 100, spread: 65, origin: { y: 0.6 }, disableForReducedMotion: true });
    };
    const handleDraw = () => {
        if (locked || pending.current || !pool.length || winners.length >= winnerCount || !supported) return;
        let plan: LotteryRacePlan;
        try {
            plan = createLotteryRacePlan(pool.length, Math.min(winnerCount - winners.length, pool.length), durationMs);
        } catch {
            setFeedback('레이스를 준비하지 못했습니다. 브라우저를 확인한 뒤 다시 시도해주세요.');
            return;
        }
        const batch = { pool: [...pool], plan };
        pending.current = batch;
        setRunning(true);
        setFeedback('');
        setResetRequested(false);
        setRace(batch);
        // The same preselected finish order completes even when background tabs pause canvas frames.
        timer.current = setTimeout(finishDraw, RACE_COUNTDOWN_MS + plan.durationMs + RACE_FINISH_HOLD_MS + 2000);
    };
    const resetDraw = () => {
        if (locked) return;
        setWinners([]);
        setRace(null);
        setResetRequested(false);
        setFeedback('추첨 내역을 초기화했습니다. 모든 미당첨 후보로 다시 시작합니다.');
    };
    const handleSave = async () => {
        if (locked || pending.current || winners.length === 0) return;
        if (!confirm("결과를 저장하시겠습니까? 저장 후에는 수정이나 초기화가 불가능합니다.")) return;

        setIsSaving(true);
        try {
            const resultData = {
                winners,
                winnerCount,
                excludeRankers,
                isFinalized: true
            };
            await updateLuckyDrawResult(round.id, JSON.stringify(resultData));
            setIsFinalized(true);
            alert("성공적으로 저장되었습니다.");
        } catch (e: any) {
            alert(e.message);
        } finally {
            setIsSaving(false);
        }
    };

    if (!supported) return <p className={ui.empty}>행운권 추첨은 챔프전·이벤트전에서 이용할 수 있습니다.</p>;
    return <div className={`${ui.surface} ${styles.lottery}`}>
        <header className={ui.header}><div><h2 className={ui.title}>행운권 추첨</h2><p className={ui.subtitle}>아이템과 언덕을 넘어 굴러가는 약 50초 볼링공 레이스! 도착 순서대로 선택한 인원이 당첨되며, 나머지 참가자도 끝까지 완주합니다.</p></div><span className={ui.badge}>{winners.length} / {winnerCount}명 추첨</span></header>
        {saved.error && <p className={styles.notice} role="alert">저장된 추첨 결과를 읽지 못했습니다. 기존 결과 보호를 위해 추첨이 잠겼습니다.</p>}
        <div className={styles.controls}>
            <label className={styles.countLabel}>추첨 인원<select value={winnerCount} disabled={locked || winners.length > 0} onChange={event => { setWinnerCount(Number(event.target.value)); setRace(null); }}>{Array.from({ length: 20 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}명</option>)}</select></label>
            <label className={styles.checkLabel}><input type="checkbox" checked={excludeRankers} disabled={locked || winners.length > 0} onChange={event => { setExcludeRankers(event.target.checked); setRace(null); }} />입상자 제외 <span>현재 회차 결과 기준</span></label>
            <div className={raceStyles.duration}><span>레이스 시간</span><strong>약 0:50 <small>경기 45~55초 · 준비 3초</small></strong></div>
            <div className={styles.poolStat}><strong>{pool.length}</strong><span>남은 후보</span></div>
        </div>
        <p className={styles.help}>대기자와 이미 당첨된 참가자는 후보에서 제외됩니다. 추첨을 시작한 뒤 설정을 바꾸려면 먼저 초기화하세요.</p>
        {excludeRankers && <p className={styles.notice}>{topIds.length ? `이번 회차 입상자 ${topIds.length}명 제외: ${round.participants.filter((p: LotteryParticipant) => topIds.includes(p.registrationId)).map(participantName).join(', ')}` : '입력된 점수가 없어 현재 제외되는 입상자가 없습니다.'}</p>}
        {!isFinalized && pool.length < winnerCount - winners.length && <p className={styles.notice}>남은 후보가 목표 인원보다 적습니다. 최대 {pool.length}명을 추가 추첨할 수 있습니다.</p>}
        <div className={styles.actions}>
            <button type="button" className={`${ui.button} ${ui.primary} ${styles.drawButton}`} onClick={handleDraw} disabled={locked || !pool.length || winners.length >= winnerCount}>{isFinalized ? '저장 완료 · 잠금' : running ? '레이스 진행 중…' : winners.length >= winnerCount ? '추첨 완료' : !pool.length ? '추첨 가능한 인원이 없습니다' : `레이스 시작 · ${Math.min(winnerCount - winners.length, pool.length)}명 추첨`}</button>
            <button type="button" className={ui.button} onClick={() => setResetRequested(true)} disabled={locked || !winners.length}>초기화</button>
            {!isFinalized && winners.length > 0 && <button type="button" className={ui.button} disabled={locked} onClick={handleSave}>{isSaving ? '저장 중…' : '결과 저장하기 (잠금)'}</button>}
        </div>
        {resetRequested && <div className={styles.notice} role="alert"><p>현재 추첨 내역을 모두 지우고 다시 시작할까요?</p><div className={styles.actions}><button type="button" className={ui.button} onClick={resetDraw}>초기화 확인</button><button type="button" className={ui.button} onClick={() => setResetRequested(false)}>취소</button></div></div>}
        {(!isFinalized || race) && <LotteryRace participants={racePool} plan={race?.plan ?? null} running={running} onFinish={finishDraw} onStart={handleDraw} canStart={!locked && !!pool.length && winners.length < winnerCount} drawCount={Math.min(winnerCount - winners.length, pool.length)} />}
        <div className={styles.result} role="status" aria-live="polite" aria-atomic="true"><span>{running ? '모든 후보가 결승선을 향해 달립니다' : lastWinner ? `총 ${winners.length}명 당첨` : '행운의 주인공을 기다립니다'}</span><strong>{running ? '레이스 진행 중…' : lastWinner ? winners.map(participantName).slice(0, 3).join(' · ') + (winners.length > 3 ? ` 외 ${winners.length - 3}명` : '') : '준비 완료'}</strong>{!running && lastWinner && <span>도착 순서는 아래 누적 당첨자 명단에서 확인하세요.</span>}</div>
        <p className={styles.help}>{isFinalized ? '저장된 결과는 수정하거나 초기화할 수 없습니다.' : '저장 전 결과는 화면을 이동하거나 새로고침하면 사라집니다. 결과 저장 후에는 수정·초기화할 수 없습니다.'}</p>
        {feedback && <p className={styles.help} role="status">{feedback}</p>}
        <section className={styles.winners}><h3 className={styles.sectionTitle}>누적 당첨자 <span className={ui.badge}>{winners.length}명</span></h3>{winners.length ? <ol>{winners.map((person, index) => <li key={person.registrationId}><span>{index + 1}차 추첨자</span><strong>{participantName(person)}</strong><small>{(person.registration.guestTeamName ?? person.registration.team?.name) || '개인'}</small></li>)}</ol> : <p className={ui.empty}>아직 추첨한 참가자가 없습니다.</p>}</section>
        <details className={styles.candidates}><summary>레이스 후보 명단 ({racePool.length}명){race && !running ? ' · 방금 추첨 기준' : ''}</summary><ol>{racePool.map(p => <li key={p.registrationId}>{participantName(p)} <span>· {(p.registration.guestTeamName ?? p.registration.team?.name) || '개인'}</span></li>)}</ol></details>
    </div>;
}
