// Local-only preview. Always creates a NEW temporary SQLite DB and app copy.
// Does not read .env or mutate existing databases. Ctrl+C stops the loopback server.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {spawnSync, spawn} = require('node:child_process');
const {createRequire} = require('node:module');
const {randomUUID} = require('node:crypto');
const {PrismaClient} = require('@prisma/client');
const bcrypt = require('bcryptjs');
const ts = require('typescript');
const root = path.resolve(__dirname,'..');
function load(file,db,cache=new Map()) {
  const filename=path.join(root,file);
  if(cache.has(filename))return cache.get(filename).exports;
  const mod={exports:{}};cache.set(filename,mod);const native=createRequire(filename);
  const req=id=>id==='@/lib/prisma'?{__esModule:true,default:db}:id.startsWith('@/')?load('src/'+id.slice(2)+'.ts',db,cache):native(id);
  const output=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  new Function('require','module','exports',output)(req,mod,mod.exports);return mod.exports;
}
async function main(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'king-perfect-preview-'));
  const app=path.join(dir,'app');fs.mkdirSync(app);
  const url='file:'+path.join(dir,'fixture.db').replace(/\\/g,'/');
  const env={...process.env,DATABASE_URL:url,AUTH_SECRET:'king-perfect-isolated-preview-only-secret',AUTH_TRUST_HOST:'true',KING_PERFECT_CENTER_IDS:'kp-preview-center',NEXT_TELEMETRY_DISABLED:'1',CHECKPOINT_DISABLE:'1'};
  // No external integration is enabled in this isolated preview.
  for(const key of Object.keys(env))if(/^(BAND_|GOOGLE_|NAVER_|SMTP_|EMAIL_|FIREBASE_)/.test(key))delete env[key];
  const db=new PrismaClient({datasources:{db:{url}}});
  await db.$queryRawUnsafe('SELECT 1');await db.$disconnect();
  function cli(args,cwd=root){const result=spawnSync(process.execPath,args,{cwd,env,stdio:'inherit',windowsHide:true});if(result.status!==0)throw new Error('Local command failed: '+args[0]);}
  cli(['node_modules/prisma/build/index.js','migrate','deploy']);
  process.env.KING_PERFECT_CENTER_IDS='kp-preview-center';
  await db.user.create({data:{id:'kp-preview-owner',name:'로컬 검증 관리자',email:'kp-preview@example.invalid',password:await bcrypt.hash('Local-KP-2026!',10),emailVerified:new Date()}});
  await db.bowlingCenter.create({data:{id:'kp-preview-center',name:'킹퍼펙트 격리 검증 센터',code:'KP-ISOLATED',address:'테스트 전용',ownerId:'kp-preview-owner',managers:{connect:{id:'kp-preview-owner'}}}});
  const s=load('src/lib/king-perfect/service.ts',db),r=load('src/lib/king-perfect/rules.ts',db);
  const eid=randomUUID();const tournamentId=await s.createKingPerfect('kp-preview-owner','kp-preview-center','킹퍼펙트 로컬 검증','2026-10',eid);
  const run=async(action,data={})=>s.executeKingPerfect('kp-preview-owner',eid,{action,data,reason:'격리된 UI 검증 fixture',requestKey:randomUUID(),revision:(await db.kingPerfectEdition.findUnique({where:{id:eid}})).revision});
  await run('SETTINGS',{rules:{...r.defaultRules(),selection:'BEST',qualifyingConfirmed:true,gamesConfirmed:{ROUND1:true,ROUND2:true,FINAL:true},scoring:{ROUND1:'SUM',ROUND2:'SUM',FINAL:'SUM'},handicapCap:'LEAGUE_300',mappingConfirmed:true}});
  for(let i=0;i<25;i++){
    await db.user.create({data:{id:'kp-preview-u'+i,name:'검증선수 '+String(i+1).padStart(2,'0'),email:'kp-player'+i+'@example.invalid',handicap:i%4}});
    await db.centerMember.create({data:{id:'kp-preview-m'+i,userId:'kp-preview-u'+i,centerId:'kp-preview-center'}});
    await run('REGISTER',{memberId:'kp-preview-m'+i});
    const e=await db.kingPerfectEntry.findUnique({where:{editionId_memberId:{editionId:eid,memberId:'kp-preview-m'+i}}});
    await run('ELIGIBILITY',{entryId:e.id,eligibility:'APPROVED',athlete:false,cancelled:false,handicap:i%4});
    await run('ATTEMPT',{entryId:e.id,raw:279-i*4,freeGame:false});
  }
  await run('CLOSE');await run('QUALIFIERS',{tieOrder:[]});await run('GENERATE',{stage:'ROUND1'});await run('START',{stage:'ROUND1'});
  const v=await s.getKingPerfectAdmin('kp-preview-owner',eid);
  await run('SCORES',{matchId:v.matches[0].id,scores:v.matches[0].seats.map((e,i)=>({entryId:e.entryId,number:1,raw:240-i*30}))});
  await db.$disconnect();
  for(const item of ['src','public'])fs.cpSync(path.join(root,item),path.join(app,item),{recursive:true,filter:source=>!path.relative(root,source).split(path.sep).includes('uploads')});
  for(const item of ['package.json','package-lock.json','tsconfig.json','next.config.mjs','.eslintrc.json','next-env.d.ts'])fs.copyFileSync(path.join(root,item),path.join(app,item));
  fs.symlinkSync(path.join(root,'node_modules'),path.join(app,'node_modules'),process.platform==='win32'?'junction':'dir');
  const metadata={dir,app,url,tournamentId,editionId:eid,centerId:'kp-preview-center'};
  fs.writeFileSync(path.join(root,'scratch/king-perfect-preview.json'),JSON.stringify(metadata,null,2));
  cli([path.join(root,'node_modules/next/dist/bin/next'),'build'],app);
  console.log('Preview build succeeded. Test-only login: kp-preview@example.invalid / Local-KP-2026!');
  console.log('Preview path: /centers/kp-preview-center/tournaments/'+tournamentId);
  if(process.argv.includes('--serve')){
    const server=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port','4319'],{cwd:app,env,stdio:'inherit',windowsHide:true});
    process.on('SIGINT',()=>{server.kill();process.exit(0);});
    server.on('exit',code=>process.exit(code||0));
  }
}
main().catch(e=>{console.error(e);process.exit(1);});
