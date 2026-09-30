const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(relative) {
 const filename=path.resolve(__dirname,'..',relative), m={exports:{}};
 const compiled=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 new Function('exports','require',compiled)(m.exports, id=>load(path.relative(path.resolve(__dirname,'..'),path.resolve(path.dirname(filename),id+'.ts'))));
 return m.exports;
}
function loadWithMocks(relative,mocks) {
 const filename=path.resolve(__dirname,'..',relative), m={exports:{}};
 const compiled=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText;
 new Function('exports','require','module',compiled)(m.exports,id=>{
  if(Object.prototype.hasOwnProperty.call(mocks,id))return mocks[id];
  throw new Error('Unexpected module: '+id);
 },m);
 return m.exports;
}
const {calculateAverage}=load('src/lib/average-calculator.ts');
const policy=load('src/lib/public-web.ts');
const {GUIDE_ARTICLES,PUBLISHED_GUIDE_ARTICLES,MERGED_GUIDE_REDIRECTS,findPublishedGuideArticle,findMergedGuideDestination}=load('src/lib/guide-data.ts');
test('www is the single public origin for canonical metadata, sitemap and robots',()=>{
 assert.equal(policy.PUBLIC_ORIGIN,'https://www.bowlingmanager.co.kr');
 assert.equal(policy.CANONICAL_HOSTNAME,'www.bowlingmanager.co.kr');
 const sitemap=loadWithMocks('src/app/sitemap.ts',{
  '@/lib/guide-data':{PUBLISHED_GUIDE_ARTICLES},
  '@/lib/public-web':policy,
 }).default();
 assert.ok(sitemap.length>0);
 for(const entry of sitemap)assert.match(entry.url,/^https:\/\/www\.bowlingmanager\.co\.kr(?:\/|$)/);
 const robots=loadWithMocks('src/app/robots.ts',{'@/lib/public-web':policy}).default();
 assert.equal(robots.sitemap,'https://www.bowlingmanager.co.kr/sitemap.xml');
 for(const file of ['about','privacy','terms','disclaimer']){
  const source=fs.readFileSync(path.join(__dirname,`../src/app/${file}/page.tsx`),'utf8');
  assert.ok(source.includes("import { PUBLIC_ORIGIN } from '@/lib/public-web'")||source.includes('import { PUBLIC_ORIGIN } from "@/lib/public-web"'));
  assert.equal(source.includes('https://bowlingmanager.co.kr'),false);
 }
});
test('production canonical host redirect preserves path and query without touching other hosts',()=>{
 const redirect=policy.canonicalHostRedirectUrl;
 assert.equal(
  redirect('https://bowlingmanager.co.kr/team/abc?x=1',{
   requestHostname:'bowlingmanager.co.kr',host:'bowlingmanager.co.kr',
  },true),
  'https://www.bowlingmanager.co.kr/team/abc?x=1',
 );
 assert.equal(
  redirect('http://internal:3000/guide?topic=score',{
   requestHostname:'internal',host:'internal:3000',forwardedHost:'bowlingmanager.co.kr:443, proxy.local',
  },true),
  'https://www.bowlingmanager.co.kr/guide?topic=score',
 );
 for(const input of [
  ['https://www.bowlingmanager.co.kr/guide',{requestHostname:'www.bowlingmanager.co.kr',host:'www.bowlingmanager.co.kr'},true],
  ['http://localhost:3000/guide',{requestHostname:'localhost',host:'localhost:3000'},true],
  ['http://127.0.0.1:3000/guide',{requestHostname:'127.0.0.1',host:'127.0.0.1:3000'},true],
  ['https://preview.internal/guide',{requestHostname:'preview.internal',host:'preview.internal'},true],
  ['https://bowlingmanager.co.kr/guide',{requestHostname:'bowlingmanager.co.kr',host:'bowlingmanager.co.kr'},false],
 ])assert.equal(redirect(input[0],input[1],input[2]),null);
 const responseFactory={
  redirect:(url,status)=>({kind:'redirect',url,status}),
  next:()=>({kind:'next'}),
 };
 const middleware=loadWithMocks('src/middleware.ts',{
  'next/server':{NextResponse:responseFactory},
  '@/lib/public-web':policy,
 }).middleware;
 const originalNodeEnv=process.env.NODE_ENV;
 try{
  process.env.NODE_ENV='production';
  const result=middleware({
   url:'https://bowlingmanager.co.kr/team/abc?x=1',
   nextUrl:{hostname:'bowlingmanager.co.kr'},
   headers:new Headers({host:'bowlingmanager.co.kr'}),
  });
  assert.deepEqual(result,{kind:'redirect',url:'https://www.bowlingmanager.co.kr/team/abc?x=1',status:308});
  const canonicalResult=middleware({
   url:'https://www.bowlingmanager.co.kr/team/abc?x=1',
   nextUrl:{hostname:'www.bowlingmanager.co.kr'},
   headers:new Headers({host:'www.bowlingmanager.co.kr','x-forwarded-host':'bowlingmanager.co.kr'}),
  });
  assert.deepEqual(canonicalResult,{kind:'next'});
 }finally{
  if(originalNodeEnv===undefined)delete process.env.NODE_ENV;
  else process.env.NODE_ENV=originalNodeEnv;
 }
});
test('average handles normal scores, zero, limits and fractional display without intermediate rounding',()=>{
 assert.deepEqual(calculateAverage('120, 150\n180').result,{count:3,total:450,average:150,high:180,low:120});
 assert.deepEqual(calculateAverage('0 300').result,{count:2,total:300,average:150,high:300,low:0});
 assert.equal(calculateAverage('1 1 2').result.average,4/3);
 assert.equal(calculateAverage('1 1 2').result.average.toFixed(1),'1.3');
 assert.equal(calculateAverage('0').result.count,1);
 for(const value of ['','  ','301','-1','1.5','NaN','1e2','0x10','<script>'])assert.ok(calculateAverage(value).error,value);
 assert.ok(calculateAverage(Array(1001).fill('100').join(' ')).error);
});
test('empty separators do not create zero-score games',()=>{
 assert.equal(calculateAverage('120,, 150\n\n180').result.count,3);
 assert.equal(calculateAverage(',0,').result?.count,1);
 assert.ok(calculateAverage(',,,').error);
});
test('content links reject executable or ambiguous protocols',()=>{
 for(const url of ['javascript:alert(1)','data:text/html,bad','//example.com','/\\example.com','vbscript:msgbox(1)'])assert.equal(policy.safeContentUrl(url),'');
 assert.equal(policy.safeContentUrl('/tools/average'),'/tools/average');
 assert.equal(policy.safeContentUrl('https://bowl.com/'),'https://bowl.com/');
});
test('private crawler boundaries cover exact, slash and query without matching lookalikes',()=>{
 const rules=policy.privateRobotsRules();
 const blocked=url=>rules.some(rule=>rule.endsWith('$')?url===rule.slice(0,-1):url.startsWith(rule));
 for(const root of ['/settings','/personal']){
  for(const suffix of ['','/','/child','?year=2026'])assert.ok(blocked(root+suffix));
  assert.equal(blocked(root+'-guide'),false);
 }
});
test('ads remain off, even on eligible content; form/private/error inventory is not eligible',()=>{
 for(const p of ['/','/login','/register','/personal','/settings','/tools/average','/guide/missing'])assert.equal(policy.canExecuteAds(p),false);
 assert.equal(policy.AD_CONTENT_ALLOWLIST.includes('/tools/average'),false);
 assert.equal(policy.AD_CONTENT_ALLOWLIST.includes('/guide/missing'),false);
 const layout=fs.readFileSync(path.join(__dirname,'../src/app/layout.tsx'),'utf8');
 assert.ok(layout.includes('ca-pub-6753153221253393'));assert.equal(layout.includes('adsbygoogle.js'),false);
});
test('all source articles survive while unpublished and merged articles stay out of public inventory',()=>{
 assert.equal(GUIDE_ARTICLES.length,18);assert.equal(new Set(GUIDE_ARTICLES.map(a=>a.slug)).size,18);
 for(const article of GUIDE_ARTICLES){assert.ok(article.content.length>100);assert.equal(/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(article.content),false);assert.equal(article.content.includes('\\text{'),false);}
 const hidden=['kpba-official-bowling-tournament-rules-2026','health-benefits-and-effects-of-bowling','bowling-injury-prevention-and-stretching-guide'];
 assert.equal(PUBLISHED_GUIDE_ARTICLES.length,13);
 for(const slug of hidden){assert.equal(GUIDE_ARTICLES.find(a=>a.slug===slug).status,'unpublished');assert.equal(findPublishedGuideArticle(slug),undefined);}
 assert.ok(PUBLISHED_GUIDE_ARTICLES.every(a=>a.status==='published'));
 const scoring=findPublishedGuideArticle('bowling-scoring-system');assert.ok(scoring.content.includes('168점'));assert.ok(scoring.content.includes('5/를 반복하고 마지막 보너스도 5핀이면 150점'));assert.ok(scoring.references.some(ref=>ref.url==='https://bowl.com/keeping-score'));assert.ok(scoring.references.some(ref=>ref.url.includes('bowling.sport')));
});
test('public routes and sitemap consume only the published guide collection',()=>{
 const list=fs.readFileSync(path.join(__dirname,'../src/app/guide/page.tsx'),'utf8');
 const detail=fs.readFileSync(path.join(__dirname,'../src/app/guide/[slug]/page.tsx'),'utf8');
 const sitemap=fs.readFileSync(path.join(__dirname,'../src/app/sitemap.ts'),'utf8');
 assert.ok(list.includes('PUBLISHED_GUIDE_ARTICLES'));
 assert.ok(detail.includes('findPublishedGuideArticle(slug)'));assert.ok(detail.includes('notFound()'));
 assert.ok(sitemap.includes('PUBLISHED_GUIDE_ARTICLES.map'));
});
test('P0 corrections and current product limits remain explicit',()=>{
 const spare=findPublishedGuideArticle('spare-pickup-theory-and-3-6-9-system-guide');
 assert.ok(spare.content.includes('최종 점수는 **150점**'));assert.ok(spare.content.includes('고정해서 말할 수 없습니다'));assert.equal(spare.title.includes('100%'),false);assert.equal(spare.content.includes('프레임별 스페어 처리율'),false);
 const dimensions=findPublishedGuideArticle('bowling-specifications-and-dimensions');
 assert.ok(dimensions.content.includes('41.5인치 ± 0.5인치'));assert.ok(dimensions.content.includes('8.500~8.595인치'));assert.equal(dimensions.content.includes('0.415인치'),false);
 const oil=findPublishedGuideArticle('bowling-lane-oiling-and-cleaning-maintenance-guide');
 assert.ok(oil.content.includes('Units와 mL은 같은 값도, 같은 단위도 아닙니다'));assert.ok(oil.content.includes('총량 하나로 난도나 훅의 크기를 결정할 수 없습니다'));
 const visible=PUBLISHED_GUIDE_ARTICLES.map(a=>a.content).join('\n');
 for(const claim of ['오픈 프레임 비율','프레임별 스페어 처리율','스트라이크 비율','마이볼 명칭','레인 변화에 따른 스스코어 관리'])assert.equal(visible.includes(claim),false,claim);
 const about=fs.readFileSync(path.join(__dirname,'../src/components/AboutPageContent.tsx'),'utf8');
 assert.equal(about.includes('프레임별 점수가 자동으로 집계'),false);assert.equal(about.includes('통계학의 표준 편차 공식'),false);assert.ok(about.includes('게임별 최종 점수'));
 for(const phrase of ['234점을 축 점수 10점','평균 230점은 축 점수 9.6점','최고 세션 평균','최저 세션 평균','모집단 또는 표본 표준편차가 아닙니다'])assert.ok(about.includes(phrase),phrase);
 for(const stale of ['230점 에버리지가 100%','상위 하이(High) 스코어의 평균치','순간 폭발력을 진단','수비력을 측정','100% 참사'])assert.equal(about.includes(stale),false,stale);
});
test('published scoring example totals 168 using independent bowling bonus calculation',()=>{
 const rolls=[10,7,3,9,0,10,0,8,8,2,0,6,10,10,10,8,2];let at=0,total=0;const frames=[];
 for(let frame=0;frame<10;frame++){let score;if(rolls[at]===10){score=10+rolls[at+1]+rolls[at+2];at++;}else if(rolls[at]+rolls[at+1]===10){score=10+rolls[at+2];at+=2;}else{score=rolls[at]+rolls[at+1];at+=2;}total+=score;frames.push(total);}
 assert.deepEqual(frames,[20,39,48,66,74,84,90,120,148,168]);
});
test('ten repeated five-spares plus a five bonus total 150',()=>{
 const rolls=Array.from({length:10},()=>[5,5]).flat().concat(5);let at=0,total=0;
 for(let frame=0;frame<10;frame++){total+=10+rolls[at+2];at+=2;}
 assert.equal(total,150);
});
test('equipment guides use sourced decision frameworks without result guarantees',()=>{
 const slugs=['bowling-ball-selection-guide','bowling-specifications-and-dimensions','bowling-ball-specifications-coverstock-core-rg-diff-guide','bowling-lane-oiling-and-cleaning-maintenance-guide','bowling-shoes-and-accessory-maintenance-guide'];
 const guides=Object.fromEntries(slugs.map(slug=>[slug,findPublishedGuideArticle(slug)]));
 for(const [slug,article] of Object.entries(guides)){
  assert.ok(article,slug);assert.ok(article.content.length>1200,slug);assert.equal(article.lastReviewed,'2026-09-30',slug);assert.ok(article.references?.length,slug);
  for(const claim of ['완벽 정복','강력 추천','극대화','100%'])assert.equal((article.title+'\n'+article.description+'\n'+article.content).includes(claim),false,`${slug}: ${claim}`);
 }
 const selection=guides['bowling-ball-selection-guide'];
 for(const phrase of ['편안함과 제어','프로샵 상담 체크리스트','주 사용 레인','예산','/guide/bowling-ball-specifications-coverstock-core-rg-diff-guide'])assert.ok(selection.content.includes(phrase),phrase);
 for(const claim of ['성인 남성','성인 여성','2~3파운드','14~15파운드','마이볼 명칭'])assert.equal(selection.content.includes(claim),false,claim);
 const specs=guides['bowling-specifications-and-dimensions'];
 for(const phrase of ['60피트 ± 0.5인치','41.5인치 ± 0.5인치','최소 15피트','16.00파운드','8.500~8.595인치','최대 0.060인치'])assert.ok(specs.content.includes(phrase),phrase);
 assert.ok(specs.content.includes('39로 나눈 값을 보드 한 장의 시공 규격처럼 사용하면 안 됩니다'));
 const ball=guides['bowling-ball-specifications-coverstock-core-rg-diff-guide'];
 for(const phrase of ['커버스톡','표면·피니시','Differential RG','Intermediate Differential','PAP·구속·회전','가상 데이터'])assert.ok(ball.content.includes(phrase),phrase);
 for(const claim of ['70%','50% + 펄 50%','추천 커버스탁 / 코어 스펙'])assert.equal(ball.content.includes(claim),false,claim);
 assert.ok(ball.content.includes('높은 Diff가 곧바로 큰 백엔드 각도를 뜻하지 않습니다.'));
 const oil=guides['bowling-lane-oiling-and-cleaning-maintenance-guide'];
 for(const phrase of ['43피트','24.25mL','µL','출발 가설','Dead Man'])assert.ok(oil.content.includes(phrase),phrase);
 for(const claim of ['25mL 이상','house = 10:1','sport = 3:1'])assert.equal(oil.content.includes(claim),false,claim);
 assert.ok(oil.content.includes('총량 하나로 난도나 훅의 크기를 결정할 수 없습니다.'));
 const care=guides['bowling-shoes-and-accessory-maintenance-guide'];
 for(const phrase of ['Dexter T.H.E','S2','S12','매 투구 뒤','실온 보관','제조사가 허용한 클리너'])assert.ok(care.content.includes(phrase),phrase);
 for(const claim of ['45도','몽구스','코브라','부상 방지','회전력을 높'])assert.equal((care.title+'\n'+care.description+'\n'+care.content).includes(claim),false,claim);
});
test('etiquette, lane adjustment, spare and routine guides stay conditional and actionable',()=>{
 const etiquette=findPublishedGuideArticle('beginner-bowling-etiquette');
 const advanced=findPublishedGuideArticle('advanced-bowling-techniques-and-theory');
 const spare=findPublishedGuideArticle('spare-pickup-theory-and-3-6-9-system-guide');
 const mental=findPublishedGuideArticle('bowling-mental-game-and-pre-shot-routine-guide');
 for(const article of [etiquette,advanced,spare,mental]){
  assert.ok(article);assert.ok(article.content.length>1500);assert.equal(article.lastReviewed,'2026-09-30');
  for(const claim of ['완벽','무조건','100%','극대화'])assert.equal((article.title+'\n'+article.description+'\n'+article.content).includes(claim),false,`${article.slug}: ${claim}`);
 }
 assert.ok(etiquette.references.some(ref=>ref.url.includes('bowling-etiquette')));
 assert.ok(etiquette.content.includes('먼저 어프로치에 선 사람이 먼저 투구'));
 assert.ok(etiquette.content.includes('선후가 불분명하면 오른쪽 선수'));
 assert.ok(etiquette.content.includes('/guide/club-event-checklist'));
 for(const claim of ['오른쪽 레인 우선','반드시 볼링화 커버','대형 부상','미너','진짜 멋진 고수'])assert.equal(etiquette.content.includes(claim),false,claim);
 assert.ok(advanced.references.some(ref=>ref.url.includes('understanding-oil-patterns')));
 assert.ok(advanced.references.filter(ref=>ref.url.includes('kegel.net')).length>=2);
 assert.ok(advanced.content.includes('41 - 31 = 10'));
 assert.ok(advanced.content.includes('첫 투구의 가설'));
 assert.ok(advanced.content.includes('실제 정답 좌표가 아닙니다'));
 assert.ok(advanced.content.includes('한 번에 바꿀 변수 하나'));
 assert.ok(advanced.content.includes('/guide/bowling-lane-oiling-and-cleaning-maintenance-guide'));
 for(const claim of ['에버리지 180~200점','3-1-2','2-to-1','스탠스를 왼쪽으로 이동해야','더 표면 마찰력이 강한 공으로 교체'])assert.equal((advanced.title+'\n'+advanced.description+'\n'+advanced.content).includes(claim),false,claim);
 assert.ok(advanced.content.includes('레인 조건, 투구 경로, 변경 변수는 자동 분석되지 않으므로'));
 assert.ok(spare.references.some(ref=>ref.url.includes('picking-up-the-spare')));
 assert.ok(spare.references.some(ref=>ref.url==='https://bowl.com/keeping-score'));
 assert.ok(spare.content.includes('최종 점수는 **150점**'));
 assert.ok(spare.content.includes('고정해서 말할 수 없습니다'));
 assert.ok(spare.content.includes('| 키 핀 | 시작 위치 | 목표 | 성공/시도 | 메모 |'));
 assert.ok(spare.content.includes('가상 예시'));
 assert.ok(spare.content.includes('/guide/bowling-scoring-system'));
 assert.ok(spare.content.includes('기계적으로 좌우 반전하는 규칙으로 사용하지 않습니다'));
 assert.ok(spare.content.includes('투구 손·드리프트·공 반응'));
 assert.equal(spare.content.includes('왼손잡이는 방향을 반대로'),false);
 for(const claim of ['성공 확률이 1%','35번~38번 보드','프레임별 스페어 처리율'])assert.equal(spare.content.includes(claim),false,claim);
 assert.ok(mental.content.includes('투구 전 개인 루틴 예시'));
 assert.ok(mental.content.includes('| 결과 | 핀이 어떻게 남았는가?'));
 assert.ok(mental.content.includes('변경 변수 하나'));
 assert.ok(mental.content.includes('/guide/average-and-score-distribution'));
 assert.ok(mental.content.includes('/guide/bowling-practice-checklist'));
 assert.equal(mental.content.includes('공개되기 전까지'),false);
 assert.ok(mental.content.includes('집중 상태나 루틴 수행 여부를 분석하는 기능은 제공하지 않습니다'));
 for(const claim of ['멘탈이 점수의 80%','평소 연습 폼을 100% 재현','3초간 고정','10초 멘탈 리셋','강인한 멘탈','하무','스각'])assert.equal((mental.title+'\n'+mental.description+'\n'+mental.content).includes(claim),false,claim);
});
test('published copy stays descriptive, typo-free and linked directly to live public routes',()=>{
 const publishedSlugs=new Set(PUBLISHED_GUIDE_ARTICLES.map(article=>article.slug));
 const knownTypos=['미너','스스코어','스각','하무','뇌 뇌파','무혈성 통증','39쪽','정밀 상술'];
 const unsupportedTrustClaims=['BowlingManager 연구소','전문 코치진','공식 규정위원회','건강 & 코칭팀','기술 규격팀','검증된 전문 가이드'];
 const clickbaitClaims=['완벽 정복','완전 정복','100% 성공','에버리지 20점','실력 급상승','점수 보장','공식 비밀'];
 const guideLink=/\]\(\/guide\/([a-z0-9-]+)(?:#[^)]+)?\)/g;
 const toolLink=/\]\((\/tools\/[a-z0-9-]+)(?:#[^)]+)?\)/g;
 for(const article of PUBLISHED_GUIDE_ARTICLES){
  const copy=[article.title,article.description,article.content].join('\n');
  assert.equal(article.title,article.title.trim(),`${article.slug}: title whitespace`);
  assert.equal(article.description,article.description.trim(),`${article.slug}: description whitespace`);
  assert.ok(article.title.length>=10&&article.title.length<=80,`${article.slug}: title length`);
  assert.ok(article.description.length>=30&&article.description.length<=180,`${article.slug}: description length`);
  assert.equal(/[\n*_`$]/.test(article.title+article.description),false,`${article.slug}: metadata markdown`);
  for(const phrase of [...knownTypos,...unsupportedTrustClaims,...clickbaitClaims])assert.equal(copy.includes(phrase),false,`${article.slug}: ${phrase}`);
  assert.equal(copy.includes('다음 통합 연습 체크리스트가 공개되기 전까지'),false,`${article.slug}: stale launch copy`);
  assert.equal(article.content.includes('\\text{'),false,`${article.slug}: raw LaTeX`);
  assert.equal(article.content.includes('$$'),false,`${article.slug}: raw display math`);
  assert.equal(/^\s*(?:#{1,6}|\*\*)\s*$/m.test(article.content),false,`${article.slug}: empty markdown marker`);
  assert.equal(/\*\*[^*\n]*\/\*\*/.test(article.content),false,`${article.slug}: slash breaks bold marker`);
  assert.equal((article.content.match(/\*\*/g)||[]).length%2,0,`${article.slug}: unpaired bold marker`);
  assert.equal((article.content.match(/`/g)||[]).length%2,0,`${article.slug}: unpaired code marker`);
  for(const match of article.content.matchAll(guideLink))assert.ok(publishedSlugs.has(match[1]),`${article.slug}: /guide/${match[1]}`);
  for(const match of article.content.matchAll(toolLink))assert.equal(match[1],'/tools/average',`${article.slug}: ${match[1]}`);
 }
 const publicUi=['src/app/page.tsx','src/app/guide/page.tsx','src/app/tools/average/page.tsx'].map(file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8')).join('\n');
 for(const internalPurpose of ['AdSense용','SEO 최적화 콘텐츠','검증된 전문 지식'])assert.equal(publicUi.includes(internalPurpose),false,internalPurpose);
});
test('all published guides expose scoped document metadata and canonical related links',()=>{
 const sourcedSlugs=new Set([
  'bowling-scoring-system',
  'beginner-bowling-etiquette',
  'bowling-ball-selection-guide',
  'bowling-specifications-and-dimensions',
  'advanced-bowling-techniques-and-theory',
  'bowling-ball-specifications-coverstock-core-rg-diff-guide',
  'spare-pickup-theory-and-3-6-9-system-guide',
  'bowling-lane-oiling-and-cleaning-maintenance-guide',
  'bowling-shoes-and-accessory-maintenance-guide',
 ]);
 const noteOnlySlugs=new Set([
  'bowling-mental-game-and-pre-shot-routine-guide',
  'average-and-score-distribution',
  'club-event-checklist',
  'bowling-practice-checklist',
 ]);
 const publishedSlugs=new Set(PUBLISHED_GUIDE_ARTICLES.map(article=>article.slug));
 assert.equal(PUBLISHED_GUIDE_ARTICLES.length,13);
 for(const article of PUBLISHED_GUIDE_ARTICLES){
  assert.match(article.lastReviewed,/^2026-09-30$/,article.slug+': lastReviewed');
  assert.equal(article.content.includes('## 마지막 검토일'),false,article.slug+': duplicate review section');
  const related=article.relatedArticles??[];
  assert.ok(related.length>=2&&related.length<=4,article.slug+': related article count');
  assert.equal(new Set(related).size,related.length,article.slug+': duplicate related article');
  for(const relatedSlug of related){
   assert.notEqual(relatedSlug,article.slug,article.slug+': self link');
   assert.ok(publishedSlugs.has(relatedSlug),article.slug+': '+relatedSlug);
   assert.equal(findMergedGuideDestination(relatedSlug),undefined,article.slug+': merged '+relatedSlug);
  }
  if(sourcedSlugs.has(article.slug)){
   assert.ok(article.references?.length,article.slug+': sources');
   assert.equal(article.reviewNote,undefined,article.slug+': source article note');
   for(const source of article.references){
    assert.ok(source.title.trim(),article.slug+': source title');
    assert.ok(source.publisher?.trim(),article.slug+': source publisher');
    assert.ok(source.scope?.trim(),article.slug+': source scope');
    assert.equal(policy.safeContentUrl(source.url),source.url,article.slug+': source URL');
   }
  }else{
   assert.ok(noteOnlySlugs.has(article.slug),article.slug+': source policy');
   assert.equal(article.references?.length??0,0,article.slug+': invented source');
   assert.ok(article.reviewNote?.length>40,article.slug+': reviewNote');
  }
  for(const resource of article.relatedResources??[]){
   assert.equal(policy.safeContentUrl(resource.url),resource.url,article.slug+': resource URL');
   assert.equal(resource.url,'/tools/average',article.slug+': unknown resource');
  }
 }
 const detail=fs.readFileSync(path.join(__dirname,'../src/app/guide/[slug]/page.tsx'),'utf8');
 for(const phrase of ['문서 정보','마지막 검토','참고자료','지원 범위:','관련 글','내용 정정','href="/inquiry"'])assert.ok(detail.includes(phrase),phrase);
 const renderedData=detail+'\n'+PUBLISHED_GUIDE_ARTICLES.map(article=>JSON.stringify(article)).join('\n');
 for(const falseTrust of ['전문가 검수','검증 완료','공식 인증'])assert.equal(renderedData.includes(falseTrust),false,falseTrust);
 const css=fs.readFileSync(path.join(__dirname,'../src/components/public/Public.module.css'),'utf8');
 assert.ok(css.includes('.documentInfo'));assert.ok(css.includes('.sourceList'));assert.ok(css.includes(':focus-visible'));
});
test('two overlapping practice guides merge into one canonical article with direct permanent redirects',()=>{
 const canonicalSlug='bowling-practice-checklist';
 const legacySlugs=['average-improvement-tips','bowling-basic-posture-guide'];
 const canonical=findPublishedGuideArticle(canonicalSlug);
 assert.ok(canonical);assert.equal(canonical.title,'볼링 연습 체크리스트: 한 세션에 한 변수씩 점검하기');
 assert.ok(canonical.content.includes('실제 회원 기록이 아닌 **가상 예시**'));
 assert.ok(canonical.content.includes('| 시도 | 확인 변수 | 목표 | 실제 결과 | 다음 시도 |'));
 assert.ok(canonical.content.includes('5~10회 기록하는 방식은 연습표를 채우기 위한 **예시 범위**'));
 assert.ok(canonical.content.includes('## 7. 세션 종료 체크리스트'));
 assert.ok(canonical.content.includes('## 참고 범위'));assert.equal(canonical.lastReviewed,'2026-09-30');
 assert.ok(canonical.content.includes('/guide/average-and-score-distribution'));
 assert.ok(canonical.content.includes('/guide/spare-pickup-theory-and-3-6-9-system-guide'));
 assert.ok(canonical.content.includes('/guide/advanced-bowling-techniques-and-theory'));
 for(const claim of ['에버리지 20점 올리는','정석','무조건','완성','100%','실력 급상승','점수 보장'])assert.equal((canonical.title+'\n'+canonical.description+'\n'+canonical.content).includes(claim),false,claim);
 for(const unsupported of ['자세 자동 분석','투구 보드 추적','프레임 단위의 스페어 통계','RPM 분석'])assert.ok(canonical.content.includes(unsupported));
 assert.ok(canonical.content.includes('기능은 제공하지 않으므로'));
 for(const legacySlug of legacySlugs){
  const source=GUIDE_ARTICLES.find(article=>article.slug===legacySlug);
  assert.equal(source.status,'merged');assert.equal(source.mergedInto,canonicalSlug);
  assert.equal(findPublishedGuideArticle(legacySlug),undefined);
  assert.equal(findMergedGuideDestination(legacySlug),canonicalSlug);
  assert.equal(MERGED_GUIDE_REDIRECTS[legacySlug],canonicalSlug);
 }
 assert.equal(findMergedGuideDestination(canonicalSlug),undefined);
 assert.equal(PUBLISHED_GUIDE_ARTICLES.filter(article=>article.slug===canonicalSlug).length,1);
 assert.equal(PUBLISHED_GUIDE_ARTICLES.some(article=>legacySlugs.includes(article.slug)),false);
 const visibleLinks=PUBLISHED_GUIDE_ARTICLES.map(article=>article.content).join('\n');
 for(const legacySlug of legacySlugs)assert.equal(visibleLinks.includes('/guide/'+legacySlug),false,legacySlug);
 const detail=fs.readFileSync(path.join(__dirname,'../src/app/guide/[slug]/page.tsx'),'utf8');
 assert.ok(detail.includes("permanentRedirect('/guide/'+mergedInto)"));
 assert.ok(detail.includes('findMergedGuideDestination(slug)'));
 for(const legacySlug of legacySlugs){
  assert.equal(
   policy.canonicalHostRedirectUrl(
    'https://bowlingmanager.co.kr/guide/'+legacySlug,
    {requestHostname:'bowlingmanager.co.kr',host:'bowlingmanager.co.kr'},
    true,
   ),
   'https://www.bowlingmanager.co.kr/guide/'+legacySlug,
  );
 }
 const sitemap=fs.readFileSync(path.join(__dirname,'../src/app/sitemap.ts'),'utf8');
 assert.ok(sitemap.includes('PUBLISHED_GUIDE_ARTICLES.map'));
 for(const hidden of ['kpba-official-bowling-tournament-rules-2026','health-benefits-and-effects-of-bowling','bowling-injury-prevention-and-stretching-guide']){
  assert.equal(findPublishedGuideArticle(hidden),undefined);assert.equal(findMergedGuideDestination(hidden),undefined);
 }
});
