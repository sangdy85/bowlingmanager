const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

// Render the real server pages and their components without opening any DB.
function fixture({ posts = [], notices = [], role = null } = {}) {
    const cache = new Map(), calls = [];
    const record = (name, result) => async args => { calls.push({ name, args }); return result; };
    const db = {
        user: { findUnique: record('user', role ? { id: 'fixture-user', role } : null) },
        communityPost: {
            findMany: record('posts', posts), count: record('postCount', posts.length),
            groupBy: record('groups', posts.length ? [{ category: 'EQUIPMENT', _count: { _all: posts.length } }] : []),
        },
        competitionNotice: { findMany: record('notices', notices), count: record('noticeCount', notices.length) },
    };
    const mocks = {
        '@/auth': { auth: async () => role ? { user: { id: 'fixture-user', role } } : null },
        '@/lib/prisma': { __esModule: true, default: db },
        'next/link': ({ children, prefetch, ...props }) => React.createElement('a', props, children),
        'next/navigation': { notFound: () => { throw new Error('NOT_FOUND'); }, redirect: url => { throw new Error('REDIRECT:' + url); } },
    };
    function load(relative) {
        const file = path.resolve(__dirname, '..', relative);
        if (cache.has(file)) return cache.get(file).exports;
        if (file.endsWith('.json')) return JSON.parse(fs.readFileSync(file, 'utf8'));
        if (file.endsWith('.css')) return new Proxy({}, { get: (_, key) => String(key) });
        const mod = { exports: {} }; cache.set(file, mod);
        const req = createRequire(file);
        const localRequire = id => {
            if (Object.hasOwn(mocks, id)) return mocks[id];
            if (id.startsWith('@/') || id.startsWith('.')) {
                const base = id.startsWith('@/') ? path.resolve(__dirname, '../src', id.slice(2)) : path.resolve(path.dirname(file), id);
                const target = [base, base + '.ts', base + '.tsx'].find(p => fs.existsSync(p) && fs.statSync(p).isFile());
                assert(target, 'resolve ' + id);
                return load(path.relative(path.resolve(__dirname, '..'), target));
            }
            return req(id);
        };
        const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
        new Function('require', 'module', 'exports', js)(localRequire, mod, mod.exports);
        return mod.exports;
    }
    async function render(page, params = {}) {
        return renderToStaticMarkup(await load(`src/app/${page}/page.tsx`).default({ searchParams: Promise.resolve(params) }));
    }
    return { load, render, calls };
}

test('equipment and community provide editorial content even without member records', async () => {
    for (const [page, id, heading] of [
        ['equipment', 'equipment-checklist', '첫 장비, 무엇을 비교해야 할까요?'],
        ['community', 'posting-guide', '질문에 맥락을 더하면 답변도 구체적이 됩니다.'],
    ]) {
        const html = await fixture().render(page);
        assert(html.includes(heading));
        assert(html.includes(`id="${id}"`));
        assert(html.includes(`href="#${id}"`));
        assert.equal((html.match(/<h1\b/g) || []).length, 1);
        assert(!html.includes('전문가 검수 완료'));
    }
});

test('community editorial notes stay distinct from member counts and preserve public contact',async()=>{
 const f=fixture(),html=await f.render('community');
 assert(html.includes('총 0개 글'));assert(html.includes('회원 게시글·사용 후기와 구분'));
 for(const slug of ['league-results-reading-guide','champ-event-participant-lane-results-guide','score-photo-verification-checklist'])assert(html.includes('href="/guide/'+slug+'"'));
 const footer=renderToStaticMarkup(React.createElement(f.load('src/components/Footer.tsx').default));
 assert(footer.includes('href="mailto:sangdy85@gmail.com"'));assert(footer.includes('비회원'));
});

test('verified product notes transcribe manufacturer weights without treating absent MB as zero',()=>{
 const f=fixture(),{PRODUCT_SPEC_NOTES}=f.load('src/lib/product-spec-notes.ts');
 const {manufacturerEquipment}=f.load('src/lib/manufacturer-equipment.ts');
 assert.equal(PRODUCT_SPEC_NOTES.length,3);
 const expected=[['2.538','0.041',undefined],['2.499','0.051','0.017'],['2.522','0.032',undefined]];
 PRODUCT_SPEC_NOTES.forEach((note,i)=>{
  assert.deepEqual(note.weights.map(row=>row.lb),[13,14,15,16]);
  assert.equal(manufacturerEquipment(note.slug).updatedAt,'2026-10-30');
  const row=note.weights.find(row=>row.lb===15);assert.deepEqual([row.rg,row.diff,row.mb],expected[i]);
  const html=renderToStaticMarkup(React.createElement(f.load('src/components/equipment/ProductSpecNotes.tsx').default,{slug:note.slug}));
  assert(html.includes('모두 15lb 기준'));assert(html.includes(note.sourceUrl));assert(html.includes('scope="row"'));assert(html.includes('2026-10-30'));
  for(const other of PRODUCT_SPEC_NOTES)assert(html.includes(other.model));
 });
 assert.equal(renderToStaticMarkup(React.createElement(f.load('src/components/equipment/ProductSpecNotes.tsx').default,{slug:'not-reviewed'})),'');
});

