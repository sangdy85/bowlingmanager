const assert = require('node:assert/strict');
const {test} = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {randomUUID} = require('node:crypto');
const {execFileSync} = require('node:child_process');
const {createRequire} = require('node:module');
const ts = require('typescript');
const {PrismaClient} = require('@prisma/client');
function load(relative, overrides = {}, cache = new Map()) {
  const filename = path.resolve(__dirname,'..',relative);
  if(cache.has(filename)) return cache.get(filename).exports;
  const module = {exports:{}}; cache.set(filename,module);
  const native = createRequire(filename);
  const req = id => Object.hasOwn(overrides,id) ? overrides[id] : id.startsWith('@/') ? load('src/'+id.slice(2)+'.ts',overrides,cache) : native(id);
  const output = ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  new Function('require','module','exports',output)(req,module,module.exports);
  return module.exports;
}
const r = load('src/lib/king-perfect/rules.ts');
function confirmedRules() { return {...r.defaultRules(),selection:'BEST',qualifyingConfirmed:true,gamesConfirmed:{ROUND1:true,ROUND2:true,FINAL:true},scoring:{ROUND1:'SUM',ROUND2:'SUM',FINAL:'SUM'},mappingConfirmed:true,handicapCap:'LEAGUE_300'}; }
function fixture() {
  const records = [['현희승',279,0],['김영재',262,0],['조승희',255,6],['박용제',259,0],
    ...Array.from({length:16},(_,i)=>['테스트선수'+i,258-i,0]),['배영호',203,7],['김동숙',192,12],['성완수',168,15],['김준형',179,3],['조달호',180,1]];
  return records.map(([name,raw,handicap],i)=>({id:'e'+i,name,eligibility:'APPROVED',athlete:false,cancelled:false,attempts:[{id:'a'+i,raw,handicap,converted:raw+handicap,voided:false,createdAt:new Date('2026-10-01T00:00:00Z')}]}));
}
test('KING PERFECT only identifies CUSTOM and tolerates invalid legacy settings',()=>{
  assert.equal(r.isKingPerfect('CUSTOM','{"customMode":"KING_PERFECT"}'),true);
  for(const type of ['LEAGUE','EVENT','CHAMP']) assert.equal(r.isKingPerfect(type,'{"customMode":"KING_PERFECT"}'),false);
  assert.equal(r.isKingPerfect('CUSTOM',null),false); assert.equal(r.isKingPerfect('CUSTOM','broken'),false);
});
test('third Sunday is stable in Asia/Seoul, including year boundary',()=>{
  for(const [month,day] of [['2026-10',18],['2026-11',15],['2026-12',20],['2027-01',17]]) {
    const {startsAt,practiceAt}=r.monthlySchedule(month); assert.equal(startsAt.toISOString(),month+'-'+day+'T10:00:00.000Z');assert.equal(+startsAt-+practiceAt,600000);
  }
  assert.throws(()=>r.monthlySchedule('2026-13')); assert.throws(()=>r.monthlySchedule('bad'));
});
test('example conversion is additive; final always scratch; league cap explicit',()=>{
  assert.equal(r.convertedScore(255,6,'QUALIFYING',null),261);
  assert.equal(r.convertedScore(300,15,'QUALIFYING',null),315);
  assert.equal(r.convertedScore(300,15,'ROUND1','LEAGUE_300'),300);
  assert.equal(r.convertedScore(0,15,'FINAL',null),0);
  assert.equal(r.convertedScore(270,30,'FINAL','UNCAPPED'),270);
  for(const score of [-1,301,0.5,NaN,'200']) assert.throws(()=>r.convertedScore(score,0,'QUALIFYING',null));
  assert.throws(()=>r.convertedScore(100,0,'ROUND1',null));
});
test('25-person fixture selects exactly 24 with cutoff 182, excluding 181',()=>{
  const q=r.selectQualifiers(fixture(),confirmedRules()); assert.equal(q.length,24);
  assert.equal(q[23].name,'김준형');assert.equal(q[23].total,182);assert.ok(!q.some(x=>x.name==='조달호'));
  assert.equal(q[2].attempt.raw,255);assert.equal(q[2].total,261);
});
test('all seeding ties including cutoff require explicit adjudication',()=>{
  const entries=fixture();entries[24].attempts[0].converted=182;
  assert.throws(()=>r.selectQualifiers(entries,confirmedRules()),/동점/);
  assert.equal(r.selectQualifiers(entries,confirmedRules(),['e24','e23'])[23].entryId,'e24');
  assert.throws(()=>r.selectQualifiers(entries,confirmedRules(),['e24','e24']),/중복/);
});
test('repeat attempts choose BEST or LATEST while retaining all attempts',()=>{
  const entries=fixture(); entries[24].attempts.push({...entries[24].attempts[0],id:'later',converted:299,raw:298,createdAt:new Date('2026-10-02')});
  entries[24].attempts.push({...entries[24].attempts[0],id:'latest',converted:100,raw:99,createdAt:new Date('2026-10-03')});
  assert.equal(r.qualificationRanking(entries,confirmedRules())[0].entryId,'e24');
  assert.equal(r.qualificationRanking(entries,{...confirmedRules(),selection:'LATEST'}).at(-1).entryId,'e24');
  assert.equal(entries[24].attempts.length,3);
});
test('unapproved, pro and cancelled entrants are excluded regardless of score',()=>{
  const entries=fixture();entries[0].athlete=true;entries[1].eligibility='PENDING';entries[2].cancelled=true;
  assert.equal(r.qualificationRanking(entries,confirmedRules()).length,22);assert.throws(()=>r.selectQualifiers(entries,confirmedRules()),/24명/);
});
test('12 prescribed matches cover all 24 seeds and exact four lane pairs',()=>{
  const names=Array.from({length:24},(_,i)=>String(i+1));const matches=r.round1Assignments(names,r.defaultRules().lanes);
  assert.deepEqual(matches.map(m=>m.entryIds.map(Number)),r.PAIRS);
  assert.deepEqual(matches.map(m=>m.lanes),Array.from({length:12},(_,i)=>[9+Math.floor(i/3)*2,10+Math.floor(i/3)*2]));
  assert.equal(new Set(matches.flatMap(m=>m.entryIds)).size,24);
});
test('incomplete games block confirmation but zero is a valid score',()=>{
  assert.throws(()=>r.matchResults([{entryId:'a',handicap:0,games:[]}],'ROUND1',confirmedRules()),/미입력/);
  assert.throws(()=>r.matchResults([{entryId:'a',handicap:0,games:[{number:1,raw:null}]}],'ROUND1',confirmedRules()),/미입력/);
  assert.equal(r.matchResults([{entryId:'a',handicap:50,games:[{number:1,raw:0}]}],'FINAL',confirmedRules())[0].total,0);
});
test('configuration rejects invalid mappings, lanes, games, implicit timezone and unconfirmed rules',()=>{
  for(const change of [{round2Mapping:[[1,1,3],[4,5,6],[7,8,9],[10,11,12]]},{lanes:[[9,10],[9,11],[12,13],[14,15]]},{games:{ROUND1:0,ROUND2:1,FINAL:1}},{registrationStart:'2026-10-01T19:00'},{selection:'SUM'}]) assert.throws(()=>r.validateRules({...confirmedRules(),...change}));
  assert.throws(()=>r.selectQualifiers(fixture(),r.defaultRules()),/확인/);
  assert.throws(()=>r.matchResults([{entryId:'a',handicap:0,games:[{number:1,raw:20}]}],'FINAL',r.defaultRules()),/게임 수/);
});
test('prize base remains unknown until explicit confirmation and excludes cancelled/refunded',()=>{
  const fees=[{stage:'QUALIFYING',amount:1000,status:'PAID'},{stage:'QUALIFYING',amount:1000,status:'UNPAID'},{stage:'ROUND1',amount:10000,status:'PAID'},{stage:'QUALIFYING',amount:1000,status:'REFUNDED'}];
  assert.equal(r.prizeAmounts(r.defaultRules(),fees),null);
  assert.deepEqual(r.prizeAmounts({...confirmedRules(),prizeConfirmed:true,prizeBasis:'PAID'},fees).amounts,[200500,100300,50100,50000]);
  assert.equal(r.prizeAmounts({...confirmedRules(),prizeConfirmed:true,prizeBasis:'CHARGED'},fees).base,2000);
  assert.throws(()=>r.prizeAmounts({...confirmedRules(),prizeConfirmed:true,prizeBasis:'MANUAL',prizeBase:1},fees),/원 단위/);
});
test('multi-game SUM and BEST_GAME use confirmed operator choice; final ignores all handicaps',()=>{
  const seats=[{entryId:'a',handicap:99,games:[{number:1,raw:300},{number:2,raw:0}]},{entryId:'b',handicap:0,games:[{number:1,raw:200},{number:2,raw:200}]}];
  const rules={...confirmedRules(),games:{ROUND1:2,ROUND2:2,FINAL:2}};
  assert.equal(r.matchResults(seats,'FINAL',rules)[0].entryId,'b');
  assert.equal(r.matchResults(seats,'FINAL',{...rules,scoring:{...rules.scoring,FINAL:'BEST_GAME'}})[0].entryId,'a');
  assert.throws(()=>r.matchResults(seats,'FINAL',{...rules,scoring:{...rules.scoring,FINAL:null}}),/반영 방식/);
  const tie=seats.map(s=>({...s,handicap:0,games:[{number:1,raw:200},{number:2,raw:200}]}));
  assert.throws(()=>r.matchResults(tie,'FINAL',rules),/동점/);
  assert.equal(r.matchResults(tie,'FINAL',rules,['b','a'])[0].entryId,'b');
});

