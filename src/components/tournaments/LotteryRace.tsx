'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { participantName, type LotteryParticipant } from '@/lib/lottery-ui';
import { RACE_COUNTDOWN_MS, RACE_FINISH_HOLD_MS, raceSimulationTime, raceRevealedWinners, RACE_ITEM_COUNT, RACE_ITEMS, raceEffectLabels, raceRecentEvents, raceSnapshot, type LotteryRacePlan } from '@/lib/lottery-race';
import { paintLotteryRace, RACE_COLORS } from './lottery-race-canvas';
import styles from './LotteryRace.module.css';
import { LotteryRaceScene } from './lottery-race-scene';
import { raceTerrain } from '@/lib/lottery-race-course';

type Props = { participants: LotteryParticipant[]; plan: LotteryRacePlan | null; running: boolean; onFinish: () => void; onStart?: () => void; canStart?: boolean; drawCount?: number };
type Frame = { race: LotteryRacePlan | null; playback: number; elapsed: number; countdown: number; finished: boolean };
const teamName = (p: LotteryParticipant) => p.registration.guestTeamName || p.registration.team?.name || '개인';

export default function LotteryRace({ participants, plan, running, onFinish, onStart, canStart, drawCount }: Props) {
    const canvas = useRef<HTMLCanvasElement>(null);
    const worldCanvas = useRef<HTMLCanvasElement>(null);
    const section = useRef<HTMLElement>(null);
    const [expanded, setExpanded] = useState(false);
    const expandedRef = useRef(expanded);
    expandedRef.current = expanded;
    const [graphics3D, setGraphics3D] = useState(false);
    const finish = useRef(onFinish);
    finish.current = onFinish;
    const [overview, setOverview] = useState(false);
    const [dismissedResults, setDismissedResults] = useState<LotteryRacePlan | null>(null);
    const overviewRef = useRef(overview);
    overviewRef.current = overview;
    const [followed, setFollowed] = useState<number | null>(null);
    const followedRef = useRef(followed);
    followedRef.current = followed;
    const redraw = useRef<() => void>(() => {});
    const [frame, setFrame] = useState<Frame>({ race: null, playback: 0, elapsed: 0, countdown: 0, finished: false });
    const [reducedMotion, setReducedMotion] = useState(false);
    const [canvasUnavailable, setCanvasUnavailable] = useState(false);

    useEffect(() => {
        const media = window.matchMedia('(prefers-reduced-motion: reduce)');
        setReducedMotion(media.matches);
        const change = () => setReducedMotion(media.matches);
        media.addEventListener('change', change);
        return () => media.removeEventListener('change', change);
    }, []);

    useEffect(() => {
        if (!expanded) return;
        const active = document.activeElement as HTMLElement | null, previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden'; section.current?.focus();
        const key = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setExpanded(false);
            if (event.key === 'Tab') {
                const controls = Array.from(section.current?.querySelectorAll<HTMLElement>('button:not(:disabled), select:not(:disabled), summary') ?? []).filter(e => e.offsetParent !== null);
                const first = controls[0], last = controls[controls.length - 1];
                if (!section.current?.contains(document.activeElement)) { event.preventDefault(); (event.shiftKey ? last : first)?.focus(); }
                else if (event.shiftKey && (document.activeElement === first || document.activeElement === section.current)) { event.preventDefault(); last?.focus(); }
                else if (!event.shiftKey && (document.activeElement === last || document.activeElement === section.current)) { event.preventDefault(); first?.focus(); }
            }
        };
        document.addEventListener('keydown', key);
        return () => { document.body.style.overflow = previous; document.removeEventListener('keydown', key); active?.focus(); };
    }, [expanded]);

    useEffect(() => {
        setFollowed(null);
        followedRef.current = null;
        const element = canvas.current;
        const context = element?.getContext('2d');
        setCanvasUnavailable(!context);
        let scene: LotteryRaceScene | null = null;
        try { if (worldCanvas.current) scene = new LotteryRaceScene(worldCanvas.current); } catch { /* Accessible 2D fallback remains available. */ }
        setGraphics3D(!!scene);
        let request = 0;
        let disposed = false;
        let completed = false;
        let lastPaint = -100;
        let lastUpdate = -200;
        let lastFinished = false;
        let width = 900;
        let height = 500;
        const start = performance.now();
        // A media preference change must never restart a race or choose another result.
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        let latestElapsed = plan && !running ? plan.simulationEndMs : 0;
        let latestPlayback = plan && !running ? plan.durationMs : 0;
        let latestPositions = plan ? raceSnapshot(plan, latestElapsed) : participants.map((_, index) => ({ index, progress: 0 }));
        const paint = () => {
            if (!context || disposed) return;
            if (scene) {
                try { scene.render(context, width, height, participants, latestPositions, latestElapsed, followedRef.current, reduce, plan, overviewRef.current || reduce, latestPlayback, expandedRef.current); return; }
                catch { scene.dispose(); scene = null; setGraphics3D(false); }
            }
            paintLotteryRace(context, width, height, participants, latestPositions, latestElapsed, followedRef.current, reduce, plan, overviewRef.current || reduce, latestPlayback, expandedRef.current);
        };
        redraw.current = paint;
        const resize = () => {
            if (!element) return;
            width = element.clientWidth || 900;
            height = element.clientHeight || 500;
            const ratio = Math.min(window.devicePixelRatio || 1, 2);
            const pixelWidth=Math.round(width*ratio),pixelHeight=Math.round(height*ratio);
            // A HUD update must not clear/reallocate an unchanged drawing surface.
            if(element.width!==pixelWidth)element.width=pixelWidth;
            if(element.height!==pixelHeight)element.height=pixelHeight;
            if (worldCanvas.current) {
                if(worldCanvas.current.width!==pixelWidth)worldCanvas.current.width=pixelWidth;
                if(worldCanvas.current.height!==pixelHeight)worldCanvas.current.height=pixelHeight;
            }
            context?.setTransform(ratio, 0, 0, ratio, 0, 0);
            lastPaint = -100;
            paint();
        };
        const observer = element ? new ResizeObserver(resize) : null;
        if (element) observer?.observe(element);
        resize();
        const tick = (now: number) => {
            if (disposed) return;
            const sinceStart = now - start;
            const playback = plan ? (!running ? plan.durationMs : Math.max(0, sinceStart - RACE_COUNTDOWN_MS)) : 0;
            const elapsed = plan ? raceSimulationTime(plan, playback) : 0;
            const countdown = plan && running ? Math.max(0, Math.ceil((RACE_COUNTDOWN_MS - sinceStart) / 1000)) : 0;
            const finished = !!plan && playback >= plan.durationMs;
            if (context && now - lastPaint >= (reduce ? 250 : 15)) {
                latestPositions = plan ? raceSnapshot(plan, elapsed) : participants.map((_, index) => ({ index, progress: 0 }));
                latestElapsed = elapsed;
                latestPlayback = playback;
                paint();
                lastPaint = now;
            }
            if (now - lastUpdate >= 150 || finished !== lastFinished) {
                setFrame({ race: plan, playback, elapsed, countdown, finished });
                lastUpdate = now;
                lastFinished = finished;
            }
            if (plan && running && !completed && (sinceStart >= RACE_COUNTDOWN_MS + plan.durationMs + RACE_FINISH_HOLD_MS)) {
                completed = true;
                finish.current();
            }
            if (running && !completed) request = requestAnimationFrame(tick);
        };
        tick(start);
        return () => { disposed = true; redraw.current = () => {}; cancelAnimationFrame(request); observer?.disconnect(); scene?.dispose(); };
    }, [participants, plan, running]);
    useEffect(() => { redraw.current(); }, [followed, overview, expanded]);

    const complete = !!plan && !running;
    const ranked = useMemo(()=>plan ? raceSnapshot(plan, complete ? plan.simulationEndMs : frame.elapsed) : participants.map((_, index) => ({ index, progress: 0 })),[plan,complete,frame.elapsed,participants]);
    const finishedCount = plan ? ranked.filter(p => p.progress >= 1).length : 0;
    const prizesConfirmed = !!plan && finishedCount >= plan.winnerCount;
    const recent = plan ? raceRecentEvents(plan, frame.elapsed).slice(-4) : [];
    const currentRunner = ranked.find(r => r.index === followed) || ranked[0];
    const terrain = raceTerrain(currentRunner?.progress || 0);
    const slowMotion = !!plan && frame.race === plan && running && frame.playback >= plan.slowMotionStartMs && frame.playback < plan.slowMotionEndMs && !frame.finished;
    const podium = complete ? plan.order.slice(0, plan.winnerCount) : [];
    const revealedWinners = frame.race === plan ? raceRevealedWinners(plan, frame.elapsed) : [];
    const resultsReady = !!plan && (complete || revealedWinners.length > 0);
    const showResults = resultsReady && dismissedResults !== plan;
    const remainingItems = plan ? plan.pickups.filter(item => item.collectedAt === null || item.collectedAt > frame.elapsed).length : RACE_ITEM_COUNT;
    return <section ref={section} className={`${styles.race} ${expanded ? styles.expanded : ''}`} aria-label="볼링 레이스 추첨" role={expanded ? 'dialog' : undefined} aria-modal={expanded ? true : undefined} tabIndex={expanded ? -1 : undefined}>
        <header className={styles.header}><div><span className={styles.eyebrow}>BOWLING BALL RACE</span><h3>굴려라! 볼링공 레이스</h3></div><div className={styles.pills}>{expanded && canStart && onStart && <button type="button" className={styles.startInScene} onClick={() => { onStart(); section.current?.focus(); }}>▶ 레이스 시작 · {drawCount}명 추첨</button>}<span>⚡ 아이템 {RACE_ITEM_COUNT}개 · {RACE_ITEMS.length}종</span><span>{participants.length}명 출전</span>{plan && <span>{plan.winnerCount}명 당첨</span>}</div></header>
        <div className={styles.layout}>
            <div className={`${styles.track} ${slowMotion ? styles.slowMotion : ''}`}>
                <canvas ref={worldCanvas} className={styles.worldCanvas} aria-hidden="true" style={{ visibility: graphics3D ? 'visible' : 'hidden' }} />
                <canvas ref={canvas} className={styles.canvas} aria-label="참가자별 볼링공이 우드 레인 코스에서 부드럽게 굴러 결승선을 향하는 레이스. 종료 후 중앙에서 전체 순위를 확인할 수 있습니다." />
                <div className={styles.trackTop}><span>{complete ? 'FINISH · 레이스 종료' : running ? slowMotion ? 'SLOW MOTION · 최저 0.25×' : 'LIVE · 아이템 레이스' : 'READY · 출발 준비'}</span><span>{plan ? `${Math.min(plan.durationMs, frame.playback) / 1000 | 0}초 / 약 ${Math.round(plan.durationMs / 1000)}초` : '함께 달리는 참가자'}</span></div>
                <div className={styles.mapControls}><button type="button" onClick={() => setExpanded(value => !value)} aria-pressed={expanded}>{expanded ? '✕ 닫기' : '⛶ 화면 확대'}</button><button type="button" onClick={() => setOverview(value => !value)} aria-pressed={overview}>{overview ? '🔎 따라보기' : '🗺 전체 맵'}</button><span className={terrain.label === '오르막' ? styles.uphill : terrain.label === '내리막' ? styles.downhill : ''}>{terrain.label === '오르막' ? '↗ 오르막 · 감속' : terrain.label === '내리막' ? '↘ 내리막 · 가속' : '⛳ 평지'}</span>{resultsReady && !showResults && <button type="button" onClick={() => setDismissedResults(null)}>🏆 전체 순위</button>}</div>
                {slowMotion && <div className={styles.slowMotionBadge}><span>FIRST FINISH</span><strong>1위 도착!</strong><small>{Math.min((plan?.winnerCount ?? 0) + 1, participants.length)}위 도착까지 슬로모션{!overview && !reducedMotion ? ' · 추가 줌인' : ''}</small></div>}
                <div className={styles.itemFeed} aria-label="아이템 중계">{recent.map(event => { const item = RACE_ITEMS.find(i => i.key === event.kind)!; const actor = participants[event.actor]; const target = participants[event.targets[0]]; return <p key={event.id}><span>{item.icon}</span><span>{event.phase === 'block' ? `${target ? participantName(target) : '참가자'} · ${event.blockedBy === 'perfect' ? '퍼펙트' : '스페어'} 방어!` : event.phase === 'hit' ? `${target ? participantName(target) : '참가자'} · ${item.name} 명중` : event.phase === 'trap' ? '드라이존 발동!' : `${actor ? participantName(actor) : '참가자'} · ${item.name}${target ? ' → '+participantName(target) : ''}`}</span></p>; })}</div>
                {(!plan || frame.countdown > 0) && <div className={styles.overlay}><strong>{frame.countdown || 'READY?'}</strong><span>{frame.countdown ? '잠시 후 함께 출발합니다' : participants.length ? '아래 레이스 시작 버튼을 눌러주세요' : '현재 추첨 가능한 후보가 없습니다'}</span></div>}
                {showResults && plan && <section className={styles.winnerReveal} aria-label="이번 레이스 전체 순위">
                    <header><span>RACE RESULTS</span><h4>최종 레이스 순위</h4><p>{participants.length}명 전원 완주 · 상위 {plan.winnerCount}명 당첨</p></header>
                    <ol aria-label="참가자 전체 최종 순위" tabIndex={0}>{plan.order.map((index, rank) => <li key={participants[index].registrationId} className={rank < plan.winnerCount ? styles.resultWinner : ''}><b>{rank + 1}<small>위</small></b><strong title={`${participantName(participants[index])} · ${teamName(participants[index])}`}>{participantName(participants[index])}</strong>{rank < plan.winnerCount && <em>당첨</em>}</li>)}</ol>
                    <button type="button" onClick={() => setDismissedResults(plan)}>명단 닫기</button>
                </section>}
                {canvasUnavailable && <p className={styles.fallback}>이 브라우저에서는 경기장 그림을 표시할 수 없습니다. 실시간 순위와 당첨 결과는 정상 제공됩니다.</p>}
                <div className={styles.trackBottom}><span>{complete ? 'FINISH · 전원 완주' : prizesConfirmed ? `당첨 ${plan!.winnerCount}명 확정 · 후속 주자 도착 중 ${finishedCount}/${participants.length}명` : slowMotion ? '1위 도착 · 슬로모션으로 이어지는 결승' : '⚡ 남은 아이템 '+remainingItems+' / '+RACE_ITEM_COUNT}</span><span>{graphics3D ? '3D 볼링공 레이스' : '2D 호환 모드'} · 선두/참가자 추적</span></div>
            </div>
            <aside className={styles.board}>
                <div className={styles.boardHeading}><h4>{complete ? '최종 도착 순위' : prizesConfirmed ? '당첨 확정 · 완주 중' : '실시간 선두'}</h4><span>{finishedCount}/{participants.length}명 도착</span></div>
                <ol className={styles.ranking} aria-label="실시간 상위 순위">{ranked.slice(0, 6).map((runner, rank) => {
                    const person = participants[runner.index];
                    if (!person) return null;
                    const effects = 'effects' in runner ? raceEffectLabels(runner.effects as number) : [];
                    const won = !!plan && runner.progress >= 1 && rank < plan.winnerCount;
                    return <li key={person.registrationId} className={won ? styles.arrived : ''}><span className={styles.rank}>{rank + 1}</span><i style={{ backgroundColor: RACE_COLORS[runner.index % RACE_COLORS.length] }} /><div><strong>{participantName(person)}</strong><small>#{runner.index + 1} · {teamName(person)}</small>{effects.length > 0 && <em className={styles.effectLabel}>{effects.join(' · ')}</em>}</div><span className={styles.distance}>{won ? '당첨' : runner.progress >= 1 ? '완주' : `${Math.floor(runner.progress * 100)}%`}</span></li>;
                })}</ol>
                {!participants.length && <p className={styles.empty}>참가 후보가 없습니다.</p>}
                <label className={styles.follow}>참가자 보기<select value={followed ?? ''} onChange={event => setFollowed(event.target.value === '' ? null : Number(event.target.value))}><option value="">선두 자동 따라가기</option>{participants.map((p, index) => <option key={p.registrationId} value={index}>#{index + 1} {participantName(p)} · {teamName(p)}</option>)}</select></label>
                {followed !== null && participants[followed] && <p className={styles.followHint}>#{followed + 1} {participantName(participants[followed])} 따라가는 중</p>}
                <p className={styles.boardHelp}>아이템과 경사로가 실제 이동·순위를 바꿉니다. 먼저 닿은 참가자가 아이템을 획득해 자동 사용합니다. 경기는 약 50초(45~55초)입니다. 결승 구도를 먼저 잡고, 1위가 도착하면 결승 구도에서 10% 더 확대하고 앵글을 10도 낮춥니다. 당첨 인원 다음 순위가 들어올 때까지 슬로모션을 유지한 뒤 정상 속도로 복귀합니다. 참가자 전원이 완주하면 중앙에 전체 순위를 표시하고 당첨자를 구분합니다. 전원이 당첨되는 경우 마지막 당첨자 도착이 기준입니다. 당첨자가 확정돼도 나머지 참가자는 계속 완주합니다. 전체 맵·따라보기 조작은 결과에 영향을 주지 않습니다.</p>
            </aside>
        </div>
        <details className={styles.itemGuide}><summary>⚡ 코스 아이템 100개 · {RACE_ITEMS.length}종 효과 안내</summary><div className={styles.itemGrid}>{RACE_ITEMS.map(item => <div key={item.key}><b>{item.icon} {item.name}</b><span>{item.description}</span></div>)}</div><p>⛰ 오르막에서는 느려지고 내리막에서는 빨라집니다. 코스에는 총 100개를 배치합니다. 아이콘의 종류와 실제 효과가 일치하며, 먼저 닿은 한 명이 획득하면 사라집니다. 별도 클릭 없이 획득 즉시 자동 사용합니다. {RACE_ITEMS.length}종은 볼링을 모티브로 만든 게임 전용 효과이며 실제 볼링 규칙과 다릅니다. 아이템의 초 단위 효과는 경기 시뮬레이션 시간 기준입니다.</p></details>
        <div className={styles.progress}><span style={{ width: `${plan ? Math.min(100, frame.playback / plan.durationMs * 100) : 0}%` }} /></div>
        <p className={styles.announcement} role="status" aria-live="polite">{frame.countdown ? `${frame.countdown}초 후 출발` : complete ? `전원 완주. 레이스 종료. ${plan.winnerCount}명 당첨!` : running ? `${prizesConfirmed ? `당첨 ${plan!.winnerCount}명 확정. 나머지 참가자도 계속 달립니다. ` : ''}${finishedCount}/${participants.length}명 결승선 도착` : '레이스 출발을 기다립니다.'}{reducedMotion ? ' 화면 움직임 최소화 설정을 적용합니다.' : ''}</p>
        {podium.length > 0 && <div className={styles.podium}><div className={styles.podiumHeading}><span>CONGRATULATIONS</span><h4>행운의 주인공을 소개합니다</h4></div><ol>{podium.map((index, rank) => <li key={participants[index].registrationId}><span className={styles.place}>{rank + 1}<small>도착</small></span><div><strong>{participantName(participants[index])}</strong><small>{teamName(participants[index])}</small></div></li>)}</ol></div>}
    </section>;
}