test('equipment retains member reviews, escaped user text, filters and write entry', async () => {
    const f = fixture({ posts: [{ id: 'equipment-fixture', title: '<script>fixture</script>', content: '가상 후기', category: 'EQUIPMENT', createdAt: new Date('2026-10-19'), equipmentType: 'REVIEW', equipmentCategory: 'BALL', equipmentBrand: '가상 브랜드', equipmentModel: '가상 모델', author: { name: '가상 작성자' }, _count: { comments: 2 } }] });
    const html = await f.render('equipment', { category: 'BALL', type: 'REVIEW', q: '가상', page: '2' });
    assert(html.includes('href="/equipment/equipment-fixture"'));
    assert(html.includes('&lt;script&gt;fixture&lt;/script&gt;'));
    assert(html.includes('href="/equipment/new"'));
    assert(html.includes('scope="col"') && html.includes('scope="row"'));
    const query = f.calls.find(c => c.name === 'posts').args;
    assert.equal(query.skip, 12); assert.equal(query.take, 12);
    const where = JSON.stringify(query.where);
    for (const term of ['PUBLISHED', 'BALL', 'REVIEW', '가상']) assert(where.includes(term));
});

test('competition list and calendar keep live records and super-admin-only registration entry', async () => {
    const row = { id: 'notice-fixture', title: '가상 대회', published: true, format: '개인전', organizer: '가상 주관사', venue: '가상 장소', fee: '요강 확인', eventTime: '10:00', startDate: new Date('2026-10-20'), endDate: new Date('2026-10-20'), registrationStartDate: new Date('2026-10-01'), registrationEndDate: new Date('2026-10-19') };
    for (const view of ['list', 'calendar']) {
        const html = await fixture({ notices: [row] }).render('competitions', { view, month: '2026-10' });
        assert(html.includes('href="/competitions/notice-fixture"'));
        assert(!html.includes('href="/competitions/new"'));
        assert(!html.includes('id="entry-checklist"'));
        if (view === 'calendar') assert(html.includes('2026-10 대회 일정 달력'));
    }
    const admin = await fixture({ role: 'SUPER_ADMIN' }).render('competitions');
    assert(admin.includes('href="/competitions/new"'));
    const member = await fixture({ role: 'USER' }).render('competitions');
    assert(!member.includes('href="/competitions/new"'));
});

test('community keeps login boundary, category filtering and private/search noindex', async () => {
    const f = fixture();
    await assert.rejects(() => f.render('community', { scope: 'mine' }), /REDIRECT:\/login/);
    const html = await f.render('community', { category: 'QUESTION', q: '스페어' });
    assert(html.includes('href="/community/new?category=QUESTION"'));
    assert(html.includes('<details>') && html.includes('작성용 빈 양식입니다.'));
    assert(!html.includes('title="실제 회원 후기"'));
    for (const params of [{ scope: 'mine' }, { q: '스페어' }]) {
        const meta = await f.load('src/app/community/page.tsx').generateMetadata({ searchParams: Promise.resolve(params) });
        assert.equal(meta.robots.index, false);
    }
});