test('isolated migrated SQLite: complete operational flow, authorization, concurrency and rollback', {timeout:180000}, async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'king-perfect-'));
  const url='file:'+path.join(dir,'isolated.db').replace(/\\/g,'/');
  let db=new PrismaClient({datasources:{db:{url}}});
  const oldEnabled=process.env.KING_PERFECT_CENTER_IDS;process.env.KING_PERFECT_CENTER_IDS='kp-center';
  try {
    await db.$queryRawUnsafe('SELECT 1');await db.$disconnect();
    execFileSync(process.execPath,['node_modules/prisma/build/index.js','migrate','deploy'],{cwd:path.resolve(__dirname,'..'),env:{...process.env,DATABASE_URL:url,CHECKPOINT_DISABLE:'1'},stdio:'pipe'});
    db=new PrismaClient({datasources:{db:{url}}});
    const s=load('src/lib/king-perfect/service.ts',{'@/lib/prisma':{__esModule:true,default:db}});
    await db.user.createMany({data:[{id:'owner',name:'관리자',email:'owner@example.invalid'},{id:'other',name:'다른 관리자',email:'other@example.invalid'}]});
    await db.bowlingCenter.create({data:{id:'kp-center',name:'테스트 퍼펙트',code:'KPTEST',address:'fixture',ownerId:'owner'}});
    await db.bowlingCenter.create({data:{id:'foreign',name:'퍼펙트볼링센터',code:'OTHER',address:'fixture',ownerId:'other'}});
    const creation=randomUUID();
    let tournamentId,editionId;
    await t.test('creation requires both actual center permission and server allowlist; name cannot grant access',async()=>{
      await assert.rejects(s.createKingPerfect('other','kp-center','KP','2026-10',randomUUID()),/권한/);
      await assert.rejects(s.createKingPerfect('other','foreign','KP','2026-10',randomUUID()),/활성화/);
      tournamentId=await s.createKingPerfect('owner','kp-center','KP','2026-10',creation);editionId=creation;
      assert.equal(await s.createKingPerfect('owner','kp-center','KP','2026-10',creation),tournamentId);
      assert.equal(await db.leagueRound.count({where:{tournamentId}}),0);
      assert.equal((await db.tournament.findUnique({where:{id:tournamentId}})).maxParticipants,24);
    });
    const view=()=>s.getKingPerfectAdmin('owner',editionId);
    const command=async(action,data={},reason='테스트 운영 확인')=>({action,data,reason,requestKey:randomUUID(),revision:(await view()).revision});
    const run=async(action,data={},reason)=>s.executeKingPerfect('owner',editionId,await command(action,data,reason));
    await t.test('read, member search and mutations reject other center administrators',async()=>{
      await assert.rejects(s.getKingPerfectAdmin('other',editionId),/권한/);
      await assert.rejects(s.searchKingPerfectMembers('other',editionId,'테스트'),/권한/);
      await assert.rejects(s.executeKingPerfect('other',editionId,await command('CLOSE')),/권한/);
    });
    await run('SETTINGS',{rules:confirmedRules()});
    for(const [i,entry] of fixture().entries()) {
      await db.user.create({data:{id:'u'+i,name:entry.name,email:'p'+i+'@example.invalid',handicap:entry.attempts[0].handicap}});
      await db.centerMember.create({data:{id:'m'+i,centerId:'kp-center',userId:'u'+i}});
      await run('REGISTER',{memberId:'m'+i});
    }
    const entrants=() => db.kingPerfectEntry.findMany({where:{editionId},orderBy:{memberId:'asc'}});
    let entries=await entrants();
    await t.test('registration is unique, non-members blocked, athlete cannot be approved',async()=>{
      await assert.rejects(run('REGISTER',{memberId:'m0'}));
      await db.centerMember.create({data:{id:'foreign-member',centerId:'foreign',userId:'other'}});
      await assert.rejects(run('REGISTER',{memberId:'foreign-member'}),/해당 센터 회원/);
      await assert.rejects(run('ATTEMPT',{entryId:entries[0].id,raw:200,freeGame:false}),/자격/);
      await assert.rejects(run('ELIGIBILITY',{entryId:entries[0].id,eligibility:'APPROVED',athlete:true,cancelled:false,handicap:0}),/선수/);
    });
    for(const entry of entries) await run('ELIGIBILITY',{entryId:entry.id,eligibility:'APPROVED',athlete:false,cancelled:false,handicap:entry.handicap});
    for(const entry of entries) {const i=Number(entry.memberId.slice(1)); await run('ATTEMPT',{entryId:entry.id,raw:fixture()[i].attempts[0].raw,freeGame:false});}
    await t.test('attempt and 1000-won fee are atomic and replay-safe; free games rejected',async()=>{
      const entry=entries[0],cmd=await command('ATTEMPT',{entryId:entry.id,raw:20,freeGame:false});
      await s.executeKingPerfect('owner',editionId,cmd);await s.executeKingPerfect('owner',editionId,cmd);
      assert.equal(await db.kingPerfectAttempt.count(),26);assert.equal(await db.kingPerfectFee.count(),26);
      assert.equal((await db.kingPerfectFee.aggregate({_sum:{amount:true}}))._sum.amount,26000);
      await assert.rejects(s.executeKingPerfect('owner',editionId,{...cmd,data:{...cmd.data,raw:21}}),/요청 키/);
      await assert.rejects(run('ATTEMPT',{entryId:entry.id,raw:100,freeGame:true}),/프리게임/);
    });
    await t.test('stale revisions fail without side effects and simultaneous requests cannot both commit',async()=>{
      const cmd=await command('ELIGIBILITY',{entryId:entries[0].id,eligibility:'APPROVED',athlete:false,cancelled:false,handicap:0});
      const out=await Promise.allSettled([s.executeKingPerfect('owner',editionId,cmd),s.executeKingPerfect('owner',editionId,{...cmd,requestKey:randomUUID()})]);
      assert.equal(out.filter(x=>x.status==='fulfilled').length,1);
      await assert.rejects(s.executeKingPerfect('owner',editionId,{...cmd,requestKey:randomUUID()}),/새로고침/);
    });
    await t.test('score correction refreshes ranking, then seeded snapshot locks qualifying records',async()=>{
      const entry=entries.find(e=>e.memberId==='m24');const a=await db.kingPerfectAttempt.findFirst({where:{entryId:entry.id}});
      await run('EDIT_ATTEMPT',{entryId:entry.id,attemptId:a.id,raw:280,handicap:1,voided:false});
      assert.equal((await view()).ranking[0].entryId,entry.id);
      await run('EDIT_ATTEMPT',{entryId:entry.id,attemptId:a.id,raw:180,handicap:1,voided:false});
      await run('CLOSE');await run('QUALIFIERS',{tieOrder:[]});
      const before=await db.kingPerfectSeed.findMany({orderBy:{position:'asc'}});
      assert.equal(before.length,24);assert.equal(before[23].converted,182);assert.ok(!before.some(s=>s.entryId===entry.id));
      await assert.rejects(run('EDIT_ATTEMPT',{entryId:entry.id,attemptId:a.id,raw:300,handicap:1,voided:false}),/잠금/);
      assert.deepEqual(await db.kingPerfectSeed.findMany({orderBy:{position:'asc'}}),before);
    });
    await t.test('seed swaps are explicit and logged, and generated exact bracket cannot duplicate',async()=>{
      const seeds=await db.kingPerfectSeed.findMany({orderBy:{position:'asc'}});
      await run('SWAP_SEEDS',{first:seeds[0].entryId,second:seeds[1].entryId});
      await run('SWAP_SEEDS',{first:seeds[0].entryId,second:seeds[1].entryId});
      const cmd=await command('GENERATE',{stage:'ROUND1'});await s.executeKingPerfect('owner',editionId,cmd);await s.executeKingPerfect('owner',editionId,cmd);
      const v=await view();assert.equal(v.matches.length,12);
      for(const m of v.matches) { assert.deepEqual(m.seats.map(s=>seeds.findIndex(x=>x.entryId===s.entryId)+1),r.PAIRS[m.slot-1]);assert.deepEqual(JSON.parse(m.lanes),[9+m.tableIndex*2,10+m.tableIndex*2]); }
      assert.equal(v.entries.flatMap(x=>x.fees).filter(f=>f.stage==='ROUND1').length,24);
      await assert.rejects(run('GENERATE',{stage:'ROUND2'}),/이전 단계/);
    });
    await run('START',{stage:'ROUND1'});
    await t.test('draft missing and invalid scores cannot confirm; zero saves as zero',async()=>{
      const m=(await view()).matches[0];
      await assert.rejects(run('CONFIRM_MATCH',{matchId:m.id}),/미입력/);
      await assert.rejects(run('SCORES',{matchId:m.id,scores:[{entryId:m.seats[0].entryId,number:1,raw:301}]}),/원점수/);
      await assert.rejects(run('SCORES',{matchId:m.id,scores:[{entryId:'foreign',number:1,raw:200}]}),/참가자/);
      await run('SCORES',{matchId:m.id,scores:[{entryId:m.seats[0].entryId,number:1,raw:0}]});
      assert.equal((await db.kingPerfectGame.findFirst()).raw,0);
      await assert.rejects(run('END_STAGE',{stage:'ROUND1'}),/모든 경기/);
    });
    await t.test('side participation is independent and a one-game ball side is rejected',async()=>{
      const m=(await view()).matches[0];
      await run('SIDE',{stage:'ROUND1',entryId:m.seats[0].entryId,category:'STANDARD',enabled:true});
      await assert.rejects(run('SIDE',{stage:'ROUND1',entryId:m.seats[0].entryId,category:'BALL',enabled:true}),/2게임/);
      assert.equal((await view()).matches[0].confirmed,false);
    });
    for(const stage of ['ROUND1','ROUND2','FINAL']) {
      if(stage!=='ROUND1'){await run('GENERATE',{stage});await run('START',{stage});}
      await t.test(stage+' advances exact counts and stores scratch/converted results',async()=>{
        const v=await view(),matches=v.matches.filter(m=>m.stage===stage);
        assert.equal(matches.length,stage==='ROUND1'?12:stage==='ROUND2'?4:1);
        assert.equal(matches.flatMap(m=>m.seats).length,stage==='ROUND1'?24:stage==='ROUND2'?12:4);
        if(stage==='ROUND2') await run('SIDE',{stage,entryId:matches[0].seats[0].entryId,category:'STANDARD',enabled:true});
        for(const m of matches) {
          await run('SCORES',{matchId:m.id,scores:m.seats.map((s,i)=>({entryId:s.entryId,number:1,raw:250-i*50}))});
          await run('CONFIRM_MATCH',{matchId:m.id});
          await assert.rejects(run('SCORES',{matchId:m.id,scores:[{entryId:m.seats[0].entryId,number:1,raw:299}]}),/미확정/);
        }
        await run('END_STAGE',{stage});
        const updated=(await view()).matches.filter(m=>m.stage===stage);
        assert.equal(updated.flatMap(m=>m.seats).filter(s=>s.rank===1).length,matches.length);
        if(stage==='FINAL') for(const s of updated[0].seats){assert.equal(s.handicap,0);assert.equal(s.total,s.rawTotal);}
      });
    }
    await t.test('final four are ranked 1-4; settlement requires explicit base and locks ledger',async()=>{
      const v=await view();assert.equal(v.state,'FINISHED');
      assert.deepEqual(v.matches.find(m=>m.stage==='FINAL').seats.map(s=>s.rank),[1,2,3,4]);
      await assert.rejects(run('SETTLE'),/시상 기준/);
      const fee=v.entries.flatMap(e=>e.fees).find(f=>f.stage==='QUALIFYING');
      await run('FEE',{feeId:fee.id,status:'PAID',amount:1000});
      await run('SETTLEMENT_SETTINGS',{prizeBasis:'PAID',prizeBase:null,prizeConfirmed:true});
      const cmd=await command('SETTLE');await s.executeKingPerfect('owner',editionId,cmd);await s.executeKingPerfect('owner',editionId,cmd);
      assert.deepEqual((await view()).settlement.amounts,[200500,100300,50100,50000]);
      await assert.rejects(run('FEE',{feeId:fee.id,status:'REFUNDED',amount:1000}),/원장/);
      await run('PUBLISH',{published:true});assert.equal((await view()).published,true);
    });
    await t.test('lottery uses selected candidates, excludes all prize winners and avoids duplicate winners',async()=>{
      await run('DRAW',{scope:'ALL',count:5,excludeRankers:true});
      await run('DRAW',{scope:'ALL',count:5,excludeRankers:true});
      const v=await view(),winners=v.entries.filter(e=>e.luckyWin).map(e=>e.id);
      assert.equal(winners.length,10);assert.equal(new Set(winners).size,10);
      assert.ok(v.matches.find(m=>m.stage==='FINAL').seats.every(s=>!winners.includes(s.entryId)));
    });
    await t.test('new month keeps old results; same month cannot be generated twice',async()=>{
      await run('NEW_EDITION',{month:'2026-11'});
      await assert.rejects(run('NEW_EDITION',{month:'2026-11'}));
      assert.equal(await db.kingPerfectEdition.count(),2);assert.equal((await view()).state,'FINISHED');
      assert.ok((await view()).settlement);
    });
    await t.test('per-attempt limit, void/restore ledger and unverified advancement are enforced by server',async()=>{
      const next=await db.kingPerfectEdition.findUnique({where:{tournamentId_month:{tournamentId,month:'2026-11'}}});
      const nextRun=async(action,data={})=>s.executeKingPerfect('owner',next.id,{action,data,reason:'제한 및 설정 검증',requestKey:randomUUID(),revision:(await db.kingPerfectEdition.findUnique({where:{id:next.id}})).revision});
      await nextRun('SETTINGS',{rules:{...confirmedRules(),attemptLimit:1,mappingConfirmed:false}});
      await nextRun('REGISTER',{memberId:'m0'});
      const entry=await db.kingPerfectEntry.findUnique({where:{editionId_memberId:{editionId:next.id,memberId:'m0'}}});
      await nextRun('ELIGIBILITY',{entryId:entry.id,eligibility:'APPROVED',athlete:false,cancelled:false,handicap:0});
      await nextRun('ATTEMPT',{entryId:entry.id,raw:0,freeGame:false});
      await assert.rejects(nextRun('ATTEMPT',{entryId:entry.id,raw:200,freeGame:false}),/횟수/);
      const a=await db.kingPerfectAttempt.findFirst({where:{entryId:entry.id}});
      await nextRun('EDIT_ATTEMPT',{entryId:entry.id,attemptId:a.id,raw:0,handicap:0,voided:true});
      assert.equal((await db.kingPerfectFee.findFirst({where:{source:a.id}})).status,'CANCELLED');
      await nextRun('EDIT_ATTEMPT',{entryId:entry.id,attemptId:a.id,raw:0,handicap:0,voided:false});
      assert.equal((await db.kingPerfectFee.findFirst({where:{source:a.id}})).status,'UNPAID');
      await assert.rejects(nextRun('GENERATE',{stage:'ROUND2'}),/이전 단계/);
      await nextRun('CLOSE');await assert.rejects(nextRun('QUALIFIERS'),/24명/);
    });
    await t.test('reopening 1R archives history, clears descendants/public awards and preserves fee ledger',async()=>{
      const count=await db.kingPerfectFee.count();await run('REOPEN',{target:'ROUND1'},'1R 오입력 발견, 후속 결과 재확정');
      const v=await view();assert.equal(v.state,'ROUND1_ACTIVE');assert.equal(v.matches.length,12);
      assert.ok(v.matches.every(m=>!m.confirmed && m.seats.every(s=>s.rank===null)));
      assert.equal(v.settlement,null);assert.equal(v.published,false);assert.equal(v.entries.filter(e=>e.luckyWin).length,0);
      assert.equal(await db.kingPerfectFee.count(),count);
      const audit=await db.kingPerfectAudit.findFirst({where:{action:'REOPEN'}});
      assert.equal(JSON.parse(audit.before).state,'FINISHED');assert.equal(JSON.parse(audit.before).matches.length,17);
      assert.equal(JSON.parse(audit.after).state,'ROUND1_ACTIVE');
      assert.equal(v.entries.flatMap(x=>x.sideEntries).filter(x=>x.stage==='ROUND2').length,0);
      assert.equal(v.entries.flatMap(x=>x.sideEntries).filter(x=>x.stage==='ROUND1').length,1);
      assert.equal(JSON.parse(audit.before).entries.flatMap(x=>x.sideEntries).filter(x=>x.stage==='ROUND2').length,1);
    });
    await t.test('special winner adjudication requires full roster and confirmation and remains audited',async()=>{
      const m=(await view()).matches[0],order=m.seats.map(s=>s.entryId).reverse();
      await assert.rejects(run('CONFIRM_MATCH',{matchId:m.id,overrideOrder:order}),/특별 판정/);
      await assert.rejects(run('CONFIRM_MATCH',{matchId:m.id,overrideOrder:[order[0],order[0]],exceptionConfirmed:true}),/특별 판정/);
      await run('CONFIRM_MATCH',{matchId:m.id,overrideOrder:order,exceptionConfirmed:true},'주최측 특별승인 검증');
      const match=(await view()).matches.find(x=>x.id===m.id);assert.equal(match.seats.find(s=>s.rank===1).entryId,order[0]);
      const audit=await db.kingPerfectAudit.findFirst({where:{reason:'주최측 특별승인 검증'}});assert.ok(JSON.parse(audit.payload).data.exceptionConfirmed);
    });
    await t.test('FK restrictions protect history; public/client payload omits center/user relations',async()=>{
      await assert.rejects(db.tournament.delete({where:{id:tournamentId}}));
      await assert.rejects(db.centerMember.delete({where:{id:'m0'}}));
      const v=await view();assert.equal(v.tournament,undefined);assert.equal(v.entries[0].member,undefined);
      assert.equal(await db.leagueRound.count(),0);
    });
    await t.test('reopening qualifying clears all stale side rosters while preserving audited history',async()=>{
      await run('REOPEN',{target:'QUALIFYING'},'예선부터 대진과 사이드 참가 재선정');
      const v=await view();
      assert.equal(v.matches.length,0);
      assert.equal(v.entries.flatMap(x=>x.sideEntries).length,0);
      const audit=await db.kingPerfectAudit.findFirst({where:{reason:'예선부터 대진과 사이드 참가 재선정'}});
      assert.equal(JSON.parse(audit.before).entries.flatMap(x=>x.sideEntries).length,1);
      assert.equal(JSON.parse(audit.after).entries.flatMap(x=>x.sideEntries).length,0);
    });
  } finally { await db.$disconnect(); if(oldEnabled===undefined)delete process.env.KING_PERFECT_CENTER_IDS;else process.env.KING_PERFECT_CENTER_IDS=oldEnabled;
    fs.rmSync(dir,{recursive:true,force:true}); }
});
