// Actual web rendering and mobile calculation, with synthetic records only.
const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const {createRenderer}=require('./helpers/dashboard-renderer.cjs');
const load=(r,p)=>r.load(path.resolve(__dirname,'../src/'+p));
const score=(id,userId,date,gameType='정기전',value=180)=>({id,userId,gameDate:new Date(date),gameType,score:value,guestName:userId?null:'가상 게스트',user:userId?{name:userId}:null});
function renderedRows(html){return [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].flatMap(([,row])=>{const cells=[...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map(([,v])=>v.replace(/<!--[\s\S]*?-->|<[^>]*>/g,'').trim());return cells.length>=18?[{name:cells[1],attendance:cells[2],games:cells[3],total:cells[16],average:cells[17],html:row}]:[];});}
function compare(scores,filter='REGULAR',history=new Map()){
 const r=createRenderer(),lib=load(r,'lib/team-records.ts'),Table=load(r,'components/TeamYearlyStats.tsx').default;
 const members=[...new Set(scores.map(s=>s.userId).filter(Boolean))].map(userId=>({id:userId,userId,name:userId}));
 const filtered=lib.filterTeamRecordScores(scores,filter),starts=lib.getRegularAttendanceStarts(scores,history);
 const html=renderToStaticMarkup(React.createElement(Table,{scores:filtered,currentYear:2026,teamName:'가상 팀',selectedTypes:filter==='ALL'?[...lib.TEAM_GAME_TYPES]:[filtered[0]?.gameType||'정기전'],onToggleType(){},members:members.map(m=>({id:m.userId,name:m.name})),regularAttendanceStarts:starts}));
 const web=renderedRows(html),mobile=lib.calculateTeamStatistics(scores,members,filter,history).members;
 for(const m of mobile){const w=web.find(w=>w.name===m.name);assert(w,'Missing web row '+m.name);assert.equal(w.attendance,`${m.attendanceRate.toFixed(1)}%(${m.attended}/${m.activityCount})`);assert.equal(Number(w.games),m.gameCount);assert.equal(Number(w.total),m.total);assert.equal(Number(w.average),m.average);}
 return{web,mobile,html};
}

test('midyear members exclude earlier dates but include later absences and guest-only activity days',()=>{
 const rows=[score('before','earlier','2026-01-01T03:00:00Z'),score('first','newer','2026-02-01T03:00:00Z'),score('same-day','newer','2026-02-01T04:00:00Z'),score('absent',null,'2026-03-01T03:00:00Z'),score('again','newer','2026-04-01T03:00:00Z')];
 const {mobile}=compare(rows);const newer=mobile.find(m=>m.name==='newer');assert.deepEqual([newer.attended,newer.activityCount,newer.attendanceRate,newer.gameCount,newer.total],[2,3,66.7,3,540]);
});

test('a past-year first regular game keeps January absences in the denominator',()=>{
 const rows=[score('jan','other','2026-01-01T03:00:00Z'),score('feb','veteran','2026-02-01T03:00:00Z')];
 const {mobile}=compare(rows,'REGULAR',new Map([['veteran','2025-09-01']]));const veteran=mobile.find(m=>m.name==='veteran');assert.deepEqual([veteran.attended,veteran.activityCount,veteran.attendanceRate],[1,2,50]);
});

test('KST midnight groups two UTC dates as one attendance and one month',()=>{
 const rows=[score('before-midnight-utc','newer','2026-01-31T15:30:00Z'),score('after-midnight-utc','newer','2026-02-01T01:00:00Z')];
 const {mobile}=compare(rows);assert.deepEqual([mobile[0].attended,mobile[0].activityCount],[1,1]);assert.equal(mobile[0].monthlyAverages[0],null);assert.equal(mobile[0].monthlyAverages[1],180);
});

test('combined and non-regular filters retain the first regular start without removing earlier scores',()=>{
 const rows=[score('casual-before','newer','2026-01-01T03:00:00Z','벙개',150),score('regular','newer','2026-02-01T03:00:00Z'),score('casual-after','newer','2026-03-01T03:00:00Z','벙개',210),score('casual-absent','other','2026-04-01T03:00:00Z','벙개')];
 const all=compare(rows,'ALL').mobile.find(m=>m.name==='newer');assert.deepEqual([all.attended,all.activityCount,all.gameCount,all.total],[2,3,3,540]);
 const casual=compare(rows,'CASUAL').mobile.find(m=>m.name==='newer');assert.deepEqual([casual.attended,casual.activityCount,casual.attendanceRate,casual.gameCount],[1,2,50,2]);
});

test('no regular history has zero attendance even when other scores exist; empty data stays empty',()=>{
 const {mobile}=compare([score('casual','newer','2026-01-01T03:00:00Z','벙개')],'CASUAL');assert.deepEqual([mobile[0].attended,mobile[0].activityCount,mobile[0].attendanceRate],[0,0,0]);assert.deepEqual(compare([]).web,[]);
});

test('ACE eligibility uses the same corrected attendance while keeping the 80 percent threshold',()=>{
 const r=createRenderer({moduleOverrides:{'./DailyScoreTable':()=>null}}),Container=load(r,'components/TeamStatsContainer.tsx').default;
 const rows=[score('jan','earlier','2026-01-01T03:00:00Z','정기전',180),score('feb','earlier','2026-02-01T03:00:00Z','정기전',180),score('mar-old','earlier','2026-03-01T03:00:00Z','정기전',180),score('mar-new','newer','2026-03-01T03:00:00Z','정기전',230)];
 const html=renderToStaticMarkup(React.createElement(Container,{scores:rows,currentYear:2026,teamName:'가상 팀',isOwner:false,isManager:false,teamId:'fixture'}));
 const web=renderedRows(html);assert.match(web.find(w=>w.name==='newer').html,/alt="에이스"/);assert.doesNotMatch(web.find(w=>w.name==='earlier').html,/alt="에이스"/);
});

function pageFixture(authenticated=true){
 const history=[score('old','veteran','2025-09-01T03:00:00Z'),score('kst-new-year','newer','2025-12-31T15:30:00Z'),score('kst-last','newer','2026-12-31T14:30:00Z'),score('next-year','newer','2026-12-31T15:30:00Z')];let captured;const calls=[];
 const empty=()=>null,overrides={
  '@/auth':{auth:async()=>authenticated?{user:{id:'veteran',role:'SUPER_ADMIN'}}:null},
  '@/lib/prisma':{team:{findFirst:async args=>{calls.push(['team',args]);return{id:'fixture',name:'가상 팀',code:'FAKE',ownerId:'veteran',User:[],members:[]};}},score:{findMany:async args=>{calls.push(['scores',args]);if(args.select?.guestName)return[];if(args.select)return history;return history.filter(s=>s.gameDate>=args.where.gameDate.gte&&s.gameDate<=args.where.gameDate.lte).map(s=>({...s,User:s.user}));}}},
  '@/app/actions/team':{leaveTeam:empty},'@/app/actions/board':{getRecentPosts:async()=>[]},
  '@/components/TeamStatsContainer':props=>{captured=props;return null;},
 };
 for(const p of ['YearSelector','CopyButton','LeaveTeamButton','board/TeamBoardSection','TeamMemberManager','TeamGuestManager'])overrides['@/components/'+p]=empty;
 const r=createRenderer({moduleOverrides:overrides}),Page=load(r,'app/team/[teamId]/page.tsx').default;
 return{async render(){const result=await Page({params:Promise.resolve({teamId:'fixture'}),searchParams:Promise.resolve({year:'2026'})});renderToStaticMarkup(result);return captured;},calls};
}

test('real web page supplies all-time regular starts and selects KST year boundaries',async()=>{
 const f=pageFixture(),props=await f.render();const range=f.calls.find(([kind,args])=>kind==='scores'&&args.include)?.[1].where.gameDate;
 assert.deepEqual([range.gte.toISOString(),range.lte.toISOString()],['2025-12-31T15:00:00.000Z','2026-12-31T14:59:59.999Z']);
 assert.equal(new Map(props.regularAttendanceStarts).get('veteran'),'2025-09-01');assert.equal(new Map(props.regularAttendanceStarts).get('newer'),'2026-01-01');assert.deepEqual(props.scores.map(s=>s.id),['kst-new-year','kst-last']);
});

test('anonymous web requests still redirect before reading team history',async()=>{const f=pageFixture(false);await assert.rejects(f.render(),/REDIRECT:\/login/);assert.deepEqual(f.calls,[]);});