test('equipment and community editorial links target published guides', () => {
    const f = fixture(), { PUBLISHED_GUIDE_ARTICLES } = f.load('src/lib/guide-data.ts');
    const components = f.load('src/components/public/ReadingGuides.tsx');
    for (const Component of Object.values(components)) {
        const html = renderToStaticMarkup(React.createElement(Component));
        for (const [, slug] of html.matchAll(/href="\/guide\/([^"?#]+)"/g)) {
            assert(PUBLISHED_GUIDE_ARTICLES.some(a => a.slug === slug), 'published target: ' + slug);
        }
        for (const [, anchor] of html.matchAll(/aria-labelledby="([^"]+)"/g)) assert(html.includes(`id="${anchor}"`));
    }
});

test('early announcements render their full source-backed copy and remain separate from registration', async () => {
    const html = await fixture().render('competitions');
    assert(html.includes('제83회 진승인터내셔널 고객감사 페스티벌'));
    assert(html.includes('일정 안내 자세히 읽기'));
    assert(html.includes('접수 요강 확인 필요'));
    assert(html.includes('https://bowlingkorea.com/tournament/notice/298'));
    const registering = await fixture().render('competitions', { status: 'registering' });
    assert(!registering.includes('upcoming-announcements-title'));
});

const escapeHtml = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#x27;');
const allProducts = fixture().load('src/lib/manufacturer-equipment.ts').MANUFACTURER_EQUIPMENT;
test('manufacturer catalogue preserves review separation and actual category/search filtering', async () => {
    const f = fixture(), products = f.load('src/lib/manufacturer-equipment.ts');
    assert.equal(products.searchManufacturerEquipment().length, 759);
    assert.equal(products.searchManufacturerEquipment('', 'BALL', 'INTRO').length, 752);
    for (const [category, count] of [['SHOES', 2], ['BAG', 2], ['ACCESSORY', 3]]) assert.equal(products.searchManufacturerEquipment('', category).length, count);
    assert(products.searchManufacturerEquipment('RECKONING').some(p => p.slug === 'hammer-reckoning'));
    assert.equal(products.searchManufacturerEquipment('', '', 'REVIEW').length, 0);
    const html = await f.render('equipment');
    assert(html.includes('제조사·판매처 자료로 살펴보는 볼링 용품'));
    assert(html.includes('회원 소개·후기'));
    for (const product of allProducts.slice(0, 24)) assert(html.includes('/equipment/products/' + product.slug));
    assert(!html.includes('/equipment/products/' + allProducts[24].slug));
    const review = await fixture().render('equipment', {type: 'REVIEW'});
    assert(!review.includes('id="manufacturer-equipment"'));
    assert(review.includes('href="/equipment/new"'));
});
test('manufacturer product routes render real copy, official links and canonical metadata without member impersonation', async () => {
    const route = fixture().load('src/app/equipment/products/[slug]/page.tsx');
    assert.equal(route.generateStaticParams().length, 759);
    for (const product of allProducts) {
        const params = Promise.resolve({slug: product.slug});
        const html = renderToStaticMarkup(await route.default({params}));
        assert(html.includes(escapeHtml(product.title)));
        assert(html.includes(product.sourceLinkLabel));
        assert(html.includes(product.sourceUrl.replaceAll('&', '&amp;')));
        assert(html.includes('직접 사용 후기나 독립 성능 시험 결과가 아닙니다'));
        assert(!html.includes('댓글 0'));
        const meta = await route.generateMetadata({params});
        assert.equal(meta.alternates.canonical, 'https://www.bowlingmanager.co.kr/equipment/products/' + product.slug);
    }
    const upcoming = renderToStaticMarkup(await route.default({params: Promise.resolve({slug: 'hammer-reckoning'})}));
    assert(upcoming.includes('제조사 해외 출시 예정일'));
    assert(upcoming.includes('2026-11-19'));
    await assert.rejects(() => route.default({params: Promise.resolve({slug: 'missing-product'})}), /NOT_FOUND/);
    assert.equal((await route.generateMetadata({params: Promise.resolve({slug: 'missing-product'})})).robots.index, false);
});
test('every authored product cites its actual source and scopes any ball numbers by weight', () => {
    assert.equal(new Set(allProducts.map(p => p.slug)).size, 759);
    for (const product of allProducts) {
        const url = new URL(product.sourceUrl);
        assert.equal(url.protocol, 'https:');
        assert(['www.stormbowling.com', 'hammerbowling.com', 'brunswickbowling.com', 'www.dexterbowling.com', 'www.motivbowling.com', 'ebonite.com', 'bowlingkoreamall.com', 'www.twinssport.co.kr', 'mkbowling.com', 'smartstore.naver.com', 'www.lordfield.com'].includes(url.hostname));
        assert.equal(url.username, ''); assert.equal(url.password, '');
        if (product.category === 'BALL' && product.sourceBadge === '제조사 자료 정리') assert(product.specs.some(([label]) => /(?:15|16) lb RG/.test(label)));
    }
});

test('catalogue photos are distinct, decodable local assets with actual source attribution on cards and details', async () => {
    const sharp = require('sharp'), crypto = require('node:crypto'), hashes = new Set();
    const cataloguePages = await Promise.all(Array.from({length: Math.ceil(allProducts.length / 24)}, (_, i) => fixture().render('equipment', {productPage: String(i + 1)})));
    const catalogue = cataloguePages.join('');
    const route = fixture().load('src/app/equipment/products/[slug]/page.tsx');
    for (const product of allProducts) {
        const photo = product.image;
        assert(photo.src.startsWith('/images/equipment/'));
        const bytes = fs.readFileSync(path.join(__dirname, '../public', photo.src));
        const meta = await sharp(bytes).metadata();
        assert.equal(meta.width, photo.width); assert.equal(meta.height, photo.height);
        assert(meta.width >= 300 && meta.height >= 300);
        hashes.add(crypto.createHash('sha256').update(bytes).digest('hex'));
        assert.equal(new URL(photo.sourceUrl).protocol, 'https:');
        assert(photo.credit.includes(product.brand));
        assert.equal(photo.checkedAt, product.checkedAt);
        for (const html of [catalogue, renderToStaticMarkup(await route.default({params: Promise.resolve({slug: product.slug})}))]) {
            assert(html.includes(encodeURIComponent(photo.src)), 'optimized photo: ' + product.slug);
            assert(html.includes(escapeHtml(photo.alt)));
            assert(html.includes('사진:'));
        }
    }
    assert.equal(hashes.size, 758, 'only MK explicitly documented PLATINUM / WHITE original photo is shared');
});

test('all 43 Korea Mall listings are represented once without duplicating ROCKET A.I.', async () => {
    const mall = require('../content/equipment/koreamall-20261020.json');
    assert.equal(mall.products.length + mall.existingLinks.length, mall.listingTotal);
    assert.equal(mall.listingTotal, 43);
    assert.equal(mall.products.length, 42);
    assert.equal(new Set([...mall.products.map(p => p.sourceUrl), ...mall.existingLinks.map(p => p.sourceUrl)]).size, 43);
    assert.equal(allProducts.filter(p => p.slug === 'storm-rocket-ai').length, 1);
    const f = fixture(), catalog = f.load('src/lib/manufacturer-equipment.ts');
    assert.equal(catalog.searchManufacturerEquipment('900 GLOBAL').length, 1);
    assert.equal(catalog.searchManufacturerEquipment('ROTO GRIP', 'BALL').filter(p=>p.brand==='ROTO GRIP').length, 8);
    const page = f.load('src/app/equipment/products/[slug]/page.tsx');
    const rocket = renderToStaticMarkup(await page.default({params:Promise.resolve({slug:'storm-rocket-ai'})}));
    assert(rocket.includes('제조사 공식 제품 페이지'));
    assert(rocket.includes(mall.existingLinks[0].sourceUrl));
    const original = require('../content/equipment/manufacturers-20261019.json');
    for (const old of original.products) {
        const current = catalog.manufacturerEquipment(old.slug);
        for (const key of ['title','summary','specs','paragraphs','checks','image','sourceUrl','releaseDate']) assert.deepEqual(current[key],old[key]);
    }
});

test('Korea Mall copy distinguishes similar models and never presents retailer material as a manufacturer test or a dated launch', async () => {
    const mall = require('../content/equipment/koreamall-20261020.json');
    const f=fixture(), route=f.load('src/app/equipment/products/[slug]/page.tsx');
    for (const p of mall.products) {
        const url = new URL(p.sourceUrl);
        assert.equal(url.hostname,'bowlingkoreamall.com');
        assert.equal(url.pathname,'/shop/detail.php');
        assert(/^[A-F0-9]{32}$/.test(url.searchParams.get('pno')));
        assert.equal(p.releaseDate,null);
        assert.equal(p.category,'BALL');
        assert(p.specs.some(([k,v])=>k==='커버' && v));
        assert(p.specs.some(([k,v])=>k==='코어' && v));
        assert(p.specs.some(([k,v])=>k==='공장 표면' && v));
        const html=renderToStaticMarkup(await route.default({params:Promise.resolve({slug:p.slug})}));
        assert(html.includes('판매처 자료 정리'));
        assert(html.includes('진승 쇼핑몰 제품 페이지'));
        assert(!html.includes('제조사 공식 제품 페이지'));
        assert(!html.includes('제조사 해외 출시일'));
        assert(!/\d{2,3},000원|점수 향상 보장|실제 사용해/.test(html));
    }
    const cover = slug=>mall.products.find(p=>p.slug===slug).specs.find(([k])=>k==='커버')[1];
    assert.equal(cover('storm-equinox-hybrid'),'A2S Hybrid Reactive');
    assert.notEqual(cover('storm-concept'),cover('storm-concept-purple'));
    assert.notEqual(cover('storm-pitch-black'),cover('storm-pitch-black-78-u'));
    assert.notEqual(cover('storm-tropical-surge-silver-purple'),cover('storm-tropical-surge-black-blue-pink'));
    assert.equal(cover('storm-ice-30-snow-white'),'Solid Polyester');
    assert.equal(cover('storm-mix-blackout'),'U1S Hybrid Urethane');
});

test('adding new retailer material does not change the check date of untouched manufacturer products', async () => {
    const entries=await fixture().load('src/app/sitemap.ts').default();
    for (const [slug,date] of [['motiv-forge-fuel','2026-10-19'],['storm-rocket-ai','2026-10-20'],['storm-iq-focus','2026-10-20']]) {
        assert.equal(entries.find(e=>e.url.endsWith('/equipment/products/'+slug)).lastModified.toISOString().slice(0,10),date);
    }
});

test('product photo has an accessible missing-image fallback', () => {
    const Photo = fixture().load('src/components/equipment/ProductPhoto.tsx').default;
    const html = renderToStaticMarkup(React.createElement(Photo));
    assert(!html.includes('<img'));
    assert(html.includes('사진을 불러오지 못했습니다.'));
    assert(html.includes('공식 제품 링크에서 확인해주세요.'));
});
test('sitemap publishes the editorial product URLs and preserves existing competition URLs', async () => {
    const f = fixture({notices: [{id: 'preserved-notice', updatedAt: new Date('2026-10-19')} ]});
    const entries = await f.load('src/app/sitemap.ts').default();
    for (const product of allProducts) assert(entries.some(e => e.url.endsWith('/equipment/products/' + product.slug)));
    assert(entries.some(e => e.url.endsWith('/competitions/preserved-notice')));
});


test('Twins catalogue covers all 23 listing products with real local photographs and honest retailer attribution',async()=>{
 const twins=require('../content/equipment/twins-20261021.json'),f=fixture(),catalog=f.load('src/lib/manufacturer-equipment.ts'),route=f.load('src/app/equipment/products/[slug]/page.tsx');
 assert.equal(twins.listingTotal,23);assert.equal(twins.products.length,23);assert.equal(new Set(twins.products.map(p=>p.sourceUrl)).size,23);
 assert.equal(catalog.searchManufacturerEquipment('트윈스스포츠').length,23);assert.equal(catalog.searchManufacturerEquipment('스나이퍼','BALL').length,3);assert.equal(catalog.searchManufacturerEquipment('트윈스스포츠','','REVIEW').length,0);
 for(const p of twins.products){assert.equal(p.brand,'MOTIV');assert.equal(p.category,'BALL');assert.equal(p.releaseDate,null);assert.equal(p.paragraphs.length,2);assert.equal(new URL(p.sourceUrl).hostname,'www.twinssport.co.kr');assert.equal(new URL(p.sourceUrl).pathname,'/shop/item.php');assert(/^\d+$/.test(new URL(p.sourceUrl).searchParams.get('it_id')));assert(p.image.sourceUrl.includes('/data/item/'));assert(!p.image.sourceUrl.includes('/img/og'));assert(p.specs.some(([key,value])=>key==='재질·커버(판매처 표기)'&&value));assert(!/\d[\d,]*원|성능 보장/.test(p.summary));const html=renderToStaticMarkup(await route.default({params:Promise.resolve({slug:p.slug})}));assert(html.includes('트윈스스포츠 제품 페이지'));assert(html.includes('판매처 자료 정리'));assert(html.includes(p.sourceUrl.replaceAll('&','&amp;')));assert(!html.includes('제조사 해외 출시일'));assert(!html.includes('제조사 공식 제품 페이지'));}
});

test('Twins addition preserves the previous sixty product originals and their per-product dates',async()=>{
 const f=fixture(),catalog=f.load('src/lib/manufacturer-equipment.ts'),old=[...require('../content/equipment/koreamall-20261020.json').products,...require('../content/equipment/manufacturers-20261019.json').products];assert.equal(old.length,60);for(const p of old){const current=catalog.manufacturerEquipment(p.slug);for(const key of ['title','summary','specs','paragraphs','checks','image','sourceUrl','releaseDate'])assert.deepEqual(current[key],p[key]);}
 const entries=await f.load('src/app/sitemap.ts').default();for(const p of require('../content/equipment/twins-20261021.json').products){const entry=entries.find(e=>e.url==='https://www.bowlingmanager.co.kr/equipment/products/'+p.slug);assert(entry);assert.equal(entry.lastModified.toISOString().slice(0,10),'2026-10-21');}assert.equal(entries.find(e=>e.url.endsWith('/equipment/products/storm-iq-focus')).lastModified.toISOString().slice(0,10),'2026-10-20');
});


test('MK all 382 source listings are accounted for with safe specs, variants and preserved existing product', async () => {
 const bundle=require('../content/equipment/mk-20261021.json'), f=fixture(), catalog=f.load('src/lib/manufacturer-equipment.ts');
 assert.equal(bundle.listingTotal,382);assert.equal(bundle.products.length,378);assert.equal(bundle.listingCoverage.length,382);assert.equal(new Set(bundle.listingCoverage.map(p=>p.sourceUrl)).size,382);
 for(const item of bundle.listingCoverage){const p=catalog.manufacturerEquipment(item.slug);assert(p);assert([p.sourceUrl,...p.additionalSources.map(s=>s.url)].includes(item.sourceUrl));}
 const byId=id=>bundle.products.find(p=>new URL(p.sourceUrl).searchParams.get('wr_id')===id);
 for(const id of ['147','7','6']){const p=byId(id);assert(!p.specs.some(([k])=>/코어|공장 표면/.test(k)));assert(p.paragraphs.some(t=>/확인|뒤바뀐/.test(t)));}
 assert(byId('143').paragraphs.some(t=>t.includes('비어')));assert(byId('232').paragraphs.some(t=>t.includes('같은 대표사진')));
 assert.notEqual(byId('167').slug,byId('165').slug);assert.notEqual(byId('84').slug,byId('61').slug);
 for(const p of bundle.products){assert.equal(p.releaseDate,null);assert.equal(p.category,'BALL');assert(!p.specs.some(([k])=>/RG|DIFF|RD/.test(k)));assert.equal(new URL(p.sourceUrl).hostname,'mkbowling.com');assert.equal(p.image.checkedAt,'2026-10-21');}
 assert.equal(catalog.MANUFACTURER_EQUIPMENT.filter(p=>p.slug==='hammer-black-widow-mania').length,1);
});

test('Brunswick Korea accounts for all 88 listings without inventing image-only technical specifications', async () => {
 const bundle=require('../content/equipment/brunswick-korea-20261021.json'),catalog=fixture().load('src/lib/manufacturer-equipment.ts');
 assert.equal(bundle.listingTotal,88);assert.equal(bundle.products.length,86);assert.equal(bundle.listingCoverage.length,88);assert.equal(new Set(bundle.listingCoverage.map(p=>p.sourceUrl)).size,88);
 for(const item of bundle.listingCoverage){const p=catalog.manufacturerEquipment(item.slug);assert(p);assert([p.sourceUrl,...p.additionalSources.map(s=>s.url)].includes(item.sourceUrl));}
 const team=bundle.products.find(p=>p.sourceUrl.endsWith('/13781550724'));assert(!team.specs.some(([k])=>k.includes('외피')));assert(team.paragraphs.some(t=>t.includes('재질을 확정하지')));
 const crown=bundle.products.find(p=>p.sourceUrl.endsWith('/13781753217'));assert(crown.additionalSources[0].url.endsWith('/13431095759'));
 for(const p of bundle.products){assert.equal(p.releaseDate,null);assert(!p.specs.some(([k])=>/RG|DIFF|코어/.test(k)));assert.equal(new URL(p.sourceUrl).hostname,'smartstore.naver.com');assert.equal(new URL(p.image.sourceUrl).hostname,'shop-phinf.pstatic.net');assert(p.checks.some(t=>t.includes('출시일')));}
 assert.equal(catalog.MANUFACTURER_EQUIPMENT.filter(p=>p.slug==='brunswick-infinity-quest-pearl').length,1);
});

test('product pagination covers every product once, preserves filters and is separate from member pagination', async () => {
 const f=fixture(),catalog=f.load('src/lib/manufacturer-equipment.ts'),seen=[];
 for(let page=1;page<=32;page++){const result=catalog.pageManufacturerEquipment('','','',page);assert.equal(result.page,page);assert.equal(result.total,759);assert(result.products.length<=24);seen.push(...result.products.map(p=>p.slug));}
 assert.deepEqual(seen,allProducts.map(p=>p.slug));assert.equal(new Set(seen).size,759);
 assert.equal(catalog.pageManufacturerEquipment('','','',Infinity).page,1);assert.equal(catalog.pageManufacturerEquipment('','','',-2).page,1);assert.equal(catalog.pageManufacturerEquipment('','','',9999).page,32);
 assert.equal(catalog.pageManufacturerEquipment('','','REVIEW',3).total,0);
 const html=await f.render('equipment',{q:'래디컬',category:'BALL',type:'INTRO',productPage:'1',page:'3'});
 const next=html.match(/href="([^"]+)"[^>]*>다음 제품/);assert(next);const url=new URL(next[1].replaceAll('&amp;','&'),'https://example.test');assert.equal(url.searchParams.get('q'),'래디컬');assert.equal(url.searchParams.get('category'),'BALL');assert.equal(url.searchParams.get('type'),'INTRO');assert.equal(url.searchParams.get('productPage'),'2');assert.equal(url.searchParams.get('page'),'3');
 assert.equal(f.calls.find(c=>c.name==='posts').args.skip,24);assert.equal(f.calls.find(c=>c.name==='posts').args.take,12);
});

