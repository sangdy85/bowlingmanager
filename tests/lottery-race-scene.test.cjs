const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
const modules = new Map();
function load(file) {
    file = path.resolve(file);
    if (modules.has(file)) return modules.get(file);
    const module = { exports: {} };
    const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
    new Function('require', 'module', 'exports', source)(id => id.startsWith('@/') ? load(path.join(__dirname, '../src', id.slice(2) + '.ts')) : id.startsWith('.') ? load(path.resolve(path.dirname(file), id + '.ts')) : require(id), module, module.exports);
    modules.set(file, module.exports); return module.exports;
}
const { RaceMesh, raceBallMatrix, raceViewMatrix, racePerspective, raceMatrixMultiply, raceProject, rgb } = load(path.join(__dirname, '../src/lib/lottery-race-geometry.ts'));
const { LotteryRaceScene, lotteryRaceCamera } = load(path.join(__dirname, '../src/components/tournaments/lottery-race-scene.ts'));
const {raceCoursePoint}=load(path.join(__dirname,'../src/lib/lottery-race-course.ts'));
const { createLotteryRacePlan, raceSnapshot, raceSimulationTime } = load(path.join(__dirname, '../src/lib/lottery-race.ts'));
const { lotteryRaceBattleCamera } = load(path.join(__dirname, '../src/components/tournaments/lottery-race-scene.ts'));
const { raceBattleGroup, raceFirstFinishHold, raceFinishView } = load(path.join(__dirname, '../src/lib/lottery-race-view.ts'));

test('actual 3D battle renderer uses larger names and overview restores normal text',()=>{
 const people=Array.from({length:3},(_,index)=>({registrationId:String(index),registration:{guestName:'가상 공 '+index}})),positions=people.map((_,index)=>({index,progress:.4-index*.01,lane:0}));
 for(const [width,height,size] of [[390,520,58.19],[1280,700,83.49]])for(const overview of [false,true]){
  const scene=new LotteryRaceScene({width,height,getContext:()=>fakeGL()}),{ctx,draws}=overlay();
  scene.render(ctx,width,height,people,positions,10000,null,true,null,overview,0,true,true);
  const names=draws.filter(d=>d.text.startsWith('가상 공 '));assert.ok(names.length);assert.ok(names.every(d=>d.font===`900 ${overview?(width<600?11:16):size}px sans-serif`));scene.dispose();
 }
});

test('single-leader battle shot adds another 10 percent zoom while retaining automatic framing',()=>{
 const camera=lotteryRaceBattleCamera([{index:0,progress:.4,lane:0}],1280/700,.4);
 const distance=Math.hypot(...camera.eye.map((v,i)=>v-camera.look[i]));
 assert.ok(Math.abs(distance-208/1.2/1.5/1.2/1.1)<1e-9);assert.ok(Math.abs((208/1.2/1.5/1.2)/distance-1.1)<1e-9);
});

test('battle camera enlarges the nearby podium and keeps all three balls inside the usable frame', () => {
 for (const [width,height] of [[390,520],[1280,700],[1920,1080]]) for (const progress of [.02,.25,.55,.75,.96,1]) {
  const positions=[0,1,2,3].map((index)=>({index,progress:Math.max(0,progress-index*.012),lane:index*.6-.6}));
  const before=JSON.stringify(positions),camera=lotteryRaceBattleCamera(positions,width/height,progress);
  const matrix=raceMatrixMultiply(racePerspective(width/height),raceViewMatrix(camera.eye,camera.look));
  for(const runner of raceBattleGroup(positions)){
   const p=raceCoursePoint(runner.progress),point=[p.x-p.dy*runner.lane*30,p.height+8,p.y+p.dx*runner.lane*30];
   const screen=raceProject(matrix,point,width,height);
   assert.ok(screen&&screen.x>width*.06&&screen.x<width*.94&&screen.y>height*.13&&screen.y<height*.88);
  }
  const normal=lotteryRaceCamera(progress,width/height,false),point=raceCoursePoint(progress);
  const center=[point.x,point.height+8,point.y],close=raceProject(matrix,center,width,height);
  const wide=raceProject(raceMatrixMultiply(racePerspective(width/height,1.15),raceViewMatrix(normal.eye,normal.look)),center,width,height);
  assert.ok(close.scale>wide.scale*1.4,'balls are visibly larger than the standard camera');
  assert.equal(JSON.stringify(positions),before);
 }
 assert.deepEqual(raceBattleGroup([{progress:.8},{progress:.79},{progress:.5}]),[{progress:.8},{progress:.79}]);
 assert.deepEqual(raceBattleGroup([]),[]);
});

