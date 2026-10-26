// Creates an isolated browser fixture. No production DB, credentials, API calls
// or actual BAND posting. Navigation is captured by default; an explicit UI
// opt-in allows manually opening the official BAND composer (never publishing).
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const locationFile = path.join(root, 'scratch/band-share-qa-location.json');
const updating = process.argv.includes('--update');
const target = updating ? path.resolve(JSON.parse(fs.readFileSync(locationFile, 'utf8')).target) : fs.mkdtempSync(path.join(os.tmpdir(), 'bm-band-share-qa-'));
if (updating && (path.dirname(target).toLowerCase() !== path.resolve(os.tmpdir()).toLowerCase() ||
    !path.basename(target).startsWith('bm-band-share-qa-') || !fs.existsSync(path.join(target, 'app/controls.jsx')))) {
    throw new Error('Expected the existing isolated QA directory under the temp directory');
}
const posix = value => value.replaceAll('\\', '/');
const write = (file, text) => { const dest = path.join(target, file); fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, text); };
if (!fs.existsSync(path.join(target, 'node_modules'))) fs.symlinkSync(path.join(root, 'node_modules'), path.join(target, 'node_modules'), 'junction');
write('package.json', JSON.stringify({ private: true, scripts: { dev: 'next dev' }, dependencies: { next: '15.5.12', react: '19.0.0', 'react-dom': '19.0.0' } }));
write('tsconfig.json', JSON.stringify({ compilerOptions: { allowJs: true, jsx: 'preserve', esModuleInterop: true, moduleResolution: 'bundler', paths: {
    '@/app/actions/band-share-actions': ['./fixture-share-actions.js'],
    '@/app/actions/band-post-settings-actions': ['./fixture-share-actions.js'],
    '@/app/actions/band-actions': ['./fixture-api-actions.js'],
    '@/app/actions/league-leaderboard': ['./fixture-league-actions.js'],
    '@/*': [posix(path.join(root, 'src/*'))],
} } }));
write('next.config.mjs', `export default { experimental: { externalDir: true }, serverExternalPackages: ['typescript'], webpack(config) { config.resolve.alias = {
 '@/app/actions/band-share-actions$': ${JSON.stringify(posix(path.join(target, 'fixture-share-actions.js')))},
 '@/app/actions/band-post-settings-actions$': ${JSON.stringify(posix(path.join(target, 'fixture-share-actions.js')))},
 '@/app/actions/band-actions$': ${JSON.stringify(posix(path.join(target, 'fixture-api-actions.js')))},
 '@/app/actions/league-leaderboard$': ${JSON.stringify(posix(path.join(target, 'fixture-league-actions.js')))},
 '@': ${JSON.stringify(posix(path.join(root, 'src')))}, ...config.resolve.alias }; return config; } };`);