test('the previous 83 product texts, pictures and original source check dates stay intact', () => {
 const catalog=fixture().load('src/lib/manufacturer-equipment.ts');const previous=['manufacturers-20261019','koreamall-20261020','twins-20261021'].flatMap(name=>require('../content/equipment/'+name+'.json').products);assert.equal(previous.length,83);
 for(const p of previous){const current=catalog.manufacturerEquipment(p.slug);for(const key of ['title','summary','specs','paragraphs','checks','image','sourceUrl','releaseDate'])assert.deepEqual(current[key],p[key]);}
});

test('ball manufacturer groups cover every ball once and combine case variants without inventing a maker', () => {
 const catalog=fixture().load('src/lib/manufacturer-equipment.ts');
 const balls=catalog.MANUFACTURER_EQUIPMENT.filter(p=>p.category==='BALL');
 assert.equal(catalog.BOWLING_BALL_BRANDS.reduce((sum,b)=>sum+b.count,0),balls.length);
 const seen=[];
 for(const group of catalog.BOWLING_BALL_BRANDS){
  const matches=catalog.searchManufacturerEquipment('','BALL','',group.id);
  assert.equal(matches.length,group.count);seen.push(...matches.map(p=>p.slug));
 }
 assert.equal(new Set(seen).size,balls.length);
 const storm=catalog.searchManufacturerEquipment('','BALL','','storm');
 assert(storm.some(p=>p.brand==='Storm'));assert(storm.some(p=>p.brand==='STORM'));
 assert.equal(catalog.bowlingBallBrand(' STORM '),'storm');
 assert.equal(catalog.bowlingBallBrand('not-a-maker'),'');
 assert.equal(catalog.BOWLING_BALL_BRANDS.find(b=>b.id==='unverified').label,'제조사 미확인');
 assert(catalog.searchManufacturerEquipment('','BALL','','unverified').every(p=>p.brand==='MK 하드 분류'));
 assert(!catalog.BOWLING_BALL_BRANDS.some(b=>/트윈스|진승/.test(b.label)));
});

