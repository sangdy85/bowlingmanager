const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
const moduleUrl = file => pathToFileURL(path.join(root, 'extensions/band-photo-helper', file)).href;
const core = () => import(moduleUrl('transfer.js'));
const png = 'data:image/png;base64,iVBORw0KGgo=';
const source = () => ({ version: 1, sourceUrl: 'https://www.bowlingmanager.co.kr/centers/test?private-query=excluded', text: '테스트 🎳\n문구', images: Array.from({ length: 4 }, (_, i) => ({ name: `결과표_${i}.png`, dataUrl: png })) });

test('extension only bridges official source sites; BAND access remains temporary activeTab with no external callers', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'extensions/band-photo-helper/manifest.json')));
    assert.deepEqual(manifest.permissions.sort(), ['activeTab', 'alarms', 'scripting']);
    for (const key of ['host_permissions', 'optional_host_permissions', 'externally_connectable', 'update_url']) assert.equal(manifest[key], undefined);
    const official = ['https://bowlingmanager.co.kr/*', 'https://www.bowlingmanager.co.kr/*'];
    assert.equal(manifest.version, '0.2.5');
    assert.deepEqual(manifest.content_scripts, [{ matches: official, js: ['bridge.js'], run_at: 'document_idle' }]);
    assert.deepEqual(manifest.web_accessible_resources, [{ resources: ['transfer.js'], matches: official }]);
    assert.equal(manifest.manifest_version, 3);
    const worker = fs.readFileSync(path.join(root, 'extensions/band-photo-helper/worker.js'), 'utf8');
    assert.match(worker, /sender\.id === chrome\.runtime\.id/);
    assert.match(worker, /sender\.url === chrome\.runtime\.getURL\('popup.html'\)/);
    assert.match(worker, /sourceCaptureCommand\(message, sender, chrome\.runtime\.id\)/);
    assert.match(worker, /onStartup\.addListener/);
});