test('actual scene switches battle view smoothly and restores overview and participant following',()=>{
 const width=1280,height=700,gl=fakeGL(),scene=new LotteryRaceScene({width,height,getContext:()=>gl}),{ctx}=overlay();
 const people=Array.from({length:4},(_,index)=>({registrationId:String(index),registration:{guestName:'가상 공 '+index}}));
 const positions=people.map((_,index)=>({index,progress:.7-index*.01,lane:0})),before=JSON.stringify(positions);
 const plan=createLotteryRacePlan(4,2,50000,{seed:42});
 scene.render(ctx,width,height,people,positions,1000,null,false,plan,false,0,false,false);
 const original=[...scene.eye];scene.lastPaint=performance.now()-16;
 scene.render(ctx,width,height,people,positions,1100,null,false,plan,false,0,false,true);
 const target=lotteryRaceBattleCamera(positions,width/height,.7);
 assert.notDeepEqual(scene.eye,original);assert.notDeepEqual(scene.eye,target.eye,'no instantaneous cut during playback');
 scene.render(ctx,width,height,people,positions,1200,null,true,null,true,0,false,false);
 assert.deepEqual(scene.eye,lotteryRaceCamera(.7,width/height,true).eye);
 scene.render(ctx,width,height,people,positions,1300,3,true,null,false,0,false,false);
 assert.equal(scene.cameraProgress,positions[3].progress);assert.equal(JSON.stringify(positions),before);scene.dispose();
});

test('actual finish shot adds another ten percent zoom and lowers pitch by ten degrees on mobile and PC',()=>{
 const plan=createLotteryRacePlan(47,5,50000,{seed:42});
 const people=Array.from({length:47},(_,i)=>({registrationId:String(i),registration:{guestName:'가상 선수 '+i}}));
 for(const [width,height]of [[390,470],[1280,700]]){
  for(const [time,zoom,lower]of [[plan.slowMotionStartMs-1000,1.15,0],[plan.slowMotionStartMs,1.15,0],[plan.slowMotionStartMs+800,1.518,10],[plan.slowMotionEndMs+500,1.518,10],[plan.durationMs,1.518,10]]){
   const gl=fakeGL(),scene=new LotteryRaceScene({width,height,getContext:()=>gl}),{ctx}=overlay(),elapsed=raceSimulationTime(plan,time);
   scene.render(ctx,width,height,people,raceSnapshot(plan,elapsed),elapsed,null,false,plan,false,time);
   const camera=lotteryRaceCamera(1,width/height,false,1,lower);
   assert.deepEqual(scene.eye,camera.eye);assert.deepEqual(scene.look,camera.look);
   const expected=Array.from(raceMatrixMultiply(racePerspective(width/height,zoom),raceViewMatrix(camera.eye,camera.look)));
   assert.deepEqual(gl.stats.matrices[0],expected);
   for(const progress of [.91,1]){const p=raceCoursePoint(progress),point=raceProject(expected,[p.x,p.height+8,p.y],width,height);assert.ok(point&&point.x>=0&&point.x<=width&&point.y>=0&&point.y<=height,'gate and chase stay visible');}
   gl.stats.matrices=[];scene.render(ctx,width,height,people,raceSnapshot(plan,elapsed),elapsed,null,true,plan,true,time);
   const full=lotteryRaceCamera(1,width/height,true,1,lower);assert.deepEqual(gl.stats.matrices[0],Array.from(raceMatrixMultiply(racePerspective(width/height,1),raceViewMatrix(full.eye,full.look))));scene.dispose();
  }
  const a=lotteryRaceCamera(1,width/height,false,1),b=lotteryRaceCamera(1,width/height,false,1,10);
  const pitch=c=>Math.atan2(c.eye[1]-c.look[1],Math.hypot(c.eye[0]-c.look[0],c.eye[2]-c.look[2]))*180/Math.PI;
  const distance=c=>Math.hypot(...c.eye.map((v,i)=>v-c.look[i]));
  assert.ok(Math.abs(pitch(a)-pitch(b)-10)<1e-10);assert.ok(Math.abs(distance(a)-distance(b))<1e-8);
 }
});