test('manufacturer pagination and search intersect and retain every matching product', () => {
 const catalog=fixture().load('src/lib/manufacturer-equipment.ts'),seen=[];
 const matches=catalog.searchManufacturerEquipment('','BALL','INTRO','hammer');
 const last=catalog.pageManufacturerEquipment('','BALL','INTRO',999,'hammer');
 for(let page=1;page<=last.pages;page++)seen.push(...catalog.pageManufacturerEquipment('','BALL','INTRO',page,'hammer').products.map(p=>p.slug));
 assert.deepEqual(seen,matches.map(p=>p.slug));assert.equal(new Set(seen).size,matches.length);
 assert(catalog.searchManufacturerEquipment('black','BALL','','hammer').every(p=>p.brand==='Hammer'&&JSON.stringify(p).toLowerCase().includes('black')));
 assert.equal(catalog.searchManufacturerEquipment('a-nonexistent-model','BALL','','hammer').length,0);
 assert.equal(catalog.searchManufacturerEquipment('','SHOES','','hammer').length,0);
 assert.equal(catalog.searchManufacturerEquipment('','BALL','REVIEW','hammer').length,0);
 assert.equal(catalog.searchManufacturerEquipment('','BALL','','unknown').length,catalog.searchManufacturerEquipment('','BALL').length);
});

