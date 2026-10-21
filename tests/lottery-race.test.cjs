const assert=require('node:assert/strict'),{test}=require('node:test'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const cache=new Map();
function load(name){if(cache.has(name))return cache.get(name);const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/lib',name+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;const module={exports:{}};new Function('require','module','exports',code)(id=>id.startsWith('./')?load(id.slice(2)):require(id),module,module.exports);cache.set(name,module.exports);return module.exports;}
const {createLotteryRacePlan,raceProgress,raceSnapshot,appendRaceWinners,raceRecentEvents,raceSimulationTime,racePlaybackTime,raceRevealedWinners,RACE_ITEMS,RaceEffect,createRacePickups,RACE_ITEM_COUNT}=load('lottery-race');
const {activateRaceItem,applyRaceAttack,advanceRaceItemSpeed,createRaceItemState,raceAttackTargets,raceItemEffects}=load('lottery-race-items');
const {raceTerrain,raceCoursePoint}=load('lottery-race-course');
const {getEligibleCandidates}=load('lottery-ui');
const {raceFinishView}=load('lottery-race-view');
const person=id=>({registrationId:id,registration:{guestName:'가상 동명이인',guestTeamName:'가상팀'}});
const fixture=createLotteryRacePlan(80,20,50000,{seed:42});

test('finish shot settles before first arrival and adds ten percent zoom and lowers the camera only after that arrival',()=>{
 const plan=fixture,start=plan.slowMotionStartMs;
 assert.ok(Math.abs(plan.finishCameraAtMs/plan.normalRate-(start-2000))<1e-8);
 assert.equal(raceFinishView(plan,plan.finishCameraAtMs-1,start-2001).locked,false);
 assert.equal(raceFinishView(plan,plan.finishCameraAtMs,start-2000).locked,true);
 for(const offset of [-1,0])assert.equal(raceFinishView(plan,plan.firstFinishMs,start+offset).zoom,1);
 assert.equal(raceSnapshot(plan,raceSimulationTime(plan,start-.01)).filter(r=>r.progress===1).length,0);
 assert.ok(raceSnapshot(plan,raceSimulationTime(plan,start+.01)).filter(r=>r.progress===1).length>=1);
 const mid=raceFinishView(plan,raceSimulationTime(plan,start+400),start+400);
 assert.equal(mid.zoom,1.16);assert.equal(mid.lowerDegrees,5);
 for(const time of [start+800,plan.slowMotionEndMs+100,plan.durationMs])assert.equal(raceFinishView(plan,raceSimulationTime(plan,time),time).zoom,1.32);
 assert.deepEqual(raceFinishView(null,0,0),{locked:false,zoom:1,lowerDegrees:0});
});

test('solo race reveals its only winner immediately and retains enough time for the finish zoom',()=>{
 const plan=createLotteryRacePlan(1,1,50000,{seed:43});
 assert.ok(plan.durationMs-plan.slowMotionEndMs>=800-1e-8);
 assert.equal(raceSimulationTime(plan,plan.slowMotionStartMs+1),plan.simulationEndMs);
 assert.equal(raceFinishView(plan,plan.simulationEndMs,plan.slowMotionStartMs).zoom,1);
 assert.equal(raceFinishView(plan,plan.simulationEndMs,plan.slowMotionStartMs+800).zoom,1.32);
 assert.equal(raceFinishView(plan,plan.firstFinishMs,plan.slowMotionStartMs-1,true).zoom,1);
 assert.equal(raceFinishView(plan,plan.firstFinishMs,plan.slowMotionStartMs,true).zoom,1.32);
});

test('natural durations stay within five seconds while slow-motion length follows the requested prize count',()=>{
 const durations=new Set();
 for(const seed of [1,17,42,91,701]){
  const a=createLotteryRacePlan(47,1,50000,{seed}),b=createLotteryRacePlan(47,20,50000,{seed});
  assert.ok(a.durationMs>=45000-1e-8&&a.durationMs<=55000+1e-8);
  assert.equal(a.firstFinishMs,b.firstFinishMs);assert.ok(b.slowFinishMs>a.slowFinishMs);assert.deepEqual(a.order,b.order);
  assert.equal(a.firstFinishMs,a.runners[a.order[0]].finishMs);
  assert.ok(Math.abs(raceSimulationTime(a,a.slowMotionStartMs)-a.firstFinishMs)<1e-8);
  durations.add(a.durationMs.toFixed(3));
 }
 assert.ok(durations.size>1,'race no longer forces every seed to exactly 50 seconds');
});

test('45–55-second playback lets every runner finish while preserving exactly the requested prize count',()=>{
 for(const count of [1,2,5,20,50,200,500])for(const wanted of [...new Set([1,Math.min(20,count)])]){
  const plan=createLotteryRacePlan(count,wanted,50000,{seed:count+17});
  assert.deepEqual([...plan.order].sort((a,b)=>a-b),Array.from({length:count},(_,i)=>i));
  assert.deepEqual(raceSnapshot(plan,0).map(p=>p.index),Array.from({length:count},(_,i)=>i));
  const end=raceSnapshot(plan,raceSimulationTime(plan,plan.durationMs));assert.equal(end.filter(p=>p.progress===1).length,count);assert.deepEqual(end.map(p=>p.index),plan.order);
  assert.equal(plan.runners[plan.order[wanted-1]].finishMs,plan.prizeFinishMs);
  assert.equal(plan.runners[plan.order.at(-1)].finishMs,plan.simulationEndMs);
  assert.equal(appendRaceWinners([],Array.from({length:count},(_,i)=>person(String(i))),plan).length,wanted);
  assert.ok(plan.durationMs>=45000-1e-8&&plan.durationMs<=55000+1e-8);assert.ok(plan.slowMotionStartMs>0);assert.ok(plan.slowMotionEndMs<=plan.durationMs+1e-8);
 }
});
test('seeded simulation replays exactly and winner-count/camera/frame-rate cannot choose another order',()=>{
 const a=createLotteryRacePlan(40,1,50000,{seed:701}),b=createLotteryRacePlan(40,20,50000,{seed:701});
 assert.deepEqual(a.order,b.order);assert.deepEqual(a.events,b.events);assert.equal(a.firstFinishMs,b.firstFinishMs);
 for(let i=0;i<40;i++)assert.deepEqual(a.runners[i].samples,b.runners[i].samples);
 const replay=createLotteryRacePlan(40,1,50000,{seed:701});assert.deepEqual(replay,a);
 assert.deepEqual(raceSnapshot(a,1e9).map(p=>p.index),a.order);
});
test('all eleven bowling items are real pickups and change trajectories and finishing order',()=>{
 assert.equal(RACE_ITEMS.length,11);assert.equal(new Set(RACE_ITEMS.map(i=>i.key)).size,11);
 assert.deepEqual(new Set(fixture.events.filter(e=>e.phase==='use').map(e=>e.kind)),new Set(RACE_ITEMS.map(i=>i.key)));
 const plain=createLotteryRacePlan(80,20,50000,{seed:42,items:false});assert.notDeepEqual(fixture.order,plain.order);
 assert.ok(fixture.runners.some((r,i)=>r.samples.some((v,t)=>v!==plain.runners[i].samples[t])));
 for(const kind of ['pinShot','kingPin','dry','split'])assert.ok(fixture.events.some(e=>e.kind===kind&&e.phase==='hit'),kind+' hits');
});

test('requested buffs and hazards expire at their exact race-clock boundaries',()=>{
 for(const [kind,bit,duration] of [['strike',RaceEffect.STRIKE,2000],['spare',RaceEffect.SPARE,2000],['spin',RaceEffect.SPIN,2000],['perfect',RaceEffect.PERFECT,1500],['gutter',RaceEffect.GUTTER,1500],['bowlingPin',RaceEffect.RECOVERY,1000]]){
  const state=createRaceItemState();activateRaceItem(state,kind,1000);
  assert.ok(raceItemEffects(state,1000)&bit,kind);assert.ok(raceItemEffects(state,1000+duration-1)&bit,kind);assert.equal(raceItemEffects(state,1000+duration)&bit,0,kind);
 }
});

test('gutter, turkey and kingpin fully stop movement; pinshot pushes briefly then stops',()=>{
 const gutter=createRaceItemState();activateRaceItem(gutter,'gutter',1000);
 for(let time=1000;time<2500;time+=100)assert.equal(advanceRaceItemSpeed(gutter,24,time,100),0);
 assert.ok(advanceRaceItemSpeed(gutter,24,2500,100)>0);
 for(const [kind,duration] of [['turkey',1000],['kingPin',1500],['pinShot',1000]]){
  const state=createRaceItemState();assert.equal(applyRaceAttack(state,kind,1000),'hit');assert.equal(state.speed,0);
  if(kind==='pinShot')assert.ok(advanceRaceItemSpeed(state,24,1000,100)<0);
  for(let t=1200;t<1000+duration;t+=100)assert.equal(advanceRaceItemSpeed(state,24,t,100),0,kind);
  assert.ok(advanceRaceItemSpeed(state,24,1000+duration,100)>0,kind);
 }
});

test('boosts use 1.5x/2x and both slowdowns use reciprocal 1.8 without multiplying stacked effects',()=>{
 for(const [kind,multiplier] of [['strike',1.5],['spin',2],['perfect',1.5]]){
  const state=createRaceItemState();activateRaceItem(state,kind,1000);state.speed=24*multiplier;
  assert.equal(advanceRaceItemSpeed(state,24,1100,100),24*multiplier);
 }
 for(const [kind,duration] of [['dry',3000],['split',2000]]){
  const state=createRaceItemState();applyRaceAttack(state,kind,1000);state.speed=24/1.8;
  assert.equal(advanceRaceItemSpeed(state,24,1000+duration-1,100),24/1.8);
  assert.ok(advanceRaceItemSpeed(state,24,1000+duration,100)>24/1.8);
 }
 const combined=createRaceItemState();activateRaceItem(combined,'strike',1000);activateRaceItem(combined,'spin',1000);applyRaceAttack(combined,'dry',1000);applyRaceAttack(combined,'split',1000);combined.speed=48/1.8;
 assert.equal(advanceRaceItemSpeed(combined,24,1100,100),48/1.8);
});

test('turkey targets exactly top three, split the preceding two, and pins their intended ranks',()=>{
 const ranked=[5,4,3,2,1];
 assert.deepEqual(raceAttackTargets('turkey',ranked,1),[5,4,3]);assert.deepEqual(raceAttackTargets('turkey',ranked,5),[4,3]);
 assert.deepEqual(raceAttackTargets('split',ranked,2),[4,3]);assert.deepEqual(raceAttackTargets('split',ranked,4),[5]);
 assert.deepEqual(raceAttackTargets('pinShot',ranked,2),[3]);assert.deepEqual(raceAttackTargets('kingPin',ranked,2),[5]);assert.deepEqual(raceAttackTargets('kingPin',ranked,5),[]);
 assert.deepEqual(raceAttackTargets('turkey',[0],0),[]);
 for(const use of fixture.events.filter(e=>e.phase==='use'))assert.ok(!use.targets.includes(use.actor));
 assert.ok(fixture.events.some(e=>e.kind==='turkey'&&e.phase==='use'&&e.targets.length===3));
 assert.ok(fixture.events.some(e=>e.kind==='turkey'&&e.phase==='hit'));
});

test('spare absorbs one attack within two seconds; perfect cleans and protects for only the first second',()=>{
 const spare=createRaceItemState();activateRaceItem(spare,'spare',1000);assert.equal(applyRaceAttack(spare,'turkey',2999),'spare');assert.equal(spare.spare,0);assert.equal(applyRaceAttack(spare,'kingPin',2999),'hit');
 const expired=createRaceItemState();activateRaceItem(expired,'spare',1000);assert.equal(applyRaceAttack(expired,'kingPin',3000),'hit');
 const state=createRaceItemState();for(const kind of ['dry','split','turkey','pinShot'])applyRaceAttack(state,kind,900);activateRaceItem(state,'gutter',900);activateRaceItem(state,'perfect',1000);
 assert.equal(raceItemEffects(state,1000)&(RaceEffect.DRY|RaceEffect.SPLIT|RaceEffect.TURKEY|RaceEffect.PIN|RaceEffect.GUTTER),0);
 assert.equal(applyRaceAttack(state,'kingPin',1999),'perfect');assert.equal(applyRaceAttack(state,'kingPin',2000),'hit');assert.ok(raceItemEffects(state,2000)&RaceEffect.PERFECT);assert.equal(raceItemEffects(state,2000)&RaceEffect.PROTECTED,0);
});

test('bowling pin resets to zero and recovers smoothly; high spin collisions push others backwards with a cooldown',()=>{
 const pin=createRaceItemState();activateRaceItem(pin,'bowlingPin',1000);assert.equal(pin.speed,0);
 const first=advanceRaceItemSpeed(pin,24,1100,100),second=advanceRaceItemSpeed(pin,24,1200,100);assert.ok(first>0&&first<second&&second<24);
 const victim=createRaceItemState();assert.equal(applyRaceAttack(victim,'spin',1000),'hit');assert.ok(advanceRaceItemSpeed(victim,24,1100,100)<0);assert.equal(applyRaceAttack(victim,'spin',1100),'cooldown');assert.ok(advanceRaceItemSpeed(victim,24,1400,100)>0);
 assert.ok(fixture.events.some(e=>e.kind==='spin'&&e.phase==='hit'));
 for(const r of fixture.runners)for(let i=1;i<r.samples.length;i++)assert.ok(Math.abs(r.samples[i]-r.samples[i-1])<.035,'no teleport');
});

test('dry zones remain active for later entrants and hit every target at most once per zone',()=>{
 const traps=fixture.events.filter(e=>e.kind==='dry'&&e.phase==='trap');assert.ok(traps.length);
 assert.ok(fixture.events.some(e=>e.kind==='dry'&&e.phase==='hit'&&traps.some(z=>z.actor===e.actor&&e.time>z.time&&e.time<z.time+3000)),'later entrants are affected');
 for(const zone of traps){const next=traps.find(z=>z.actor===zone.actor&&z.time>zone.time);if(next&&next.time<zone.time+3000)continue;const hits=fixture.events.filter(e=>e.kind==='dry'&&['hit','block'].includes(e.phase)&&e.actor===zone.actor&&e.time>=zone.time&&e.time<zone.time+3000);assert.equal(new Set(hits.map(e=>e.targets[0])).size,hits.length);}
});

test('every requested count 1–20 confirms prizes before continuing subsequent arrivals',()=>{
 const base=createLotteryRacePlan(40,1,50000,{seed:91});
 for(let count=1;count<=20;count++){
  const plan=createLotteryRacePlan(40,count,50000,{seed:91});
  assert.deepEqual(plan.order,base.order);assert.equal(plan.runners[plan.order[count-1]].finishMs,plan.prizeFinishMs);
  assert.ok(Math.abs(raceSimulationTime(plan,plan.slowMotionStartMs)-plan.firstFinishMs)<1e-8);
  const atPrize=plan.prizeFinishMs+.001,later=(atPrize+plan.simulationEndMs)/2;
  assert.equal(raceSnapshot(plan,atPrize).filter(p=>p.progress===1).length,count);
  assert.ok(plan.runners.some(r=>r.finishMs>atPrize&&raceProgress(r,later)>raceProgress(r,atPrize)),'non-winners keep moving after prize confirmation');
  assert.equal(raceSnapshot(plan,raceSimulationTime(plan,plan.durationMs)).filter(p=>p.progress===1).length,40);
 }
 for(const event of fixture.events.filter(e=>e.phase==='use'&&e.targets.length&&['kingPin','pinShot'].includes(e.kind))){
  assert.ok(event.targets.every(target=>target!==event.actor&&fixture.runners[target].finishMs>event.time));
 }

});
test('pin and high-spin effects can move runners backwards; positions remain bounded throughout',()=>{
 assert.ok(fixture.runners.some(r=>r.samples.some((v,i)=>i>0&&v<r.samples[i-1])));
 for(const r of fixture.runners)for(const v of r.samples)assert.ok(Number.isFinite(v)&&v>=0&&v<=1);
 assert.ok(fixture.events.every(e=>Number.isFinite(e.time)&&e.time>=0));
 assert.ok(fixture.events.filter(e=>e.phase==='use').length<=100);
 assert.deepEqual(raceRecentEvents(fixture,1e9),[]);
});

test('hit interpolation stays within sampled positions and has continuous velocity across reversals',()=>{
 const targets=new Set(fixture.events.filter(e=>e.phase==='hit').flatMap(e=>e.targets));assert.ok(targets.size);
 for(const index of targets){const r=fixture.runners[index];
  for(let i=1;i<r.samples.length-1&&i*100<r.finishMs;i++){
   const time=i*100;assert.ok(Math.abs(raceProgress(r,time)-r.samples[i])<1e-7);
   const velocityBefore=(raceProgress(r,time)-raceProgress(r,time-.01))/.01,velocityAfter=(raceProgress(r,time+.01)-raceProgress(r,time))/.01;
   assert.ok(Math.abs(velocityBefore-velocityAfter)<1e-7,'no velocity discontinuity at an item sample');
   for(const fraction of [.25,.5,.75]){const value=raceProgress(r,time+fraction*100);assert.ok(value>=Math.min(r.samples[i],r.samples[i+1])-1e-7&&value<=Math.max(r.samples[i],r.samples[i+1])+1e-7);}
  }
  assert.ok(1-raceProgress(r,r.finishMs-.01)<.00001,'continuous actual line crossing');
 }
});
test('uphill slows, downhill accelerates, and the winding course is finite and continuous',()=>{
 assert.ok(raceTerrain(.20).multiplier<1);assert.ok(raceTerrain(.35).multiplier>1);assert.ok(raceTerrain(.57).multiplier<1);assert.ok(raceTerrain(.70).multiplier>1);assert.equal(raceTerrain(.9).multiplier,1);
 let previous=raceCoursePoint(0);let directionChanges=0;let lastSign=0;
 for(let i=1;i<=1000;i++){const p=raceCoursePoint(i/1000);assert.ok(Object.values(p).every(Number.isFinite));assert.ok(Math.hypot(p.x-previous.x,p.y-previous.y)<10);const sign=Math.sign(p.dx);if(sign!==lastSign)directionChanges++;lastSign=sign;previous=p;}
 assert.ok(directionChanges>=4);
});
test('slowdown runs from first arrival through prize count plus one, with smooth normal-speed recovery',()=>{
 assert.equal(raceSimulationTime(fixture,-1),0);assert.equal(raceSimulationTime(fixture,fixture.durationMs),fixture.simulationEndMs);
 assert.equal(raceSimulationTime(fixture,999999),fixture.simulationEndMs);
 const start=fixture.slowMotionStartMs,end=fixture.slowMotionEndMs;
 assert.equal(raceSimulationTime(fixture,start),fixture.firstFinishMs);
 assert.equal(raceSimulationTime(fixture,end),fixture.runners[fixture.order[fixture.winnerCount]].finishMs);
 const mid=racePlaybackTime(fixture,(fixture.firstFinishMs+fixture.slowFinishMs)/2),speed=t=>(raceSimulationTime(fixture,t+1)-raceSimulationTime(fixture,t));
 assert.ok(Math.abs(speed(mid)/fixture.normalRate-.25)<1e-8);
 for(const raw of [fixture.firstFinishMs,fixture.firstFinishMs+fixture.slowRampMs,fixture.slowFinishMs-fixture.slowRampMs,fixture.slowFinishMs]){const time=racePlaybackTime(fixture,raw);assert.ok(Math.abs(speed(time)-speed(time-1))<fixture.normalRate*.0001,'continuous velocity');}
 assert.ok(Math.abs(speed(end+100)-fixture.normalRate)<1e-8,'normal speed resumes after extra finisher');
 let previous=0;for(let time=0;time<=fixture.durationMs;time+=10){const value=raceSimulationTime(fixture,time);assert.ok(value>=previous&&value<=fixture.simulationEndMs);previous=value;}
 for(let raw=0;raw<fixture.simulationEndMs;raw+=123)assert.ok(Math.abs(raceSimulationTime(fixture,racePlaybackTime(fixture,raw))-raw)<1e-7,'clock round trip');
});

test('central results wait for every participant while normal speed still resumes at the extra finisher',()=>{
 assert.deepEqual(raceRevealedWinners(null,999999),[]);
 for(const count of [1,5,20,47])for(const wanted of [...new Set([1,Math.min(count,20)])]){
  const plan=createLotteryRacePlan(count,wanted,50000,{seed:91}),extraRank=Math.min(wanted,count-1);
  assert.equal(plan.slowFinishMs,plan.runners[plan.order[extraRank]].finishMs);
  assert.deepEqual(raceRevealedWinners(plan,plan.simulationEndMs-.001),[]);
  if(plan.slowFinishMs<plan.simulationEndMs)assert.deepEqual(raceRevealedWinners(plan,plan.slowFinishMs),[]);
  assert.deepEqual(raceRevealedWinners(plan,plan.simulationEndMs),plan.order.slice(0,wanted));
  assert.equal(raceSnapshot(plan,raceSimulationTime(plan,plan.slowMotionEndMs)).filter(p=>p.progress===1).length,extraRank+1);
  assert.equal(raceRevealedWinners(plan,plan.simulationEndMs).length,wanted);
  if(count>wanted)assert.ok(!raceRevealedWinners(plan,plan.simulationEndMs).includes(plan.order[wanted]));
 }
});

test('course is completed by movement, without a capped pack or a fitted late speed jump',()=>{
 const plan=createLotteryRacePlan(40,20,50000,{seed:19,items:false});
 for(const runner of plan.runners){
  assert.ok(runner.finishMs>15000&&runner.finishMs<30000);
  for(let i=1;i<runner.samples.length;i++){
   const step=runner.samples[i]-runner.samples[i-1];
   assert.ok(step>=0&&step<.008, 'no teleports / individual finish sprint');
  }
  assert.equal(runner.samples.at(-1),1);
 }
 for(let playback=0;playback<plan.durationMs-100;playback+=1000){if(playback+100>=plan.slowMotionStartMs&&playback<=plan.slowMotionEndMs)continue;assert.ok(Math.abs((raceSimulationTime(plan,playback+100)-raceSimulationTime(plan,playback))/100-plan.normalRate)<1e-9);}
});

test('shortened course and hills change position and speed continuously at every boundary',()=>{
 assert.equal(load('lottery-race-course').RACE_COURSE_LENGTH,480);
 for(const boundary of [.14,.28,.42,.50,.64,.78]){
  const a=raceTerrain(boundary-.000001),b=raceTerrain(boundary+.000001);
  assert.ok(Math.abs(a.height-b.height)<.002);assert.ok(Math.abs(a.multiplier-b.multiplier)<.0001);
 }
 let length=0,previous=raceCoursePoint(0);for(let i=1;i<=1000;i++){const p=raceCoursePoint(i/1000);length+=Math.hypot(p.x-previous.x,p.y-previous.y);previous=p;}
 assert.ok(Math.abs(length-2899.46)<1,'visual road is 20% shorter with the same broad bends');
});

test('batch completion remains idempotent, preserving waitlist/prize exclusion and independent equal names',()=>{
 const roster=Array.from({length:30},(_,i)=>({...person(String(i)),createdAt:new Date(2026,0,i+1).toISOString()})),before=JSON.stringify(roster);
 const pool=getEligibleCandidates(roster,['0'],['1','2','3'],25),plan=createLotteryRacePlan(pool.length,20,50000,{seed:71});
 const winners=appendRaceWinners([roster[0]],pool,plan);assert.equal(winners.length,21);assert.equal(new Set(winners.map(p=>p.registrationId)).size,21);assert.deepEqual(appendRaceWinners(winners,pool,plan),winners);assert.equal(JSON.stringify(roster),before);
});
test('invalid inputs are rejected and unsupported nominal durations cannot bypass the bounded playback clock',()=>{
 for(const args of [[0,1],[2,0],[2,3],[30,21],[NaN,1],[5001,1],[10,1,12000],[10,1,50001]])assert.throws(()=>createLotteryRacePlan(...args));
});
function loadPainter(){const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/components/tournaments/lottery-race-canvas.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;const module={exports:{}};new Function('require','module','exports',code)(id=>id.startsWith('@/lib/')?load(id.slice(6)):require(id),module,module.exports);return module.exports.paintLotteryRace;}
function context(){const labels=[],draws=[],ops=[],target={stroke:()=>ops.push('stroke'),fill:()=>ops.push('fill'),createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}}),measureText:text=>({width:text.length*6}),fillText:text=>{labels.push(text);draws.push({text,font:target.font});ops.push('text:'+text);}};return {labels,draws,ops,ctx:new Proxy(target,{get:(obj,key)=>obj[key]||((...args)=>{for(const value of args)if(typeof value==='number')assert.ok(Number.isFinite(value));}),set:(obj,key,value)=>{obj[key]=value;return true;}})};}
test('actual renderer supports all item states, winding map, overview and follow camera on mobile/PC',()=>{
 const paint=loadPainter(),pool=Array.from({length:80},(_,i)=>person(String(i)));
 for(const width of [320,1000])for(const elapsed of [0,6000,18000,33000,fixture.simulationEndMs])for(const overview of [false,true]){const {ctx,labels}=context();paint(ctx,width,440,pool,raceSnapshot(fixture,elapsed),elapsed,79,false,fixture,overview);assert.ok(!labels.includes('?'));if(elapsed===0)for(const item of RACE_ITEMS)assert.ok(labels.includes(item.icon));}
 const {ctx}=context();paint(ctx,320,340,[],[],0,null,true,null,true);
});