write('app/qa.css', `.band-share-qa-body { margin: 0; font-family: Arial, sans-serif; background-color: #f2f5fa; color: #10283e; }`);
write('app/layout.jsx', `import ${JSON.stringify(posix(path.join(root, 'src/app/globals.css')))}; import './qa.css'; export default function Layout({children}) { return <html lang="ko"><body className="band-share-qa-body">{children}</body></html>; }`);
write('app/page.jsx', `import Controls from './controls'; export default function Page(){return <Controls/>;}`);
write('fixture-share-actions.js', `'use server';
import fixture from ${JSON.stringify(posix(path.join(root, 'tests/helpers/band-share-fixture.cjs')))};
const savedSettings=new Map();
export async function getBandSharePreviewAction(input) {
 const f=fixture.createShareFixture(${JSON.stringify(root)});
 f.tournament.id=input.tournamentId;
 f.tournament.settings=savedSettings.get(input.tournamentId)||f.tournament.settings;
 f.tournament.type=input.tournamentId==='champ'?'CHAMP':input.tournamentId==='event'?'EVENT':'LEAGUE';
 await new Promise(resolve=>setTimeout(resolve,input.roundId==='r1'?750:30));
 return f.actions.getBandSharePreviewAction(input);
}
export async function saveBandPostSettingsAction(input){
 const f=fixture.createShareFixture(${JSON.stringify(root)});f.tournament.id=input.tournamentId;
 f.tournament.settings=savedSettings.get(input.tournamentId)||f.tournament.settings;
 f.db.tournament.updateMany=async query=>{if(query.where.settings!==f.tournament.settings)return {count:0};savedSettings.set(input.tournamentId,query.data.settings);return {count:1};};
 return f.load('src/app/actions/band-post-settings-actions.ts').saveBandPostSettingsAction(input);
}`);
write('fixture-api-actions.js', `'use server';
export async function getLeagueWeeklyBandStateAction(input){return {success:true,roundId:input.roundId,week:input.week,ready:input.week!==2&&input.week!==4,matchCount:input.week===4?0:1,configured:false,connected:false,latestPost:null};}
export async function getBandPostPreviewAction(){return {success:false,message:'QA 환경에서는 API 전송이 차단됩니다.'};}
export async function publishBandPostAction(){throw new Error('Actual API publishing forbidden in QA');}
export async function resolveUncertainBandPostAction(){throw new Error('History writes forbidden in QA');}
`);
write('fixture-league-actions.js', `'use server';
import fixture from ${JSON.stringify(posix(path.join(root, 'tests/helpers/band-share-fixture.cjs')))};
export async function getWeeklyLeagueReport(id,week){const f=fixture.createShareFixture(${JSON.stringify(root)});f.tournament.id=id;return f.load('src/app/actions/league-leaderboard.ts').getWeeklyLeagueReport(id,week);}
`);
write('app/controls.jsx', `'use client';
import {useEffect,useRef,useState} from 'react';
import Share from ${JSON.stringify(posix(path.join(root, 'src/components/tournaments/BandOfficialShareControl.tsx')))};
import Weekly from ${JSON.stringify(posix(path.join(root, 'src/components/tournaments/WeeklyResultDownloader.tsx')))};
import PostSettings from ${JSON.stringify(posix(path.join(root, 'src/components/tournaments/BandPostSettings.tsx')))};
export default function Controls(){
 const [kind,setKind]=useState('league'),[post,setPost]=useState('PARTICIPANTS'),[week,setWeek]=useState(1),[mobile,setMobile]=useState(false),[blocked,setBlocked]=useState(false),[live,setLive]=useState(false),[events,setEvents]=useState([]),[pngs,setPngs]=useState([]);
 const blockRef=useRef(false);blockRef.current=blocked;
 const liveRef=useRef(false);liveRef.current=live;
 const [native,setNative]=useState(false),[nativeCancel,setNativeCancel]=useState(false),[fileEvents,setFileEvents]=useState([]);
 const nativeRef=useRef(false),cancelRef=useRef(false);nativeRef.current=native;cancelRef.current=nativeCancel;
 const originalUA=useRef('');
 useEffect(()=>{
   const originalOpen=window.open;originalUA.current=navigator.userAgent;
   const originalShare=Object.getOwnPropertyDescriptor(navigator,'share'),originalCanShare=Object.getOwnPropertyDescriptor(navigator,'canShare');
   const actualShare=typeof navigator.share==='function'?navigator.share.bind(navigator):null,actualCanShare=typeof navigator.canShare==='function'?navigator.canShare.bind(navigator):null;
   Object.defineProperty(navigator,'canShare',{configurable:true,value:data=>liveRef.current?Boolean(actualCanShare?.(data)):nativeRef.current&&Boolean(data.files?.length)});
   Object.defineProperty(navigator,'share',{configurable:true,value:async data=>{if(liveRef.current){if(!actualShare)throw new Error('File sharing unsupported');return actualShare(data);}if(cancelRef.current)throw new DOMException('Cancelled','AbortError');setFileEvents(prev=>[{text:data.text,files:data.files.map(file=>({name:file.name,size:file.size,type:file.type}))},...prev]);}});
   const originalClick=HTMLAnchorElement.prototype.click;
   HTMLAnchorElement.prototype.click=function(){if(this.download&&this.href.startsWith('data:image/png')){setPngs(prev=>[...prev,{name:this.download,url:this.href}]);return;}return originalClick.call(this);};
   window.open=(...args)=>liveRef.current?originalOpen.apply(window,args):blockRef.current?null:{opener:window,location:{replace:destination=>setEvents(prev=>[destination,...prev])}};
   const intercept=e=>{const a=e.target.closest('a');if(!liveRef.current&&a&&(/^(bandapp:|https:\\/\\/band.us\\/)/.test(a.href))){e.preventDefault();setEvents(prev=>[a.href,...prev]);}};
   document.addEventListener('click',intercept,true);
   return ()=>{window.open=originalOpen;HTMLAnchorElement.prototype.click=originalClick;document.removeEventListener('click',intercept,true);if(originalShare)Object.defineProperty(navigator,'share',originalShare);else delete navigator.share;if(originalCanShare)Object.defineProperty(navigator,'canShare',originalCanShare);else delete navigator.canShare;};
 },[]);
 const switchMobile=value=>{Object.defineProperty(navigator,'userAgent',{configurable:true,value:value?'Mozilla/5.0 Android QA':originalUA.current});setMobile(value);};
 const rounds=[1,2,3,4].map(n=>({id:'r'+n,roundNumber:n,matchups:[{status:'FINISHED'}]}));
 return <main style={{maxWidth:1000,margin:'24px auto',padding:20}}>
 <style>{'dialog[open]::before{content:'+JSON.stringify(live?'수동 확인 모드: 실제 BAND·기기 공유창을 사용합니다. 가상 기록이므로 게시하지 마세요.':'테스트 모드: 공유 주소·사진 전달 내용만 확인하며 실제 BAND·기기 공유창은 열리지 않습니다.')+';display:block;flex-shrink:0;padding:12px 16px;background:#fff3cd;color:#704500;font-size:13px;border-bottom:1px solid #e9c46a;}'}</style>
 <h1>BAND 공식 공유 · 로컬 QA</h1><p role="note">가상 데이터만 사용합니다. BAND 환경변수 없음 · 게시·푸시·DB 쓰기 없음. 기본 테스트 모드에서는 실제 BAND 창이 열리지 않습니다.</p>
 <label style={{display:'block',padding:12,marginBottom:16,background:'#fff3cd',border:'1px solid #e9c46a',borderRadius:8}}><input type="checkbox" checked={live} onChange={e=>setLive(e.target.checked)}/> 실제 BAND 공유 창 열기 (수동 확인 · 가상 기록 게시 금지)</label>
 <p>위 항목을 켜면 지원되는 기기의 사진 공유창도 실제로 열립니다. 끄면 아래 테스트 항목은 전달 내용만 캡처합니다.</p>
 <div style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:20}}>
 <label>대회 유형 <select aria-label="QA 대회 유형" value={kind} onChange={e=>setKind(e.target.value)}><option value="league">상주리그</option><option value="champ">챔프전</option><option value="event">이벤트전</option></select></label>
 <label>공지 유형 <select aria-label="QA 공지 유형" value={post} onChange={e=>setPost(e.target.value)}><option value="PARTICIPANTS">참가자</option><option value="LANE_ASSIGNMENT">레인배정</option><option value="FINAL_RESULT">최종결과</option></select></label>
 <label><input type="checkbox" checked={mobile} onChange={e=>switchMobile(e.target.checked)}/>모바일 UI 테스트</label>
 <label><input type="checkbox" checked={blocked} disabled={live} onChange={e=>setBlocked(e.target.checked)}/>팝업 차단 테스트</label>
 <label><input type="checkbox" checked={native} disabled={live} onChange={e=>setNative(e.target.checked)}/>사진 파일 공유 지원 테스트 (실제 전송 없음)</label>
 <label><input type="checkbox" checked={nativeCancel} disabled={live} onChange={e=>setNativeCancel(e.target.checked)}/>사진 공유 취소 테스트</label>
 </div>
 <details style={{marginBottom:20}}><summary>대회 설정 · BAND 게시글 설정 (메모리 저장만 사용)</summary><PostSettings key={kind} centerId="center" tournamentId={kind}/></details>
 {kind==='league'?<Weekly key={'weekly:'+mobile} centerId="center" tournamentId="league" tournamentName="가상 상주리그" rounds={rounds} isManager bandConnected={false} bandConfigured={false}/>
 :<><label>회차 <select aria-label="QA 회차" value={week} onChange={e=>setWeek(Number(e.target.value))}>{[1,3].map(n=><option key={n} value={n}>{n}회차</option>)}</select></label>
 <Share key={'round:'+mobile} centerId="center" tournamentId={kind} roundId={'r'+week} type={post}/></>}
 <h2>실제 PNG 생성 결과 (자동 파일 저장만 캡처)</h2><div data-testid="png-results">{pngs.map((png,i)=><p key={i}><a data-testid={'png-'+i} href={png.url} download={png.name}>{png.name}</a></p>)}</div><h2>공유 목적지 캡처 (외부 전송 없음)</h2><pre data-testid="share-events" style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{events.map(url=>decodeURIComponent(url)).join('\\n\\n')}</pre>
 <h2>문구와 사진 공유 캡처 (실제 전송 없음)</h2><pre data-testid="file-share-events" style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(fileEvents,null,2)}</pre>
 </main>;
}
`);
fs.mkdirSync(path.join(root, 'scratch'), { recursive: true });
fs.writeFileSync(locationFile, JSON.stringify({ target, port: 3165 }));
console.log(target);