test('real equipment page preserves selected manufacturer through search and both pagers, resetting only product page on brand change', async () => {
 const f=fixture(),html=await f.render('equipment',{category:'BALL',type:'INTRO',brand:'hammer',page:'3',productPage:'2'});
 const nav=label=>{const match=html.match(new RegExp('<nav[^>]*aria-label="'+label+'"[^>]*>([\\s\\S]*?)</nav>'));assert(match,label);return match[1];};
 const links=markup=>[...markup.matchAll(/<a\b([^>]*)href="([^"]+)"([^>]*)>([\s\S]*?)<\/a>/g)];
 const urlOf=link=>new URL(link[2].replaceAll('&amp;','&'),'https://example.test');
 const brands=nav('볼링공 제조사');
 assert.match(links(brands).find(a=>(a[1]+a[3]).includes('aria-current="page"'))[4],/Hammer/);
 const storm=urlOf(links(brands).find(a=>a[4].includes('STORM')));
 for(const [key,value] of Object.entries({category:'BALL',type:'INTRO',brand:'storm',page:'3',productPage:'1'}))assert.equal(storm.searchParams.get(key),value);
 assert(html.includes('name="brand" value="hammer"'));
 const url=urlOf(links(nav('제조사·판매처 제품 페이지')).find(a=>a[4]==='다음 제품'));assert.equal(url.searchParams.get('brand'),'hammer');assert.equal(url.searchParams.get('productPage'),'3');assert.equal(url.searchParams.get('page'),'3');
 const member=urlOf(links(nav('용품 페이지'))[0]);assert.equal(member.searchParams.get('brand'),'hammer');assert.equal(member.searchParams.get('productPage'),'2');
 const where=f.calls.find(c=>c.name==='posts').args.where;assert.equal(where.equipmentCategory,'BALL');assert(!Object.hasOwn(where,'equipmentBrand'));
 const shoes=urlOf(links(nav('용품 종류')).find(a=>a[4].includes('볼링화')));assert.equal(shoes.searchParams.get('brand'),'');assert.equal(shoes.searchParams.get('productPage'),'1');
});