test('exactly 100 real pickups span the course, show all eleven kinds and are consumed once by a matching runner',()=>{
 const pickups=createRacePickups(42);assert.equal(pickups.length,RACE_ITEM_COUNT);assert.equal(RACE_ITEM_COUNT,100);
 assert.equal(new Set(pickups.map(p=>p.id)).size,100);assert.equal(new Set(pickups.map(p=>p.kind)).size,11);
 assert.ok(pickups.every(p=>p.progress>0&&p.progress<.9&&Math.abs(p.lane)<=1));
 const uses=fixture.events.filter(e=>e.phase==='use');assert.equal(new Set(uses.map(e=>e.pickupId)).size,uses.length);
 for(const use of uses){const pickup=fixture.pickups.find(p=>p.id===use.pickupId);assert.equal(pickup.kind,use.kind);assert.equal(pickup.collectedBy,use.actor);assert.equal(pickup.collectedAt,use.time);assert.ok(Math.abs(raceSnapshot(fixture,use.time).find(p=>p.index===use.actor).lane-pickup.lane)<.27);}
 assert.equal(fixture.pickups.filter(p=>p.collectedAt!==null).length,uses.length);
 assert.deepEqual(createLotteryRacePlan(5,1,50000,{seed:42,items:false}).pickups,[]);
});