test('3D perspective projects the look target centrally and rejects points behind the camera', () => {
    for (const [width, height] of [[390, 470], [1280, 700]]) {
        const matrix = raceMatrixMultiply(racePerspective(width / height), raceViewMatrix([100, 300, 400], [100, 0, 100]));
        const center = raceProject(matrix, [100, 0, 100], width, height);
        assert.ok(Math.abs(center.x - width / 2) < .001); assert.ok(Math.abs(center.y - height / 2) < .001);
        assert.equal(raceProject(matrix, [100, 600, 700], width, height), null);
    }
});

test('original cuboids, bowling balls, pins, trees and item diamonds contain finite bounded vertex colors', () => {
    const mesh = new RaceMesh(); mesh.box(0, 10, 20, 8, 20, 6, rgb('#ffaa55'), .3); mesh.cone(10, 0, 0, 20, 50, rgb('#258d44')); mesh.diamond(3, 7, 4, 3, rgb('#56ccff'));
    mesh.bowlingBall(3,8,4,7.2,rgb('#10b6a3'),1.2,.4,3);mesh.bowlingPin(0,0,0,2);
    const values = mesh.array(); assert.ok(values.length > 300); assert.equal(values.length % 18, 0);
    for (let i = 0; i < values.length; i++) { assert.ok(Number.isFinite(values[i])); if (i % 6 >= 3) assert.ok(values[i] >= 0 && values[i] <= 1); }
});

test('marbled balls have three finger holes and rotate by distance instead of spinning while stopped',()=>{
 const ball=new RaceMesh();ball.bowlingBall(0,0,0,7.2,rgb('#10b6a3'));
 const dark=rgb('#111c30');let holes=0;for(let i=0;i<ball.values.length;i+=6)if(dark.every((v,k)=>Math.abs(v-ball.values[i+3+k])<1e-10))holes++;
 assert.equal(holes,90,'three ten-triangle finger holes');
 for(let i=0;i<ball.values.length;i+=6)assert.ok(Math.hypot(...ball.values.slice(i,i+3))<7.3);
 const rolled=new RaceMesh();rolled.bowlingBall(0,0,0,7.2,rgb('#10b6a3'),.7);assert.notDeepEqual(rolled.array(),ball.array());
 const scene=new LotteryRaceScene({width:1280,height:700,getContext:()=>fakeGL()}),mesh=new RaceMesh();
 const a=scene.ball(mesh,{index:0,progress:.2},5000,false,20),b=scene.ball(mesh,{index:0,progress:.2},6000,false,20),c=scene.ball(mesh,{index:0,progress:.21},6100,false,20);
 assert.equal(a.roll,b.roll);assert.notEqual(b.roll,c.roll);scene.dispose();
});

function fakeGL() {
    let serial = 0; const stats = { buffers: 0, programs: 0, drawCalls: 0, allocations:0,updates:0,matrices:[] };
    const gl = new Proxy({
        stats, createShader: () => ({}), getShaderParameter: () => true, createProgram: () => { stats.programs++; return {}; }, getProgramParameter: () => true,
        createBuffer: () => { stats.buffers++; return {}; }, getUniformLocation: () => ({}), getAttribLocation: () => serial++ % 2,
        isContextLost: () => false, deleteBuffer: () => stats.buffers--, deleteProgram: () => stats.programs--,
        bufferData: (_target, values) => { stats.allocations++;if(typeof values==='number'){assert.ok(values>0);return;}for (const v of values) assert.ok(Number.isFinite(v)); },
        bufferSubData:(_target,_offset,values)=>{stats.updates++;for(const v of values)assert.ok(Number.isFinite(v));},
        uniformMatrix4fv: (_location, _transpose, matrix) => {assert.ok(Array.from(matrix).every(Number.isFinite));stats.matrices.push(Array.from(matrix));},
        drawArrays: (_mode, _offset, count) => { assert.ok(count > 0); stats.drawCalls++; },
    }, { get: (obj, key) => key in obj ? obj[key] : key === String(key).toUpperCase() ? 1 : () => {} });
    return gl;
}
function overlay() { const labels = [],draws=[],ops=[]; const ctx = new Proxy({ stroke:()=>ops.push('stroke'),fill:()=>ops.push('fill'),measureText: value => ({ width: value.length * 6 }), fillText: value => {labels.push(value);draws.push({text:value,font:ctx.font});ops.push('text:'+value);} }, { get: (obj, key) => obj[key] || (() => {}), set: (obj, key, value) => { obj[key] = value; return true; } }); return { ctx, labels,draws,ops }; }

