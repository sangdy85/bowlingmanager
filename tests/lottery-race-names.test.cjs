const assert=require('node:assert/strict'),{test}=require('node:test'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const moduleUnderTest={exports:{}};new Function('module','exports',ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/lib/lottery-race-labels.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(moduleUnderTest,moduleUnderTest.exports);
const {layoutRaceNames,raceNameStyle,paintRaceNames}=moduleUnderTest.exports;
const people=Array.from({length:197},(_,index)=>({index,rank:index,text:'선수 '+index,x:180+index%3*80,y:220+index%5*28,priority:index<3,gold:index===0}));
const measure=text=>text.length*6;
function check(labels,width,height){for(const p of labels)assert.ok(p.x-p.w/2>=0&&p.x+p.w/2<=width&&p.y>=24&&p.y<=height-54);for(let a=0;a<labels.length;a++)for(let b=a+1;b<labels.length;b++)assert.ok(Math.abs(labels[a].x-labels[b].x)>=(labels[a].w+labels[b].w)/2||Math.abs(labels[a].y-labels[b].y)>=23);}
test('desktop only labels the first ten ranks, rather than a grid of the whole field',()=>{const labels=layoutRaceNames(people,1280,700,measure);assert.ok(labels.length>0&&labels.length<=10);assert.ok(labels.every(p=>p.rank<10));check(labels,1280,700);});
test('mobile only labels the first five ranks',()=>{const labels=layoutRaceNames(people,390,520,measure);assert.ok(labels.length>0&&labels.length<=5);assert.ok(labels.every(p=>p.rank<5));check(labels,390,520);});
test('a followed participant outside the leaders still gets a highlighted label',()=>{const input=people.map(p=>p.index===196?{...p,gold:true,x:220,y:350}:p);const labels=layoutRaceNames(input,390,520,measure);assert.ok(labels.some(p=>p.index===196&&p.gold));assert.ok(labels.length<=6);check(labels,390,520);});
test('names remain attached locally without rotating through unrelated racers',()=>{const first=layoutRaceNames(people,1280,700,measure);assert.deepEqual(layoutRaceNames(people,1280,700,measure),first);for(const label of first)assert.ok(Math.abs(label.y-label.anchorY)<=72);});
test('empty, crowded and long names stay bounded and do not overlap',()=>{assert.deepEqual(layoutRaceNames([],320,400,measure),[]);const labels=layoutRaceNames(people.map(p=>({...p,x:160,y:210,text:'아주긴이름'.repeat(20)})),320,400,measure);assert.ok(labels.length<=5&&labels.every(p=>p.text.endsWith('…')));check(labels,320,400);});

test('dense short names can show all ten desktop leaders or all five mobile leaders',()=>{for(const [width,count] of [[1280,10],[390,5]]){const labels=layoutRaceNames(people.map(p=>({...p,x:width/2,y:220})),width,520,measure);assert.equal(labels.length,count);check(labels,width,520);}});

test('expanded names use half-sized bounded fonts and matching collision boxes on mobile/tablet/desktop',()=>{
 for(const [width,size,count]of [[390,11,5],[800,13,10],[1280,16,10]]){
  const style=raceNameStyle(width,true);assert.equal(style.size,size);assert.equal(raceNameStyle(width).size,11);
  const labels=layoutRaceNames(people.map(p=>({...p,x:width/2,y:260})),width,620,text=>text.length*size*.55,true);
  assert.equal(labels.length,count);assert.ok(labels.every(p=>p.rank<count));
  for(const p of labels){assert.ok(p.x-p.w/2>=0&&p.x+p.w/2<=width);assert.ok(p.y-style.top>=0&&p.y-style.top+style.h<=620);}
  for(let a=0;a<labels.length;a++)for(let b=a+1;b<labels.length;b++)assert.ok(Math.abs(labels[a].x-labels[b].x)>=(labels[a].w+labels[b].w)/2||Math.abs(labels[a].y-labels[b].y)>=style.h+style.gap);
 }
});

test('expanded long names truncate safely and the actual painter uses the measured font and box height',()=>{
 for(const width of [320,1280]){
  const style=raceNameStyle(width,true),names=layoutRaceNames(people.map(p=>({...p,x:width/2,y:240,text:'아주긴선수이름'.repeat(20)})),width,620,text=>text.length*style.size*.55,true);
  assert.ok(names.length&&names.every(n=>n.text.endsWith('…')));
  const boxes=[],draws=[],ctx=new Proxy({save(){},restore(){},roundRect:(...args)=>boxes.push(args),fillText:(text)=>draws.push({text,font:ctx.font})},{get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>{o[k]=v;return true;}});
  paintRaceNames(ctx,names,width,true);assert.equal(draws.length,names.length);assert.ok(draws.every(d=>d.font===style.font));assert.ok(boxes.every(b=>b[3]===style.h));
 }
});

test('expanded label padding, height and radius are half their previous size',()=>{for(const [width,oldSize] of [[390,22],[800,26],[1280,32]]){const s=raceNameStyle(width,true);assert.equal(s.size,oldSize/2);assert.equal(s.h,(oldSize+14)/2);assert.equal(s.top,(oldSize+6)/2);assert.equal(s.pad,10);assert.equal(s.gap,3);assert.equal(s.radius,4);}});
