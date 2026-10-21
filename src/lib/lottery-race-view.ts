import type { LotteryRacePlan } from './lottery-race';

/** Shared 3D/2D finish shot, driven by playback time so solo finishes also zoom. */
export function raceFinishView(plan:LotteryRacePlan|null|undefined,elapsed:number,playbackMs?:number,reduceMotion=false){
    if(!plan)return {locked:false,zoom:1,lowerDegrees:0};
    const playback=playbackMs??(elapsed>=plan.firstFinishMs?plan.slowMotionEndMs:0);
    const t=Math.max(0,Math.min(1,(playback-plan.slowMotionStartMs)/800));
    const eased=reduceMotion?(playback>=plan.slowMotionStartMs?1:0):t*t*(3-2*t);
    return {locked:elapsed>=plan.finishCameraAtMs,zoom:1+(.2+.12)*eased,lowerDegrees:10*eased};
}
