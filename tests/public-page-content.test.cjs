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

const manufacturerBundle = require('../content/equipment/manufacturers-20261019.json');
test('manufacturer catalogue preserves review separation and actual category/search filtering', async () => {
    const f = fixture(), products = f.load('src/lib/manufacturer-equipment.ts');
    assert.equal(products.searchManufacturerEquipment().length, 18);
    assert.equal(products.searchManufacturerEquipment('', 'BALL', 'INTRO').length, 11);
    for (const [category, count] of [['SHOES', 2], ['BAG', 2], ['ACCESSORY', 3]]) assert.equal(products.searchManufacturerEquipment('', category).length, count);
    assert.equal(products.searchManufacturerEquipment('RECKONING').length, 1);
    assert.equal(products.searchManufacturerEquipment('', '', 'REVIEW').length, 0);
    const html = await f.render('equipment');
    assert(html.includes('제조사 자료로 살펴보는 볼링 용품'));
    assert(html.includes('회원 소개·후기'));
    for (const product of manufacturerBundle.products) assert(html.includes('/equipment/products/' + product.slug));
    const review = await fixture().render('equipment', {type: 'REVIEW'});
    assert(!review.includes('id="manufacturer-equipment"'));
    assert(review.includes('href="/equipment/new"'));
});
test('manufacturer product routes render real copy, official links and canonical metadata without member impersonation', async () => {
    const route = fixture().load('src/app/equipment/products/[slug]/page.tsx');
    assert.equal(route.generateStaticParams().length, 18);
    for (const product of manufacturerBundle.products) {
        const params = Promise.resolve({slug: product.slug});
        const html = renderToStaticMarkup(await route.default({params}));
        assert(html.includes(product.title));
        assert(html.includes('제조사 공식 제품 페이지'));
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
test('every authored product cites a manufacturer and clearly scopes ball numbers by weight', () => {
    assert.equal(new Set(manufacturerBundle.products.map(p => p.slug)).size, 18);
    for (const product of manufacturerBundle.products) {
        const url = new URL(product.sourceUrl);
        assert.equal(url.protocol, 'https:');
        assert(['www.stormbowling.com', 'hammerbowling.com', 'brunswickbowling.com', 'www.dexterbowling.com', 'www.motivbowling.com', 'ebonite.com'].includes(url.hostname));
        assert.equal(url.username, ''); assert.equal(url.password, '');
        if (product.category === 'BALL') assert(product.specs.some(([label]) => /(?:15|16) lb RG/.test(label)));
    }
});

test('catalogue photos are distinct, decodable local assets with manufacturer attribution on cards and details', async () => {
    const sharp = require('sharp'), crypto = require('node:crypto'), hashes = new Set();
    const catalogue = await fixture().render('equipment');
    const route = fixture().load('src/app/equipment/products/[slug]/page.tsx');
    for (const product of manufacturerBundle.products) {
        const photo = product.image;
        assert(photo.src.startsWith('/images/equipment/'));
        const bytes = fs.readFileSync(path.join(__dirname, '../public', photo.src));
        const meta = await sharp(bytes).metadata();
        assert.equal(meta.width, photo.width); assert.equal(meta.height, photo.height);
        assert(meta.width >= 300 && meta.height >= 300);
        hashes.add(crypto.createHash('sha256').update(bytes).digest('hex'));
        assert.equal(new URL(photo.sourceUrl).protocol, 'https:');
        assert.equal(photo.credit, product.brand);
        assert.equal(photo.checkedAt, manufacturerBundle.checkedAt);
        for (const html of [catalogue, renderToStaticMarkup(await route.default({params: Promise.resolve({slug: product.slug})}))]) {
            assert(html.includes(encodeURIComponent(photo.src)), 'optimized photo: ' + product.slug);
            assert(html.includes(photo.alt.replaceAll('&', '&amp;')));
            assert(html.includes('사진:'));
        }
    }
    assert.equal(hashes.size, 18, 'different products must not reuse the same photo');
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
    for (const product of manufacturerBundle.products) assert(entries.some(e => e.url.endsWith('/equipment/products/' + product.slug)));
    assert(entries.some(e => e.url.endsWith('/competitions/preserved-notice')));
});