test('actual WebGL scene renders mobile/desktop, 120 pickups, item effects, following and overview, then disposes resources', () => {
    const plan = createLotteryRacePlan(80, 20, 50000, { seed: 42 });
    const people = Array.from({ length: 80 }, (_, i) => ({ registrationId: String(i), registration: { guestName: '가상 선수 ' + i } }));
    const gl = fakeGL(), canvas = { width: 1280, height: 700, getContext: () => gl }, scene = new LotteryRaceScene(canvas), { ctx } = overlay();
    for (const [width, height] of [[390, 470], [1280, 700]]) for (const time of [0, 5000, 15000, 25000, plan.simulationEndMs]) for (const overview of [true, false]) scene.render(ctx, width, height, people, raceSnapshot(plan, time), time, 79, false, plan, overview);
    scene.render(ctx, 390, 470, [], [], 0, null, true, null, true);
    assert.ok(gl.stats.drawCalls >= 40); assert.equal(gl.stats.buffers, 3); scene.dispose(); assert.equal(gl.stats.buffers, 0); assert.equal(gl.stats.programs, 0);
});

test('the default camera is elevated from the start and the overview fits the whole course on mobile and PC',()=>{
 for(const [width,height] of [[390,470],[1280,700]])for(const progress of [0,.2,.5,.9,1]){
  const {eye,look}=lotteryRaceCamera(progress,width/height,false);assert.ok(eye[1]-look[1]>=670);assert.ok((eye[1]-look[1])/Math.hypot(eye[0]-look[0],eye[2]-look[2])>1.4);
  const full=lotteryRaceCamera(progress,width/height,true),matrix=raceMatrixMultiply(racePerspective(width/height),raceViewMatrix(full.eye,full.look));
  for(let i=0;i<=100;i++){const p=raceCoursePoint(i/100),screen=raceProject(matrix,[p.x,p.height,p.y],width,height);assert.ok(screen&&screen.x>=0&&screen.x<=width&&screen.y>=0&&screen.y<=height);}
 }
});

test('GPU transforms match the ball rotation and preserve radius and position',()=>{
 const matrix=raceBallMatrix([20,30,40],.7,1.2),origin=[matrix[12],matrix[13],matrix[14]];assert.deepEqual(origin,[20,30,40]);
 for(let axis=0;axis<3;axis++)assert.ok(Math.abs(Math.hypot(matrix[axis*4],matrix[axis*4+1],matrix[axis*4+2])-7.2)<1e-5);
 const out=new Float32Array(16);assert.equal(raceBallMatrix([1,2,3],0,0,7.2,out),out);assert.ok(Array.from(out).every(Number.isFinite));
});

test('camera orbits smoothly to the opposite side after halfway and looks back at the chase',()=>{
 const offset=p=>{const c=lotteryRaceCamera(p,1280/700,false);return c.eye.map((v,i)=>v-c.look[i]);};
 const before=offset(.5),after=offset(.68);
 assert.ok(before[0]>0&&before[2]>0);assert.ok(after[0]<0&&after[2]<0);
 assert.ok(Math.abs(before[0]+after[0])<1e-8&&Math.abs(before[2]+after[2])<1e-8,'opposite sides');
 for(let i=499;i<681;i++){
  const a=lotteryRaceCamera(i/1000,1280/700,false),b=lotteryRaceCamera((i+1)/1000,1280/700,false);
  assert.ok(Math.hypot(...a.eye.map((v,k)=>v-b.eye[k]))<20,'continuous orbit instead of a camera cut');
  assert.ok(Math.hypot(a.eye[0]-a.look[0],a.eye[2]-a.look[2])>390,'orbit never collapses over its target');
 }
 const finish=raceCoursePoint(1),approach=raceCoursePoint(.86),camera=lotteryRaceCamera(1,1280/700,false);
 assert.ok((camera.look[0]-finish.x)*(approach.x-finish.x)+(camera.look[2]-finish.y)*(approach.y-finish.y)>0,'look target favors approaching balls');
});

test('finish view includes the gate and trailing course on mobile and PC',()=>{
 for(const [width,height] of [[390,470],[390,660],[1280,700]]){
  const camera=lotteryRaceCamera(.9,width/height,false,1),matrix=raceMatrixMultiply(racePerspective(width/height),raceViewMatrix(camera.eye,camera.look));
  for(const progress of [.65,.7,.8,.9,1]){
   const p=raceCoursePoint(progress),screen=raceProject(matrix,[p.x,p.height+8,p.y],width,height);
   assert.ok(screen&&screen.x>15&&screen.x<width-15&&screen.y>15&&screen.y<height-15,`${width}: ${progress} visible`);
  }
 }
});

