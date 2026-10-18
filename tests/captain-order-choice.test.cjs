// Synthetic fixtures; never connects to a real DB.
const assert = require('node:assert/strict');
const {test} = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const {createRequire} = require('node:module');
function loadTs(relative, overrides={}, cache=new Map()) {
  const filename=path.resolve(__dirname,'..',relative);
  if(cache.has(filename))return cache.get(filename).exports;
  const m={exports:{}};cache.set(filename,m);
  const requireNative=createRequire(filename);
  const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true},
  }).outputText;
  new Function('require','module','exports',code)(id=>{
    if(Object.hasOwn(overrides,id))return overrides[id];
    if(id.startsWith('@/'))return loadTs('src/'+id.slice(2)+'.ts',overrides,cache);
    return requireNative(id);
  },m,m.exports);
  return m.exports;
}
function fixture(count) {
  const members=Array.from({length:count},(_,i)=>({
    id:'member-'+(i+1),userId:'user-'+(i+1),alias:null,user:{name:'팀장 '+(i+1)},
  }));
  const teams=members.map((captain,i)=>({
    id:'competition-team-'+(i+1),eventId:'event-1',generation:1,
    name:'TEAM '+(i+1),draftOrder:i+1,captainSelectionOrder:i+1,selectedDraftOrder:null,
    captainMemberId:captain.id,captain,participants:[],
  }));
  const participants=members.map((m,i)=>({
    id:'participant-'+(i+1),eventId:'event-1',generation:1,memberId:m.id,
    competitionTeamId:teams[i].id,assignmentType:'CAPTAIN',assignmentOrder:0,
    member:m,
  }));
  const event={
    id:'event-1',teamId:'team-1',title:'히든 팀전',competitionEnabled:true,competitionType:'TEAM',
    competitionStatus:'DRAFT_READY',draftGeneration:1,currentPickNumber:1,
    team:{isActive:true,bowlerHiddenEnabled:true,ownerId:'user-1',User:[],members},
    competitionTeams:teams,competitionParticipants:participants,guests:[],attendances:[],
    competitionDraftPicks:[],laneSlots:[],laneAssignments:[],seasonPublications:[],
  };
  const db={
    teamEvent:{
      findFirst:async()=>event,
      update:async({data})=>{Object.assign(event,data);return event;},
    },
    teamCompetitionTeam:{
      updateMany:async({where,data})=>{
        const row=teams.find(t=>t.id===where.id);
        if(!row||row.selectedDraftOrder!==null)return {count:0};
        if(teams.some(t=>t!==row && t.selectedDraftOrder===data.selectedDraftOrder))return {count:0};
        Object.assign(row,data);return {count:1};
      },
      update:async({where,data})=>{
        const row=teams.find(t=>t.id===where.id);
        if(teams.some(t=>t!==row&&t.draftOrder===data.draftOrder))throw Error('UNIQUE draftOrder');
        Object.assign(row,data);return row;
      },
    },
  };
  db.$transaction=async callback=>callback(db);
  const service=loadTs('src/lib/mobile-api/team-competition.ts',{
    '@/lib/prisma':db,
    '@/lib/mobile-api/notifications':{enqueueMobileNotifications:async()=>{},MOBILE_NOTIFICATION_TYPES:{}},
    '@/lib/mobile-api/event-admin-audit':{recordEventAdminAudit:async()=>{}},
    '@/lib/mobile-api/unified-season':{},
    '@/lib/mobile-api/team-game-points':{},
    '@/lib/mobile-api/team-event-guest':{},
  });
  const choose=(captain,order)=>service.updateTeamCompetition('user-'+captain,'team-1','event-1',{
    action:'CHOOSE_DRAFT_ORDER',draftOrder:order,
  });
  return {members,teams,event,choose,service};
}
for(const count of [2,3,4,5])test('captain selection and snake draft: '+count+' teams',async()=>{
  const f=fixture(count);
  await assert.rejects(f.service.updateTeamCompetition('user-1','team-1','event-1',{action:'START_DRAFT'}),
    e=>e.code==='DRAFT_ORDER_PENDING');
  const picks=count===4?[3,1,4,2]:Array.from({length:count},(_,i)=>count-i);
  for(let i=1;i<=count;i++){
    const result=await f.choose(i,picks[i-1]);
    assert.equal(result.complete,i===count);
  }
  assert.deepEqual(f.teams.map(t=>t.draftOrder),picks);
  assert.deepEqual(f.teams.map(t=>t.captainSelectionOrder),Array.from({length:count},(_,i)=>i+1));
  assert.deepEqual(Array.from({length:count*2},(_,i)=>f.service.snakeDraftTurn(i+1,count).draftOrder),[
    ...Array.from({length:count},(_,i)=>i+1),
    ...Array.from({length:count},(_,i)=>count-i),
  ]);
  const completed=await f.service.updateTeamCompetition('user-1','team-1','event-1',{action:'START_DRAFT'});
  assert.equal(completed.status,'TEAMS_FINALIZED'); // no non-captains in this synthetic test
});
test('permissions, invalid values and duplicates',async()=>{
  const f=fixture(4);
  await assert.rejects(f.choose(2,1),e=>e.code==='NOT_CURRENT_CAPTAIN'&&e.status===403);
  await assert.rejects(f.choose(3,1),e=>e.status===403);
  await assert.rejects(f.choose(1,0),e=>e.code==='INVALID_DRAFT_ORDER');
  await assert.rejects(f.choose(1,5),e=>e.code==='DRAFT_ORDER_TAKEN');
  await f.choose(1,3);
  await assert.rejects(f.choose(1,2),e=>e.status===403);
  await assert.rejects(f.choose(2,3),e=>e.code==='DRAFT_ORDER_TAKEN');
  await f.choose(2,1);await f.choose(3,4);await f.choose(4,2);
  await assert.rejects(f.choose(4,2),e=>e.code==='DRAFT_ORDER_COMPLETE');
});
test('two simultaneous requests for the same captain cannot both claim a choice',async()=>{
  const f=fixture(2);
  const results=await Promise.allSettled([f.choose(1,1),f.choose(1,1)]);
  assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(results.filter(x=>x.status==='rejected').length,1);
});
test('legacy DRAFT_READY teams remain playable without reselecting order',async()=>{
  const f=fixture(2);
  for(const team of f.teams){team.captainSelectionOrder=null;team.selectedDraftOrder=null;}
  await assert.rejects(f.choose(1,2),e=>e.code==='DRAFT_ORDER_NOT_REQUIRED');
  const result=await f.service.updateTeamCompetition('user-1','team-1','event-1',{action:'START_DRAFT'});
  assert.equal(result.status,'TEAMS_FINALIZED');
  assert.deepEqual(f.teams.map(t=>t.draftOrder),[1,2]);
});
