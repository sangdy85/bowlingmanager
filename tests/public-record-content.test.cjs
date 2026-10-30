const assert=require('node:assert/strict');
const {test}=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');

function fixture({centerId='center',type='LEAGUE',roundTournamentId='tournament',missingRound=false}={}){
 const calls=[];
 const tournament={name:'가상 리그',centerId,type,center:{managers:[],ownerId:'owner'}};
 const round=missingRound?null:{tournamentId:roundTournamentId,roundNumber:3};
 const stub=()=>null;
 const mocks={
  '@/lib/prisma':{__esModule:true,default:{tournament:{findUnique:async()=>tournament},leagueRound:{findUnique:async()=>round}}},
  '@/lib/public-web':{PUBLIC_ORIGIN:'https://www.bowlingmanager.co.kr'},
  '@/auth':{auth:async()=>null},
  'next/link':({children,...props})=>React.createElement('a',props,children),
  'next/navigation':{notFound:()=>{throw new Error('NOT_FOUND');}},
  '@/components/tournaments/ManagementUI':{ManagementBackLink:stub},
  '@/components/tournaments/LeagueLeaderboard':{__esModule:true,default:stub},
  '@/components/tournaments/IndividualLeaderboard':{__esModule:true,default:stub},
  '@/components/tournaments/LeagueRoundResultTabs':{__esModule:true,default:stub},
  '@/components/tournaments/RoundResultLeaderboard':{__esModule:true,default:stub},
  '@/app/actions/league-leaderboard':{getLeagueLeaderboard:async()=>{calls.push('team');return [];},getIndividualLeaderboard:async()=>{calls.push('individual');return []; }},
  '@/app/actions/league-results':{getLeagueRoundResults:async()=>{calls.push('league-round');return {}; }},
  '@/app/actions/champ-results':{getChampRoundResults:async()=>{calls.push('champ-round');return {}; }},
 };
 const cache=new Map();
 function load(file){
  file=path.resolve(__dirname,'..',file);
  if(cache.has(file))return cache.get(file);
  const mod={exports:{}};
  const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  new Function('require','module','exports',code)(id=>{
   if(Object.hasOwn(mocks,id))return mocks[id];
   if(id.startsWith('@/')){const base=path.resolve(__dirname,'../src',id.slice(2));return load(fs.existsSync(base+'.ts')?base+'.ts':base+'.tsx');}
   return require(id);
  },mod,mod.exports);cache.set(file,mod.exports);return mod.exports;
 }
 return {load,calls};
}
const base='src/app/centers/[id]/tournaments/[tournamentId]';
const params=Promise.resolve({id:'center',tournamentId:'tournament',roundId:'round'});
test('public record pages retain anonymous read access with one heading and useful links',async()=>{
 for(const [route,kind] of [['leaderboard','team'],['individual-leaderboard','individual'],['rounds/[roundId]/results','league-round']]){
  const f=fixture(),page=f.load(`${base}/${route}/page.tsx`);
  const html=renderToStaticMarkup(await page.default({params,searchParams:Promise.resolve({})}));
  assert.equal((html.match(/<h1\b/g)||[]).length,1);
  assert(html.includes('가상 리그'));assert(html.includes('/guide/league-results-reading-guide'));
  assert.deepEqual(f.calls,[kind]);
  const meta=await page.generateMetadata({params});
  assert(meta.alternates.canonical.startsWith('https://www.bowlingmanager.co.kr/centers/center/tournaments/tournament/'));
 }
});
test('mismatched center and round cannot present records under another tournament URL',async()=>{
 for(const options of [{centerId:'another-center'},{roundTournamentId:'another-tournament'},{missingRound:true}]){
  const f=fixture(options),page=f.load(`${base}/rounds/[roundId]/results/page.tsx`);
  await assert.rejects(page.default({params,searchParams:Promise.resolve({})}),/NOT_FOUND/);
  assert.deepEqual(f.calls,[]);
  const meta=await page.generateMetadata({params});assert.equal(meta.robots.index,false);assert.equal(meta.alternates,undefined);
 }
 for(const route of ['leaderboard','individual-leaderboard']){
  const f=fixture({type:'CHAMP'}),page=f.load(`${base}/${route}/page.tsx`);
  await assert.rejects(page.default({params}),/NOT_FOUND/);assert.deepEqual(f.calls,[]);
 }
});
test('CHAMP and EVENT final records retain existing result calculation actions',async()=>{
 for(const type of ['CHAMP','EVENT']){
  const f=fixture({type}),page=f.load(`${base}/rounds/[roundId]/results/page.tsx`);
  const html=renderToStaticMarkup(await page.default({params,searchParams:Promise.resolve({})}));
  assert(html.includes('3회차'));assert.deepEqual(f.calls,['champ-round']);
  const meta=await page.generateMetadata({params});assert(meta.title.includes('3회차'));assert(meta.alternates.canonical.endsWith('/rounds/round/results'));
 }
});
test('Korean calendar dates do not shift across UTC midnight or accept invalid input',()=>{
 const {formatKSTCalendarDate}=fixture().load('src/lib/tournament-utils.ts');
 assert.equal(formatKSTCalendarDate('2026-07-19T15:00:00.000Z'),'2026. 7. 20.');
 assert.equal(formatKSTCalendarDate('2026-07-19T14:59:59.000Z'),'2026. 7. 19.');
 assert.equal(formatKSTCalendarDate('2026-11-23T00:00:00+09:00'),'2026. 11. 23.');
 assert.equal(formatKSTCalendarDate(null),'일정 미정');assert.equal(formatKSTCalendarDate('bad-date'),'일정 미정');
});
test('custom tournament overviews remain discoverable without changing their existing feature path',async()=>{
 const {publicRecordMetadata}=fixture({type:'CUSTOM'}).load('src/lib/public-record-metadata.ts');
 const meta=await publicRecordMetadata('center','tournament','overview');
 assert.equal(meta.robots,undefined);assert.equal(meta.alternates.canonical,'https://www.bowlingmanager.co.kr/centers/center/tournaments/tournament');
 const round=await publicRecordMetadata('center','tournament','round','round');
 assert.equal(round.robots,undefined);assert(round.alternates.canonical.endsWith('/rounds/round/results'));
});