test('late camera side persists through setbacks and manual following; full map remains fixed',()=>{
 const scene=new LotteryRaceScene({width:1280,height:700,getContext:()=>fakeGL()}),{ctx}=overlay(),people=[{registrationId:'1',registration:{guestName:'가상 공'}}],plan=createLotteryRacePlan(1,1,50000,{seed:42});
 scene.render(ctx,1280,700,people,[{index:0,progress:.8}],20000,null,true,plan,false);
 scene.render(ctx,1280,700,people,[{index:0,progress:.45}],21000,0,true,plan,false);
 assert.equal(scene.cameraPhaseProgress,.8);assert.ok(scene.eye[0]<scene.look[0]&&scene.eye[2]<scene.look[2]);
 scene.render(ctx,1280,700,people,[{index:0,progress:.45}],21000,0,true,plan,true);
 assert.deepEqual(scene.eye,lotteryRaceCamera(0,1280/700,true).eye);scene.dispose();
});

test('overview changes work immediately while ready or finished without a running animation loop',()=>{
 const scene=new LotteryRaceScene({width:1280,height:700,getContext:()=>fakeGL()}),{ctx}=overlay(),people=[{registrationId:'1',registration:{guestName:'가상 공'}}];
 scene.render(ctx,1280,700,people,[{index:0,progress:0}],0,null,false,null,false);
 scene.render(ctx,1280,700,people,[{index:0,progress:0}],0,null,false,null,true);
 assert.deepEqual(scene.eye,lotteryRaceCamera(0,1280/700,true).eye);
 const plan=createLotteryRacePlan(1,1,50000,{seed:42}),positions=raceSnapshot(plan,plan.simulationEndMs);
 scene.render(ctx,1280,700,people,positions,plan.simulationEndMs,null,false,plan,false);
 assert.deepEqual(scene.eye,lotteryRaceCamera(1,1280/700,false).eye);scene.dispose();
});

test('hit frames reuse cached ball meshes and allocated GPU storage',()=>{
 let builds=0;const original=RaceMesh.prototype.bowlingBall;
 RaceMesh.prototype.bowlingBall=function(...args){builds++;return original.apply(this,args);};
 let scene;try{
  const gl=fakeGL();scene=new LotteryRaceScene({width:1280,height:700,getContext:()=>gl});assert.equal(builds,8);
  const plan=createLotteryRacePlan(47,5,50000,{seed:42}),time=plan.events.find(e=>e.phase==='hit').time,positions=raceSnapshot(plan,time),people=positions.map(p=>({registrationId:String(p.index),registration:{guestName:'가상 공 '+p.index}})),{ctx}=overlay();
  scene.render(ctx,1280,700,people,positions,time,null,false,plan,false);const allocated=gl.stats.allocations;
  for(let i=1;i<10;i++)scene.render(ctx,1280,700,people,positions,time+i,null,false,plan,false);
  assert.equal(builds,8,'no sphere rebuilds while items hit');assert.equal(gl.stats.allocations,allocated);assert.equal(gl.stats.updates,10);
  const before=scene.cameraProgress;scene.lastPaint=performance.now()-16;scene.render(ctx,1280,700,people,[{index:0,progress:.9}],time+200,null,false,plan,false);assert.ok(scene.cameraProgress>before&&scene.cameraProgress<.9,'leader change eases camera instead of jumping');
 }finally{scene?.dispose();RaceMesh.prototype.bowlingBall=original;}
});

test('unavailable graphics is reported to the caller so the same race can use its 2D fallback', () => {
    assert.throws(() => new LotteryRaceScene({ getContext: () => null }), /WebGL unavailable/);
});

test('actual renderer keeps labels quiet and preserves the followed participant',()=>{
 const plan=createLotteryRacePlan(197,20,50000,{seed:42}),time=plan.simulationEndMs*.55,people=Array.from({length:197},(_,index)=>({registrationId:String(index),registration:{guestName:'선수 '+index}}));
 for(const [width,height,maximum] of [[1280,700,11],[390,520,6]]){
  const scene=new LotteryRaceScene({width,height,getContext:()=>fakeGL()}),{ctx,labels}=overlay();scene.render(ctx,width,height,people,raceSnapshot(plan,time),time,196,true,plan,false);
  const names=labels.filter(t=>t.startsWith('선수 '));assert.ok(names.length>0&&names.length<=maximum);assert.ok(names.includes('선수 196'));scene.dispose();
 }
});

