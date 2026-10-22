const assert=require('node:assert/strict'),{test}=require('node:test'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const root=path.resolve(__dirname,'..');
function load(file,mocks={}){const m={exports:{}};const code=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;new Function('require','module','exports',code)(id=>{if(Object.hasOwn(mocks,id))return mocks[id];if(id==='react/jsx-runtime')return require(id);if(id.startsWith('.'))return load(path.relative(root,path.resolve(path.dirname(path.join(root,file)),id+'.ts')));throw Error('Unexpected dependency '+id);},m,m.exports);return m.exports;}
const policy=load('src/lib/public-web.ts'),guides=load('src/lib/guide-data.ts');
test('public center discovery has a unique title and a www self canonical without hiding content',()=>{
 const page=load('src/app/centers/page.tsx',{'@/lib/public-web':policy,'@/lib/prisma':{},'next/link':()=>null,'./CentersDiscovery.module.css':{}});
 assert.equal(page.metadata.alternates.canonical,'https://www.bowlingmanager.co.kr/centers');assert.match(page.metadata.title,/볼링장/);assert.match(page.metadata.description,/상주리그/);assert.equal(page.metadata.robots,undefined);
});
test('account-recovery layout hides all recovery forms from indexing without altering rendering or blocking crawling',()=>{
 const layout=load('src/app/find-account/layout.tsx');assert.deepEqual(layout.metadata.robots,{index:false,follow:false});assert.equal(layout.default({children:'recovery form'}),'recovery form');
 const rules=load('src/app/robots.ts',{'@/lib/public-web':policy}).default();assert.equal(rules.rules[0].allow,'/');assert.ok(!rules.rules[0].disallow.some(p=>p.includes('find-account')));
});
test('sitemap includes public center discovery and excludes utility, moved and unpublished URLs',async()=>{
 let query;const sitemap=load('src/app/sitemap.ts',{'@/lib/public-web':policy,'@/lib/guide-data':guides,'@/lib/prisma':{competitionNotice:{findMany:async q=>{query=q;return[{id:'published-notice',updatedAt:new Date('2026-10-20')}];}}},'@/lib/manufacturer-equipment':{MANUFACTURER_EQUIPMENT:[{slug:'public-product',updatedAt:'2026-10-20'}]}});
 const entries=await sitemap.default(),urls=entries.map(e=>e.url);assert.equal(urls.filter(u=>u===policy.PUBLIC_ORIGIN+'/centers').length,1);assert.equal(new Set(urls).size,urls.length);assert.equal(query.where.published,true);
 for(const u of urls){assert.equal(new URL(u).hostname,'www.bowlingmanager.co.kr');assert.ok(!/\/(?:find-account|login|register|tournaments)(?:[/?]|$)/.test(u));}
 for(const article of guides.GUIDE_ARTICLES.filter(a=>a.status==='unpublished'||a.status==='merged'))assert.ok(!urls.includes(policy.PUBLIC_ORIGIN+'/guide/'+article.slug));
 assert.ok(urls.includes(policy.PUBLIC_ORIGIN+'/competitions/published-notice'));
});
test('legacy tournaments routing keeps temporary role-dependent navigation and existing center-manager lookup',async()=>{
 for(const user of [null,{id:'member',role:'USER'},{id:'admin',role:'CENTER_ADMIN'}])for(const center of [null,{id:'managed-center'}]){
  const calls=[];const page=load('src/app/tournaments/page.tsx',{'@/auth':{auth:async()=>user?{user}:null},'next/navigation':{redirect:url=>{throw {url,status:307};}},'@/lib/prisma':{bowlingCenter:{findFirst:async q=>{calls.push(q);return center;}}}});
  const managed=user?.role==='CENTER_ADMIN';await assert.rejects(page.default(),e=>e.status===307&&e.url===(managed&&center?'/centers/managed-center':'/centers'));
  assert.equal(calls.length,managed?1:0);if(managed)assert.deepEqual(calls[0].where,{managers:{some:{id:'admin'}}});
 }
});
test('reported root and merged guide remain canonical redirects with an indexable replacement',()=>{
 assert.equal(policy.canonicalHostRedirectUrl('https://bowlingmanager.co.kr/',{requestHostname:'bowlingmanager.co.kr'},true),policy.PUBLIC_ORIGIN+'/');assert.equal(guides.findMergedGuideDestination('average-improvement-tips'),'bowling-practice-checklist');const replacement=guides.findPublishedGuideArticle('bowling-practice-checklist');assert(replacement);assert.notEqual(replacement.status,'unpublished');
});