test('actual 2D fallback uses the same expanded name sizes without changing normal labels',()=>{
 const paint=loadPainter(),plan=createLotteryRacePlan(47,5,50000,{seed:42}),pool=Array.from({length:47},(_,index)=>({registrationId:String(index),registration:{guestName:'확대선수 '+index}}));
 for(const [width,size]of [[390,11],[1280,16]])for(const expanded of [false,true]){
  const {ctx,draws,ops}=context();paint(ctx,width,620,pool,raceSnapshot(plan,12000),12000,46,true,plan,false,0,expanded);
  const names=draws.filter(d=>d.text.startsWith('확대선수 '));assert.ok(names.length);assert.ok(names.every(d=>d.font===(expanded?'900 '+size+'px sans-serif':'800 11px sans-serif')));if(expanded)assert.ok(ops.at(-1).startsWith('text:확대선수 '),'names stay above item effects');
 }
});

test('actual 2D expanded track adds five percent zoom while whole map retains its fit',()=>{const paint=loadPainter(),pool=[person('1')];for(const overview of [false,true]){const widths=[];for(const expanded of [false,true]){const {ctx}=context();let laneWidth;ctx.stroke=()=>{if(ctx.strokeStyle==='#32465f')laneWidth=ctx.lineWidth;};paint(ctx,1280,620,pool,[{index:0,progress:.4}],12000,null,true,null,overview,undefined,expanded);widths.push(laneWidth);}assert.ok(Math.abs(widths[1]/widths[0]-(overview?1:1.1*1.05))<1e-12);}});

test('2D expanded camera lowers the projected track by ten degrees without changing whole-map geometry',()=>{const paint=loadPainter(),pool=[person('1')];for(const overview of [false,true]){const shapes=[];for(const expanded of [false,true]){const {ctx}=context();let points=[];ctx.beginPath=()=>{points=[];};ctx.moveTo=(x,y)=>points.push([x,y]);ctx.lineTo=(x,y)=>points.push([x,y]);ctx.stroke=()=>{if(ctx.strokeStyle==='#32465f')shapes.push(points.slice());};paint(ctx,1280,620,pool,[{index:0,progress:.4}],12000,null,true,null,overview,undefined,expanded);}const delta=p=>p[1][1]-p[0][1];const expected=overview?1:1.1*1.05*Math.sin(Math.asin(.78)-10*Math.PI/180)/.78;assert.ok(Math.abs(delta(shapes[1])/delta(shapes[0])-expected)<1e-8);}});