test('arena builds indoor lanes and pins without forest geometry',()=>{
 const originalCone=RaceMesh.prototype.cone,originalPin=RaceMesh.prototype.bowlingPin;let pins=0,scene;
 RaceMesh.prototype.cone=function(){throw Error('Outdoor tree geometry must not be used');};RaceMesh.prototype.bowlingPin=function(...args){pins++;return originalPin.apply(this,args);};
 try{scene=new LotteryRaceScene({width:1280,height:700,getContext:()=>fakeGL()});assert.ok(pins>=44,'practice lanes and finish pins');}finally{scene?.dispose();RaceMesh.prototype.cone=originalCone;RaceMesh.prototype.bowlingPin=originalPin;}
});

test('ready-state bowling balls without a race plan stand in five separate lanes, with a clear start apron',()=>{
 const gl=fakeGL(),scene=new LotteryRaceScene({width:1280,height:700,getContext:()=>gl});
 const positions=Array.from({length:5},(_,index)=>scene.ball(new RaceMesh(),{index,progress:0},0,false,47).point);
 assert.equal(new Set(positions.map(p=>p[2].toFixed(2))).size,5);
 const {ctx,labels}=overlay(),pool=Array.from({length:47},(_,index)=>({registrationId:String(index),registration:{guestName:'가상 러너 '+index}}));
 scene.render(ctx,1280,700,pool,pool.map((_,index)=>({index,progress:0})),0,null,false,null,false);
 assert.ok(labels.includes('START'));scene.dispose();
});

test('finishers continue beyond the line and ease to a stop in separate places',()=>{
 const scene=new LotteryRaceScene({width:1280,height:700,getContext:()=>fakeGL()});
 const points=Array.from({length:20},(_,index)=>scene.ball(new RaceMesh(),{index,progress:1,lane:0,finishMs:20000},26000,false,20).point);
 assert.equal(new Set(points.map(p=>p.map(v=>v.toFixed(2)).join(','))).size,20);
 const point=time=>scene.ball(new RaceMesh(),{index:0,progress:1,lane:0,finishMs:20000},time,false,20).point;
 const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
 assert.ok(distance(point(20000),point(20001))<.1,'no jump on crossing');
 assert.ok(distance(point(22000),point(23000))>distance(point(28000),point(29000)),'finishers decelerate');
 scene.dispose();
});

test('follow view uses exactly 15 percent projection zoom while whole-map view stays unchanged',()=>{
 const width=1280,height=700,gl=fakeGL(),scene=new LotteryRaceScene({width,height,getContext:()=>gl}),{ctx}=overlay(),people=[{registrationId:'1',registration:{guestName:'가상 공'}}],positions=[{index:0,progress:.7}];
 for(const overview of [false,true]){
  const first=gl.stats.matrices.length;scene.render(ctx,width,height,people,positions,10000,null,true,null,overview);
  const expected=raceMatrixMultiply(racePerspective(width/height,overview?1:1.15),raceViewMatrix(scene.eye,scene.look));assert.deepEqual(gl.stats.matrices[first],Array.from(expected));
 }
 const view=raceViewMatrix([100,400,700],[100,0,100]),point=[150,0,100],normal=raceProject(raceMatrixMultiply(racePerspective(width/height),view),point,width,height),zoomed=raceProject(raceMatrixMultiply(racePerspective(width/height,1.15),view),point,width,height);
 assert.ok(Math.abs((zoomed.x-width/2)/(normal.x-width/2)-1.15)<1e-6);scene.dispose();
});


test('actual WebGL overlay uses reduced expanded names and retains the selected racer',()=>{
 const plan=createLotteryRacePlan(47,5,50000,{seed:42}),people=Array.from({length:47},(_,index)=>({registrationId:String(index),registration:{guestName:'확대선수 '+index}}));
 for(const [width,height,size]of [[390,520,11],[1280,700,16]])for(const expanded of [false,true]){
  const scene=new LotteryRaceScene({width,height,getContext:()=>fakeGL()}),{ctx,draws,ops}=overlay();
  scene.render(ctx,width,height,people,raceSnapshot(plan,12000),12000,46,true,plan,false,0,expanded);
  const names=draws.filter(d=>d.text.startsWith('확대선수 '));assert.ok(names.length);assert.ok(names.some(d=>d.text==='확대선수 46'));
  assert.ok(names.every(d=>d.font===(expanded?'900 '+size+'px sans-serif':'800 11px sans-serif')));if(expanded)assert.ok(ops.at(-1).startsWith('text:확대선수 '),'names are above all effect painting');scene.dispose();
 }
});

