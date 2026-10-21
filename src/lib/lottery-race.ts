import { randomCandidateIndex } from './lottery-ui';
import { RACE_COURSE_LENGTH, raceTerrain } from './lottery-race-course';
import { RACE_ITEMS, activateRaceItem, applyRaceAttack, advanceRaceItemSpeed, createRaceItemState, raceAttackTargets, raceItemEffects, type RaceItemState, type RaceItemKey, type RaceAttack } from './lottery-race-items';
export { RACE_ITEMS, RaceEffect, raceEffectLabels, raceEffectIcons, type RaceItemKey } from './lottery-race-items';
export const RACE_COUNTDOWN_MS=3000;
export const RACE_FINISH_HOLD_MS=1000;
export const RACE_DURATION_MS=50000;
export const RACE_STEP_MS=100;
export const RACE_SLOW_MOTION_RATE=.25;
const SLOW_RAMP_SIMULATION_MS=200;
const MAX_SIMULATION_MS=180000;
export const RACE_ITEM_COUNT=100;
export type RaceEvent={id:number;time:number;kind:RaceItemKey;phase:'use'|'hit'|'trap'|'block';pickupId?:number;actor:number;targets:number[];progress:number;lane:number;blockedBy?:'spare'|'perfect'};
export type RaceRunner={index:number;lane:number;phase:number;finishMs:number;samples:Float32Array;lanes:Float32Array;effects:Uint16Array};
export type RacePickup={id:number;kind:RaceItemKey;progress:number;lane:number;collectedAt:number|null;collectedBy:number|null};
export type LotteryRacePlan={order:number[];runners:RaceRunner[];winnerCount:number;durationMs:number;simulationEndMs:number;firstFinishMs:number;slowFinishMs:number;slowRampMs:number;finishCameraAtMs:number;prizeFinishMs:number;normalRate:number;slowMotionStartMs:number;slowMotionEndMs:number;events:RaceEvent[];pickups:RacePickup[];seed:number};
type SimRunner=RaceItemState & {distance:number;lane:number;homeLane:number;phase:number;pace:number};
type PendingHit={at:number;actor:number;targets:number[];kind:RaceAttack;progress:number;lane:number};
type DryZone={until:number;actor:number;progress:number;lane:number;touched:Set<number>};
function seededRandom(seed:number){let state=seed>>>0;return()=>{state+=0x6D2B79F5;let t=state;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
/** 100 single-use pickups: 20 rows, five lanes, all configured kinds represented. */
export function createRacePickups(seed:number):RacePickup[]{
 const random=seededRandom(seed^0x59a1c3e7),kinds=Array.from({length:RACE_ITEM_COUNT},(_,i)=>RACE_ITEMS[i%RACE_ITEMS.length].key);
 for(let i=kinds.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[kinds[i],kinds[j]]=[kinds[j],kinds[i]];}
 return kinds.map((kind,id)=>({id,kind,progress:.045+Math.floor(id/5)*.043+(random()-.5)*.009,lane:(id%5-2)*.44+(random()-.5)*.04,collectedAt:null,collectedBy:null}));
}
/** Anonymous slots plus an independent permutation prevent name/registration-order bias. */
export function createLotteryRacePlan(count:number,winnerCount:number,targetDurationMs=RACE_DURATION_MS,options:{seed?:number;items?:boolean}={}):LotteryRacePlan{
 if(!Number.isSafeInteger(count)||count<1||count>5000||!Number.isSafeInteger(winnerCount)||winnerCount<1||winnerCount>Math.min(20,count)||targetDurationMs!==RACE_DURATION_MS)throw new Error('레이스는 1~20명 추첨, 약 50초(45~55초) 경기로 진행합니다.');
 const seed=options.seed??crypto.getRandomValues(new Uint32Array(1))[0],random=seededRandom(seed),identities=Array.from({length:count},(_,i)=>i);
 for(let i=count-1;i>0;i--){const j=options.seed===undefined?randomCandidateIndex(i+1):Math.floor(random()*(i+1));[identities[i],identities[j]]=[identities[j],identities[i]];}
 const steps=MAX_SIMULATION_MS/RACE_STEP_MS;
 const runners:RaceRunner[]=identities.map(index=>{const lane=random()*1.8-.9,lanes=new Float32Array(steps+1);lanes[0]=lane;return{index,lane,phase:random()*Math.PI*2,finishMs:Infinity,samples:new Float32Array(steps+1),lanes,effects:new Uint16Array(steps+1)};});
 const sim:SimRunner[]=runners.map(r=>({...createRaceItemState(),distance:0,lane:r.lane,homeLane:r.lane,phase:r.phase,pace:.96+random()*.08}));
 const events:RaceEvent[]=[],pending:PendingHit[]=[],zones:DryZone[]=[],pickups=options.items===false?[]:createRacePickups(seed);
 const record=(time:number,kind:RaceItemKey,phase:RaceEvent['phase'],actor:number,targets:number[],progress:number,lane:number,pickupId?:number,blockedBy?:RaceEvent['blockedBy'])=>events.push({id:events.length,time,kind,phase,pickupId,blockedBy,actor:identities[actor],targets:targets.map(i=>identities[i]),progress:Math.max(0,Math.min(1,progress)),lane});
 const hit=(target:number,actor:number,kind:RaceAttack,now:number)=>{
  const p=sim[target];if(target===actor||Number.isFinite(runners[target].finishMs))return;
  const result=applyRaceAttack(p,kind,now);if(result==='cooldown')return;
  record(now,kind,result==='hit'?'hit':'block',actor,[target],p.distance/RACE_COURSE_LENGTH,p.lane,undefined,result==='hit'?undefined:result);
 };
 const activate=(i:number,pickup:RacePickup,now:number)=>{
  const p=sim[i],kind=pickup.kind,active=sim.map((_,slot)=>slot).filter(slot=>!Number.isFinite(runners[slot].finishMs)).sort((a,b)=>sim[b].distance-sim[a].distance||a-b);
  activateRaceItem(p,kind,now);
  let targets:number[]=[];
  if(kind==='pinShot'||kind==='kingPin'||kind==='split'||kind==='turkey'){
   targets=raceAttackTargets(kind,active,i);
   if(targets.length)pending.push({at:now+600,actor:i,targets,kind,progress:p.distance/RACE_COURSE_LENGTH,lane:p.lane});
  }
  if(kind==='dry')pending.push({at:now+400,actor:i,targets:[],kind,progress:Math.min(1,(p.distance+14)/RACE_COURSE_LENGTH),lane:p.lane});
  record(now,kind,'use',i,targets,p.distance/RACE_COURSE_LENGTH,p.lane,pickup.id);
 };
 for(let step=1;step<=steps;step++){
  const now=step*RACE_STEP_MS,previousDistances=sim.map(p=>p.distance);
  for(let i=pending.length-1;i>=0;i--){const event=pending[i];if(event.at>now)continue;pending.splice(i,1);
   if(event.kind==='dry'){zones.push({until:now+3000,actor:event.actor,progress:event.progress,lane:event.lane,touched:new Set()});record(now,'dry','trap',event.actor,[],event.progress,event.lane);}
   else event.targets.forEach(target=>hit(target,event.actor,event.kind,now));
  }
  for(let z=zones.length-1;z>=0;z--){const zone=zones[z];if(zone.until<=now){zones.splice(z,1);continue;}
   sim.forEach((p,target)=>{if(target!==zone.actor&&!zone.touched.has(target)&&Math.abs(p.distance-zone.progress*RACE_COURSE_LENGTH)<14&&Math.abs(p.lane-zone.lane)<.9){zone.touched.add(target);hit(target,zone.actor,'dry',now);}});
  }
  for(let actor=0;actor<count;actor++)if(sim[actor].spin>now&&!Number.isFinite(runners[actor].finishMs)){
   for(let target=0;target<count;target++)if(target!==actor&&Math.abs(sim[target].distance-sim[actor].distance)<4&&Math.abs(sim[target].lane-sim[actor].lane)<.45)hit(target,actor,'spin',now);
  }
  for(let i=0;i<count;i++){
   const p=sim[i];if(Number.isFinite(runners[i].finishMs))continue;
   const terrain=raceTerrain(p.distance/RACE_COURSE_LENGTH),pace=24*p.pace*(1+.05*Math.sin(now/3000+p.phase)+.025*Math.sin(now/1300+p.phase*2));
   advanceRaceItemSpeed(p,pace*terrain.multiplier,now,RACE_STEP_MS);
   p.lane+=(p.homeLane-p.lane)*(1-Math.exp(-RACE_STEP_MS/400));
   p.distance=Math.max(0,Math.min(RACE_COURSE_LENGTH,p.distance+p.speed*RACE_STEP_MS/1000));
  }
  for(const pickup of pickups){
   if(pickup.collectedAt!==null)continue;const distance=pickup.progress*RACE_COURSE_LENGTH,candidates:{i:number;cross:number;lane:number}[]=[];
   sim.forEach((p,i)=>{const from=previousDistances[i];if(!Number.isFinite(runners[i].finishMs)&&Math.abs(p.lane-pickup.lane)<.27&&from<=distance+1&&p.distance>=distance-1&&p.distance>=from)candidates.push({i,cross:Math.max(0,(distance-from)/Math.max(.001,p.distance-from)),lane:Math.abs(p.lane-pickup.lane)});});
   if(!candidates.length)continue;candidates.sort((a,b)=>a.cross-b.cross||a.lane-b.lane||a.i-b.i);
   const owner=candidates[0].i;pickup.collectedAt=now;pickup.collectedBy=identities[owner];activate(owner,pickup,now);
  }
  sim.forEach((p,i)=>{
   if(p.distance>=RACE_COURSE_LENGTH&&!Number.isFinite(runners[i].finishMs)){const previous=runners[i].samples[step-1]*RACE_COURSE_LENGTH;runners[i].finishMs=now-RACE_STEP_MS+Math.min(RACE_STEP_MS,(RACE_COURSE_LENGTH-previous)/Math.max(.001,p.speed)*1000);}
   runners[i].samples[step]=p.distance/RACE_COURSE_LENGTH;runners[i].lanes[step]=p.lane;
   runners[i].effects[step]=raceItemEffects(p,now);
  });
  if(runners.every(r=>Number.isFinite(r.finishMs))){runners.forEach(r=>{r.samples=r.samples.slice(0,step+1);r.lanes=r.lanes.slice(0,step+1);r.effects=r.effects.slice(0,step+1);});break;}
 }
 if(runners.some(r=>!Number.isFinite(r.finishMs)))throw new Error('레이스 완주 계산을 완료하지 못했습니다. 다시 시도해주세요.');
    const orderSlots=runners.map((_,i)=>i).sort((a,b)=>runners[a].finishMs-runners[b].finishMs||a-b);
    const simulationEndMs=runners[orderSlots[count-1]].finishMs;
    const prizeFinishMs=runners[orderSlots[winnerCount-1]].finishMs;
    const firstFinishMs=runners[orderSlots[0]].finishMs;
    // Slow through the extra finisher (or the last candidate when everyone wins).
    // This changes presentation only; trajectories, item effects and order stay intact.
    const slowFinishMs=runners[orderSlots[Math.min(winnerCount,count-1)]].finishMs;
    const slowRampMs=Math.min(SLOW_RAMP_SIMULATION_MS,(slowFinishMs-firstFinishMs)/2);
    const weightedEnd=presentationTravel(simulationEndMs,firstFinishMs,slowFinishMs,slowRampMs);
    // Choose one cruise rate before departure; retain the 45–55 second range.
    const rateFor=(ms:number)=>Math.max(weightedEnd/ms,firstFinishMs/(ms-800));
    const normalRate=Math.max(rateFor(targetDurationMs+5000),Math.min(rateFor(targetDurationMs-5000),Math.round(rateFor(targetDurationMs)*10)/10));
    const durationMs=Math.max(weightedEnd/normalRate,firstFinishMs/normalRate+800);
    const slowMotionStartMs=firstFinishMs/normalRate;
    const finishCameraAtMs=Math.max(0,firstFinishMs-normalRate*2000);
    const slowMotionEndMs=presentationTravel(slowFinishMs,firstFinishMs,slowFinishMs,slowRampMs)/normalRate;
    const byIdentity:RaceRunner[]=new Array(count);runners.forEach(r=>{byIdentity[r.index]=r;});
    events.sort((a,b)=>a.time-b.time||a.id-b.id);
    return {order:orderSlots.map(slot=>identities[slot]),runners:byIdentity,winnerCount,durationMs,simulationEndMs,firstFinishMs,slowFinishMs,slowRampMs,finishCameraAtMs,prizeFinishMs,normalRate,slowMotionStartMs,slowMotionEndMs,events,pickups,seed};
}
/** Integrated inverse speed: normal before first, 0.25x inside, normal at extra arrival. */
function presentationTravel(raw:number,first:number,last:number,ramp:number){
    const span=last-first;if(span<=0||ramp<=0)return raw;
    const x=Math.max(0,Math.min(span,raw-first));
    const integral=(v:number)=>{const u=v/ramp;return ramp*(u*u*u-u*u*u*u/2);};
    const extra=x<ramp?integral(x):x<=span-ramp?x-ramp/2:span-ramp*1.5+(x-(span-ramp))-integral(x-(span-ramp));
    return raw+(1/RACE_SLOW_MOTION_RATE-1)*extra;
}
/** Real playback time of a simulation event, using the same eased clock for all balls. */
export function racePlaybackTime(plan:LotteryRacePlan,simulationMs:number){
    return presentationTravel(Math.max(0,Math.min(plan.simulationEndMs,simulationMs)),plan.firstFinishMs,plan.slowFinishMs,plan.slowRampMs)/plan.normalRate;
}
export function raceSimulationTime(plan:LotteryRacePlan,playbackMs:number){
    if(playbackMs>=plan.durationMs)return plan.simulationEndMs;
    const weighted=Math.max(0,Math.min(plan.durationMs,playbackMs))*plan.normalRate;
    if(Math.abs(weighted-plan.firstFinishMs)<1e-8)return plan.firstFinishMs;
    if(weighted<=plan.firstFinishMs)return weighted;
    const end=presentationTravel(plan.slowFinishMs,plan.firstFinishMs,plan.slowFinishMs,plan.slowRampMs);
    if(Math.abs(weighted-end)<1e-8)return plan.slowFinishMs;
    if(weighted>=end)return Math.min(plan.simulationEndMs,weighted-(end-plan.slowFinishMs));
    let lo=plan.firstFinishMs,hi=plan.slowFinishMs;
    // Monotonic inversion avoids frame-rate-dependent accumulation or rank changes.
    for(let i=0;i<48;i++){const mid=(lo+hi)/2;if(presentationTravel(mid,plan.firstFinishMs,plan.slowFinishMs,plan.slowRampMs)<weighted)lo=mid;else hi=mid;}
    return (lo+hi)/2;
}
/** Keep the finish view clear until everyone arrives; award only the requested ranks. */
export function raceRevealedWinners(plan:LotteryRacePlan|null,elapsed:number){
    return plan&&elapsed>=plan.simulationEndMs?plan.order.slice(0,plan.winnerCount):[];
}
export function raceProgress(runner:RaceRunner,elapsedMs:number){
    if(elapsedMs<=0)return 0;if(elapsedMs>=runner.finishMs)return 1;
    const i=Math.min(runner.samples.length-2,Math.floor(elapsedMs/RACE_STEP_MS)),a=runner.samples[i],b=runner.samples[i+1];
    // Shape-preserving cubic interpolation smooths a hit/reversal across sample
    // boundaries without changing samples, line-crossing times or prize order.
    const duration=(j:number)=>Math.min(RACE_STEP_MS,Math.max(.001,runner.finishMs-j*RACE_STEP_MS));
    const slope=(j:number)=>(runner.samples[j+1]-runner.samples[j])/duration(j);
    const current=slope(i),left=i>0?slope(i-1):current,right=b>=1?current:slope(i+1);
    const tangent=(x:number,y:number)=>x*y>0?2*x*y/(x+y):0;
    const h=duration(i),t=Math.max(0,Math.min(1,(elapsedMs-i*RACE_STEP_MS)/h)),t2=t*t,t3=t2*t;
    const value=(2*t3-3*t2+1)*a+(t3-2*t2+t)*h*tangent(left,current)+(-2*t3+3*t2)*b+(t3-t2)*h*tangent(current,right);
    return Math.min(.999999,Math.max(Math.min(a,b),Math.min(Math.max(a,b),value)));
}
export function raceSnapshot(plan:LotteryRacePlan,elapsedMs:number){
    const frame=Math.min(plan.runners[0].effects.length-1,Math.max(0,Math.floor(elapsedMs/RACE_STEP_MS)));
    const mix=Math.max(0,Math.min(1,elapsedMs/RACE_STEP_MS-frame));
    return plan.runners.map(r=>({index:r.index,progress:raceProgress(r,elapsedMs),finishMs:r.finishMs,lane:r.lanes[frame]+((r.lanes[frame+1]??r.lanes[frame])-r.lanes[frame])*mix,effects:r.effects[frame],phase:r.phase}))
        .sort((a,b)=>b.progress-a.progress||(a.progress>=1&&b.progress>=1?a.finishMs-b.finishMs:0)||a.index-b.index);
}
export function raceRecentEvents(plan:LotteryRacePlan,elapsedMs:number,windowMs=4200){return plan.events.filter(e=>e.time<=elapsedMs&&e.time>elapsedMs-windowMs);}
export function appendRaceWinners<T extends {registrationId:string}>(previous:T[],pool:T[],plan:LotteryRacePlan):T[]{
    const seen=new Set(previous.map(p=>p.registrationId)),next=[...previous];
    for(const index of plan.order.slice(0,plan.winnerCount)){const person=pool[index];if(!person||seen.has(person.registrationId))continue;seen.add(person.registrationId);next.push(person);}
    return next;
}