test('source bridge accepts only its own top-level official page and cannot request attach, inspect or a foreign packet', async () => {
    const { sourceCaptureCommand } = await import(moduleUrl('controller.js'));
    const packet = source(), sender = { id: 'our-extension', frameId: 0, tab: { id: 10 }, url: packet.sourceUrl };
    assert.deepEqual(sourceCaptureCommand({ action: 'capture-prepared', packet }, sender, 'our-extension'), { action: 'capture-prepared', packet });
    for (const patch of [{ id: 'foreign-extension' }, { frameId: 1 }, { tab: {} }, { url: 'http://www.bowlingmanager.co.kr/' }, { url: 'https://www.band.us/' }, { url: 'https://www.bowlingmanager.co.kr.evil.test/' }, { url: 'https://www.bowlingmanager.co.kr:8443/' }]) {
        assert.equal(sourceCaptureCommand({ action: 'capture-prepared', packet }, { ...sender, ...patch }, 'our-extension'), null);
    }
    for (const action of ['attach', 'inspect', 'status', 'clear']) assert.equal(sourceCaptureCommand({ action, packet }, sender, 'our-extension'), null);
    assert.deepEqual(sourceCaptureCommand({ action: 'capture-prepared', packet: { ...packet, sourceUrl: 'https://www.bowlingmanager.co.kr/other' } }, sender, 'our-extension')?.packet.sourceUrl, 'https://www.bowlingmanager.co.kr/other');
    assert.equal(sourceCaptureCommand({ action: 'capture-prepared', packet: { ...packet, sourceUrl: 'https://bowlingmanager.co.kr/other' } }, sender, 'our-extension'), null);
    const bridge = fs.readFileSync(path.join(root, 'extensions/band-photo-helper/bridge.js'), 'utf8');
    assert.match(bridge, /!event\.isTrusted/); assert.match(bridge, /readPreparedSource\(\)/);
    assert.doesNotMatch(bridge, /postMessage|document\.cookie|fetch\(|\.click\(/);
});

test('packet retains all edited text and four images, excludes query strings and arbitrary caller fields, expires in 20 minutes', async () => {
    const { validatePacket, EXPIRY_MS } = await core();
    const input = { ...source(), secret: 'NOT_PERSISTED', cookie: 'NOT_PERSISTED' };
    const value = validatePacket(input, 1000);
    assert.deepEqual(value.images, input.images); assert.equal(value.text, input.text);
    assert.equal(value.sourceUrl, 'https://www.bowlingmanager.co.kr/centers/test');
    assert.equal(value.expiresAt, 1000 + EXPIRY_MS); assert.equal(EXPIRY_MS, 1200000);
    assert.ok(value.id); assert.equal(value.secret, undefined); assert.equal(value.cookie, undefined);
    value.images[0].name = '다른이름.png'; assert.equal(input.images[0].name, '결과표_0.png');
});

test('offsite, localhost, insecure and credential-bearing source URLs are rejected', async () => {
    const { validatePacket } = await core();
    for (const sourceUrl of ['http://www.bowlingmanager.co.kr/', 'https://www.bowlingmanager.co.kr.evil.test/', 'https://evil.test/', 'https://user:secret@www.bowlingmanager.co.kr/', 'http://127.0.0.1:3165/', 'https://www.bowlingmanager.co.kr:8443/']) assert.throws(() => validatePacket({ ...source(), sourceUrl }));
});

test('bad images, duplicate names, excess pages and over-budget packets fail without truncation', async () => {
    const { validatePacket, MAX_PACKET_CHARACTERS } = await core();
    for (const images of [[], [{ name: '../x.png', dataUrl: png }], [{ name: 'x.png', dataUrl: 'https://example.test/private.png' }], [{ name: 'x.jpg', dataUrl: png }], [{ name: 'x.png', dataUrl: png }, { name: 'x.png', dataUrl: png }], Array.from({ length: 21 }, (_, i) => ({ name: `${i}.png`, dataUrl: png }))]) assert.throws(() => validatePacket({ ...source(), images }));
    assert.throws(() => validatePacket({ ...source(), images: [{ name: 'large.png', dataUrl: png.slice(0, -1) + 'A'.repeat(MAX_PACKET_CHARACTERS) }] }), /용량/);
});

async function controllerFixture() {
    const { createController } = await import(moduleUrl('controller.js'));
    const transfer = await core(); let packet = null, tab = 10, blocked = false, response = {};
    const calls = { clear: 0, opened: 0, dispatched: 0, captured: 0, inspected: 0 };
    const handle = createController({
        activeTab: async () => ({ id: tab }),
        execute: async (tabId, func, args = []) => {
            assert.equal(tabId, tab);
            if (func === transfer.readPreparedSource) { calls.captured++; return source(); }
            assert.equal(func, transfer.bandComposerAction);
            if (!args.length) { calls.inspected++; return { bandId: '123', bandName: '가상 밴드', composerId: 'editor:photo', hasText: false }; }
            if (blocked) throw Error('대상 글쓰기 화면이 바뀜');
            assert.equal(args[0].expectedBandId, '123'); assert.equal(args[0].expectedComposerId, 'editor:photo');
            assert.deepEqual(args[0].images, source().images); calls.dispatched++;
            return { count: 4, published: false, uploadRequested: true, ...response };
        },
        getPacket: async () => packet, putPacket: async value => { packet = value; }, clearPacket: async () => { packet = null; calls.clear++; },
        createAlarm: async expires => { assert(expires > Date.now()); }, clearAlarm: async () => {}, openBand: async () => { calls.opened++; },
    });
    return { handle, calls, setTab: value => { tab = value; }, setBlocked: value => { blocked = value; }, setResponse: value => { response = value; } };
}

test('capture -> inspect -> one photo dispatch: correct packet, target tab and composer; packet consumed without posting', async () => {
    const f = await controllerFixture(); const captured = await f.handle({ action: 'capture' });
    assert.equal(captured.packet.names.length, 4); assert.equal(f.calls.opened, 1); assert.equal(f.calls.dispatched, 0);
    assert.equal(captured.packet.images, undefined);
    const inspected = await f.handle({ action: 'inspect' });
    const result = await f.handle({ action: 'attach', packetId: inspected.packet.id, tabId: inspected.tabId, bandId: inspected.bandId, composerId: inspected.composerId });
    assert.equal(result.count, 4); assert.equal(result.published, false); assert.equal(f.calls.dispatched, 1);
    assert.equal((await f.handle({ action: 'status' })).packet, null);
    await assert.rejects(() => f.handle({ action: 'attach', packetId: captured.packet.id, tabId: 10, bandId: '123', composerId: 'editor:photo' }), /없거나 만료/);
});

test('website-button capture uses the validated prepared packet and opens normal BAND without activeTab injection', async () => {
    const f = await controllerFixture();
    const response = await f.handle({ action: 'capture-prepared', packet: source() });
    assert.deepEqual(response.packet.names, source().images.map(i => i.name));
    assert.equal(f.calls.captured, 0); assert.equal(f.calls.dispatched, 0); assert.equal(f.calls.opened, 1);
    assert.equal(response.packet.images, undefined);
    await assert.rejects(() => f.handle({ action: 'capture-prepared', packet: { ...source(), sourceUrl: 'https://evil.test/' } }));
    assert.equal(f.calls.opened, 1);
});

test('changed tab or stale packet is rejected before any attachment; rejected composer is not retried or silently replaced', async () => {
    const f = await controllerFixture(); const { packet } = await f.handle({ action: 'capture' });
    for (const patch of [{ packetId: 'stale' }, { tabId: 999 }, { bandId: null }, { composerId: null }]) await assert.rejects(() => f.handle({ action: 'attach', packetId: packet.id, tabId: 10, bandId: '123', composerId: 'editor:photo', ...patch }));
    assert.equal(f.calls.dispatched, 0);
    f.setBlocked(true);
    await assert.rejects(() => f.handle({ action: 'attach', packetId: packet.id, tabId: 10, bandId: '123', composerId: 'editor:photo' }), /바뀜/);
    assert.equal(f.calls.dispatched, 0); assert.ok((await f.handle({ action: 'status' })).packet);
    await f.handle({ action: 'clear' }); assert.equal((await f.handle({ action: 'status' })).packet, null);
});

test('captions retain separate positions, reject inconsistent text and keep legacy packet compatibility', async () => {
    const { validatePacket } = await core();
    const aboveText = '제20회차 상주리그\n12주차 🎳', belowText = '사진 아래 안내';
    const packet = validatePacket({ ...source(), aboveText, belowText, text: aboveText+'\n\n'+belowText });
    assert.equal(packet.aboveText, aboveText); assert.equal(packet.belowText, belowText);
    assert.equal(validatePacket(source()).aboveText, source().text);
    assert.equal(validatePacket(source()).belowText, '');
    assert.throws(() => validatePacket({ ...source(), aboveText, belowText }), /일치/);
    assert.throws(() => validatePacket({ ...source(), aboveText: null }), /일치/);
    const onlyBelow = validatePacket({ ...source(), aboveText: '', belowText: '아래만', text: '아래만' });
    assert.equal(onlyBelow.aboveText, ''); assert.equal(onlyBelow.belowText, '아래만');
});

test('upload started but layout unverified consumes packet once and cannot silently reupload or claim publication', async () => {
    const f = await controllerFixture();
    f.setResponse({ layoutVerified: false, message: '사진 첨부 완료를 확인하지 못했습니다.' });
    await f.handle({ action: 'capture' }); const target = await f.handle({ action: 'inspect' });
    const request = { action: 'attach', packetId: target.packet.id, tabId: target.tabId, bandId: target.bandId, composerId: target.composerId };
    const response = await f.handle(request);
    assert.equal(response.layoutVerified, false); assert.equal(response.published, false);
    assert.match(response.message, /확인하지 못했습니다/);
    assert.equal((await f.handle({ action: 'status' })).packet, null);
    await assert.rejects(() => f.handle(request), /없거나 만료/);
    assert.equal(f.calls.dispatched, 1);
});

test('layout verification is reported independently from publishing and does not add a success history', async () => {
    const f = await controllerFixture(); f.setResponse({ layoutVerified: true, photoPlacement: 'between-captions' });
    await f.handle({ action: 'capture' }); const target = await f.handle({ action: 'inspect' });
    const response = await f.handle({ action: 'attach', packetId: target.packet.id, tabId: target.tabId, bandId: target.bandId, composerId: target.composerId });
    assert.equal(response.layoutVerified, true); assert.equal(response.published, false);
    assert.equal(response.photoPlacement, 'between-captions'); assert.equal(response.count, 4);
    assert.equal((await f.handle({ action: 'status' })).packet, null);
});

test('adapter limits automation to observed photo Attach step and verifies widgets before caption insertion', async () => {
    const { bandComposerAction, readPreparedSource } = await core(); const text = bandComposerAction.toString();
    assert.doesNotMatch(text, /fetch\(|XMLHttpRequest|\.submit\(|document\.cookie|localStorage|sessionStorage|CKEDITOR|openapi|_btnSubmitPost/);
    assert.equal((text.match(/\.click\(/g)||[]).length, 1);
    assert.match(text, /attachButton\.click\(\)/);
    for (const exact of ['사진 올리기', '첨부하기', 'button._submitBtn', '.mediaContentItem > img._thumbImg', ':scope > .cke_widget_wrapper[type="photo"]', 'img._thumbnail']) assert.ok(text.includes(exact));
    assert.match(text, /Date\.now\(\) \+ 30000/); assert.match(text, /layoutVerified: false/); assert.match(text, /layoutVerified: true/);
    assert.ok(text.indexOf("new Event('change'") < text.indexOf('insertCaption(aboveText'));
    assert.ok(text.indexOf('const finalPhotos = photos()') > text.indexOf('insertCaption(belowText'));
    assert.match(text, /published: false/); assert.doesNotMatch(readPreparedSource.toString(), /approval|checkbox/);
    assert.doesNotMatch(text, /innerHTML\s*=/);
});

test('photo adapter moves and settles the caret before upload and leaves it at the end, never Home', async () => {
    const { bandComposerAction } = await core(); const text = bandComposerAction.toString();
    assert.match(text, /end\.selectNodeContents\(editor\); end\.collapse\(false\)/);
    assert.match(text, /compareBoundaryPoints\(2, end\) === 0/);
    assert.match(text, /new MouseEvent\('mouseup'/);
    assert.match(text, /key: 'End', code: 'End', ctrlKey: true/);
    assert.doesNotMatch(text, /key: 'Home'/);
    assert.ok(text.indexOf('placeCaretAtEnd();') < text.indexOf("new Event('change'"));
    assert.ok(text.lastIndexOf('placeCaretAtEnd();') > text.indexOf('insertCaption(belowText'));
    assert.match(text, /caretAtEnd: true/);
});