test('expanded camera adds five percent zoom and ten degrees lower pitch; finish framing and overview remain intact',()=>{const plan=createLotteryRacePlan(47,5,50000,{seed:42}),people=Array.from({length:47},(_,index)=>({registrationId:String(index),registration:{guestName:'공 '+index}}));for(const [width,height] of [[390,520],[1280,700]])for(const overview of [false,true])for(const time of [12000,plan.firstFinishMs+1000]){const gl=fakeGL(),scene=new LotteryRaceScene({width,height,getContext:()=>gl}),{ctx}=overlay();scene.render(ctx,width,height,people,raceSnapshot(plan,time),time,null,true,plan,overview,undefined,true);const finished=time>plan.firstFinishMs,zoom=overview?1:1.15*(finished?1.32:1)*1.1*1.05;const camera=lotteryRaceCamera(scene.cameraProgress,width/height,overview,scene.cameraPhaseProgress,(finished?10:0)+10);assert.deepEqual(scene.eye,camera.eye);assert.deepEqual(scene.look,camera.look);const base=lotteryRaceCamera(scene.cameraProgress,width/height,overview,scene.cameraPhaseProgress,finished?10:0);const pitch=c=>Math.atan2(c.eye[1]-c.look[1],Math.hypot(c.eye[0]-c.look[0],c.eye[2]-c.look[2]))*180/Math.PI;assert.ok(Math.abs(pitch(base)-pitch(camera)-(overview?0:10))<1e-10);assert.deepEqual(gl.stats.matrices[0],Array.from(raceMatrixMultiply(racePerspective(width/height,zoom),raceViewMatrix(scene.eye,scene.look))));scene.dispose();}});

test('expanded pitch applies immediately in ready and finished views and restores on close',()=>{const width=1280,height=700,people=[{registrationId:'1',registration:{guestName:'공'}}],plan=createLotteryRacePlan(1,1,50000,{seed:42});for(const race of [null,plan]){const scene=new LotteryRaceScene({width,height,getContext:()=>fakeGL()}),{ctx}=overlay(),time=race?race.simulationEndMs:0,positions=race?raceSnapshot(race,time):[{index:0,progress:0}];for(const expanded of [false,true,false]){scene.render(ctx,width,height,people,positions,time,null,false,race,false,race?.durationMs??0,expanded);const expected=lotteryRaceCamera(scene.cameraProgress,width/height,false,scene.cameraPhaseProgress,(race?10:0)+(expanded?10:0));assert.deepEqual(scene.eye,expected.eye);assert.deepEqual(scene.look,expected.look);}scene.dispose();}});


test('battle framing follows each next unfinished rank, including the tail, without mutating results',()=>{
 const all=Array.from({length:16},(_,index)=>({index,progress:.96-index*.008,lane:0}));
 for(const finished of [1,5,12,15,16]){
  const positions=all.map((p,i)=>({...p,progress:i<finished?1:p.progress})),before=JSON.stringify(positions);
  const group=raceBattleGroup(positions);
  assert.equal(group[0].index,finished<16?finished:0);
  assert.ok(group.every(p=>finished===16||p.progress<1));
  assert.equal(JSON.stringify(positions),before);
 }
 assert.deepEqual(raceBattleGroup([{progress:1}]),[{progress:1}]);
});

test('actual battle renderer and labels follow remaining ranks after the podium has finished on mobile and PC',()=>{
 const people=Array.from({length:16},(_,index)=>({registrationId:String(index),registration:{guestName:'가상 공 '+index}}));
 for(const [width,height]of [[390,620],[1280,700]])for(const finished of [1,12,15]){
  const positions=people.map((_,index)=>({index,progress:index<finished?1:.6-(index-finished)*.012,lane:0}));
  const before=JSON.stringify(positions),scene=new LotteryRaceScene({width,height,getContext:()=>fakeGL()}),{ctx,draws}=overlay();
  scene.render(ctx,width,height,people,positions,30000,null,true,null,false,0,true,true);
  const expected=lotteryRaceBattleCamera(positions.filter(p=>p.progress<1),width/height,1,10,30000);
  assert.deepEqual(scene.eye,expected.eye);assert.deepEqual(scene.look,expected.look);
  assert.ok(draws.some(d=>d.text==='가상 공 '+finished),'the next unfinished rank remains labelled beyond the first ten');
  assert.equal(JSON.stringify(positions),before);scene.dispose();
 }
});

