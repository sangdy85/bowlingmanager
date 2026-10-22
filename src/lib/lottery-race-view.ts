import { racePlaybackTime, type LotteryRacePlan } from './lottery-race';

/** Hold the first finisher for one presentation second, independent of slow-motion speed. */
export function raceFirstFinishHold(plan: LotteryRacePlan | null | undefined, elapsed: number, playbackMs?: number) {
    if (!plan || elapsed < plan.firstFinishMs) return false;
    const playback = playbackMs ?? racePlaybackTime(plan, elapsed);
    return playback < plan.slowMotionStartMs + 1000;
}

/** Follow the live podium, not the middle of the entire field. Never changes race state. */
export function raceBattleGroup<T extends { progress: number }>(positions: readonly T[], holdWinner = false): T[] {
    // Finished balls keep their result rank, but the camera follows the next race still in play.
    const racing = positions.filter(p => p.progress < 1);
    const field = !holdWinner && racing.length ? racing : positions;
    const leader = field[0];
    return leader ? field.slice(0, 3).filter(p => leader.progress - p.progress <= .075) : [];
}

/** Shared 3D/2D finish shot, driven by playback time so solo finishes also zoom. */
export function raceFinishView(plan:LotteryRacePlan|null|undefined,elapsed:number,playbackMs?:number,reduceMotion=false){
    if(!plan)return {locked:false,zoom:1,lowerDegrees:0};
    const playback=playbackMs??(elapsed>=plan.firstFinishMs?plan.slowMotionEndMs:0);
    const t=Math.max(0,Math.min(1,(playback-plan.slowMotionStartMs)/800));
    const eased=reduceMotion?(playback>=plan.slowMotionStartMs?1:0):t*t*(3-2*t);
    return {locked:elapsed>=plan.finishCameraAtMs,zoom:1+(.2+.12)*eased,lowerDegrees:10*eased};
}