test('unknown/repeated manufacturers fall back safely and non-ball categories/reviews retain their existing scope', async () => {
 for(const brand of ['unknown',['hammer','storm']]){
  const html=await fixture().render('equipment',{category:'BALL',brand});
  assert(html.includes('name="brand" value=""'));assert(html.includes('조건에 맞는 제품 752개'));
 }
 for(const params of [{category:'SHOES',brand:'hammer'},{category:'BALL',type:'REVIEW',brand:'hammer'}]){
  const html=await fixture().render('equipment',params);assert(!html.includes('aria-label="볼링공 제조사"'));assert(html.includes('name="brand" value=""'));
 }
 const html=await fixture().render('equipment',{category:'BALL',brand:'hammer',q:'a-nonexistent-model'});
 assert(html.includes('조건에 맞는 제조사 소개가 없습니다'));assert(html.includes('value="hammer"'));
});

test('Lordfield accounts for all 212 official listings with correct brand groups, original links and honest image-only specs', async () => {
 const bundle=require('../content/equipment/lordfield-20261021.json'),f=fixture(),catalog=f.load('src/lib/manufacturer-equipment.ts');
 assert.equal(bundle.listingTotal,212);assert.equal(bundle.products.length,212);assert.equal(bundle.listingCoverage.length,212);
 assert.equal(new Set(bundle.listingCoverage.map(p=>p.id)).size,212);assert.equal(new Set(bundle.listingCoverage.map(p=>p.sourceUrl)).size,212);
 for(const [brand,count] of [['SWAG',104],['LORDFIELD',36],['LANE MASTERS',72]]){
  assert.equal(bundle.products.filter(p=>p.brand===brand).length,count);assert.equal(catalog.searchManufacturerEquipment('','BALL','',brand).length,count);
  const html=await f.render('equipment',{category:'BALL',brand:brand.toLowerCase()});assert(html.includes('조건에 맞는 제품 '+count+'개'));assert(html.includes('aria-label="볼링공 제조사"'));
 }
 for(const item of bundle.listingCoverage){const p=catalog.manufacturerEquipment(item.slug);assert(p);assert.equal(p.sourceUrl,item.sourceUrl);assert.equal(p.brand,item.brand);}
 for(const p of bundle.products){assert.equal(p.category,'BALL');assert.equal(p.releaseDate,null);assert.equal(new URL(p.sourceUrl).hostname,'www.lordfield.com');assert.equal(new URL(p.image.sourceUrl).hostname,'www.lordfield.com');assert(p.image.src.endsWith('.webp'));assert(p.specs.some(([k])=>k==='공식몰 상품번호'));assert(!p.specs.some(([k])=>/RG|DIFF|코어|출시/.test(k)));assert(p.paragraphs.some(t=>t.includes(['lordfield-swag-fusion-pearl-875','lordfield-swag-black-dragon-hybrid-874','lordfield-swag-virtue-873'].includes(p.slug)?'추가 확인':'전수 검수하지')));for(const link of p.additionalSources){assert.equal(new URL(link.url).hostname,'www.lordfield.com');assert(new URL(link.url).pathname.startsWith('/web/'));}}
 const fusion=bundle.products.find(p=>p.specs.some(([k,v])=>k==='공식몰 상품번호'&&v==='875'));assert(fusion.specs.some(([k,v])=>k==='원문에 표시된 무게 옵션'&&v==='13 · 14 · 15 · 16 lb'));
 const black=bundle.products.find(p=>p.specs.some(([k,v])=>k==='공식몰 상품번호'&&v==='819'));assert(!black.specs.some(([k])=>k.includes('무게')));assert(black.paragraphs.some(t=>t.includes('확인하지 못했습니다')));
});

test('Lordfield addition preserves all previous 547 catalogue entries and original check dates', () => {
 const catalog=fixture().load('src/lib/manufacturer-equipment.ts');const old=['manufacturers-20261019','koreamall-20261020','twins-20261021','mk-20261021','brunswick-korea-20261021'].flatMap(name=>require('../content/equipment/'+name+'.json').products);assert.equal(old.length,547);
 for(const product of old){const current=catalog.manufacturerEquipment(product.slug);assert(current);for(const key of ['title','brand','model','summary','specs','paragraphs','checks','image','sourceUrl','releaseDate'])assert.deepEqual(current[key],product[key]);}
});