test('next-rank handover eases camera position rather than cutting to another ball',()=>{
 const plan=createLotteryRacePlan(3,1,50000,{seed:42}),scene=new LotteryRaceScene({width:1280,height:700,getContext:()=>fakeGL()}),{ctx}=overlay();
 const people=Array.from({length:3},(_,index)=>({registrationId:String(index),registration:{guestName:'가상 공 '+index}}));
 const positions=[{index:0,progress:1,finishMs:plan.firstFinishMs,lane:0},{index:1,progress:.95,lane:0},{index:2,progress:.94,lane:0}];
 const beforeTime=plan.slowMotionStartMs+999,afterTime=plan.slowMotionStartMs+1000;
 scene.render(ctx,1280,700,people,positions,raceSimulationTime(plan,beforeTime),null,false,plan,false,beforeTime,true,true);
 const before=[...scene.eye];scene.lastPaint=performance.now()-16;
 const elapsed=raceSimulationTime(plan,afterTime);
 scene.render(ctx,1280,700,people,positions,elapsed,null,false,plan,false,afterTime,true,true);
 const destination=lotteryRaceBattleCamera(positions,1280/700,1,raceFinishView(plan,elapsed,afterTime).lowerDegrees+10,elapsed,false);
 assert.notDeepEqual(scene.eye,before);assert.notDeepEqual(scene.eye,destination.eye);
 assert.ok(Math.hypot(...scene.eye.map((v,i)=>v-before[i]))<Math.hypot(...destination.eye.map((v,i)=>v-before[i])));scene.dispose();
});


test('first finish holds the winner for exactly one real playback second, including slow motion and elapsed fallback',()=>{
 const plan=createLotteryRacePlan(43,5,50000,{seed:42});
 const before=JSON.stringify(plan.order);
 for(const offset of [-1,0,500,999,1000,1001,2000]){
  const playback=plan.slowMotionStartMs+offset,elapsed=raceSimulationTime(plan,playback),expected=offset>=0&&offset<1000;
  assert.equal(raceFirstFinishHold(plan,elapsed,playback),expected);
  assert.equal(raceFirstFinishHold(plan,elapsed),expected);
  const positions=raceSnapshot(plan,elapsed),group=raceBattleGroup(positions,expected);
  if(expected)assert.equal(group[0].index,plan.order[0]);
  else if(offset>=1000&&positions.some(p=>p.progress<1))assert.ok(group.every(p=>p.progress<1));
 }
 assert.equal(JSON.stringify(plan.order),before);assert.equal(raceFirstFinishHold(null,1000,1000),false);
});

test('actual 3D battle camera and name highlight hold the first arrival then hand over at one second on mobile and PC',()=>{
 const plan=createLotteryRacePlan(43,5,50000,{seed:42}),people=Array.from({length:43},(_,index)=>({registrationId:String(index),registration:{guestName:'가상 공 '+index}}));
 for(const [width,height]of [[390,620],[1280,700]])for(const offset of [0,999,1000]){
  const playback=plan.slowMotionStartMs+offset,elapsed=raceSimulationTime(plan,playback),positions=raceSnapshot(plan,elapsed),hold=offset<1000;
  const scene=new LotteryRaceScene({width,height,getContext:()=>fakeGL()}),{ctx}=overlay();const gold=[];
  ctx.fillText=text=>{if(ctx.fillStyle==='#483009')gold.push(text);};
  scene.render(ctx,width,height,people,positions,elapsed,null,true,plan,false,playback,true,true);
  const lower=raceFinishView(plan,elapsed,playback,true).lowerDegrees+10,expected=lotteryRaceBattleCamera(positions,width/height,1,lower,elapsed,hold);
  assert.deepEqual(scene.eye,expected.eye);assert.deepEqual(scene.look,expected.look);
  const subject=raceBattleGroup(positions,hold)[0];assert.ok(gold.includes('가상 공 '+subject.index));
  assert.equal(subject.index===plan.order[0],hold);scene.dispose();
 }
});
