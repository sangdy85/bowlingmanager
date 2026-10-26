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
    assert.equal(manifest.version, '0.2.1');
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
    assert.equal(sourceCaptureCommand({ action: 'capture-prepared', packet: { ...packet, sourceUrl: 'https://www.bowlingmanager.co.kr/other' } }, sender, 'our-extension'), null);
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
    const transfer = await core(); let packet = null, tab = 10, blocked = false;
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
            return { count: 4, published: false, uploadRequested: true };
        },
        getPacket: async () => packet, putPacket: async value => { packet = value; }, clearPacket: async () => { packet = null; calls.clear++; },
        createAlarm: async expires => { assert(expires > Date.now()); }, clearAlarm: async () => {}, openBand: async () => { calls.opened++; },
    });
    return { handle, calls, setTab: value => { tab = value; }, setBlocked: value => { blocked = value; } };
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

test('BAND adapter has no login/session, direct API/network or publish-button automation', async () => {
    const { bandComposerAction, readPreparedSource } = await core(); const text = bandComposerAction.toString();
    assert.doesNotMatch(text, /fetch\(|XMLHttpRequest|\.click\(|\.submit\(|document\.cookie|localStorage|sessionStorage|CKEDITOR|openapi/);
    assert.match(text, /new Event\('change'/); assert.match(text, /published: false/);
    assert.match(text, /expectedComposerId/); assert.match(text, /postPhotoInput_/);
    assert.match(readPreparedSource.toString(), /approval\?\.checked/);
});

async function orderingFixture(options = {}) {
    const { bandComposerAction } = await core();
    const state = { text: options.existingText || '', cachedAtEnd: false, order: null, changes: 0, events: [] };
    const location = { protocol: 'https:', hostname: 'www.band.us', port: '', pathname: '/band/123/post' };
    class FileInput {
        constructor() { this.id = 'postPhotoInput_test'; this.multiple = true; this.isConnected = true; this._files = []; }
        get files() { return this._files; }
        set files(value) { this._files = value; }
        dispatchEvent(event) {
            assert.equal(event.type, 'change'); state.changes++;
            state.order = state.cachedAtEnd ? 'caption -> photos' : 'photos -> caption';
            state.events.push('file-change');
        }
    }
    const input = new FileInput();
    const selection = { isCollapsed: true, anchorNode: null, anchorOffset: 0, range: null,
        removeAllRanges() { this.range = null; },
        addRange(range) { this.range = range; this.isCollapsed = Boolean(range.collapsed); this.anchorNode = editor; },
    };
    const editor = { getClientRects: () => [1], focus() {},
        cloneNode() {
            const clone = { textContent: state.text || '\u200b새로운 소식을 남겨보세요.', querySelectorAll: () => state.text ? [] : [{ remove() { clone.textContent = '\u200b'; } }] };
            return clone;
        },
        dispatchEvent(event) { state.events.push(event.type); state.cachedAtEnd = Boolean(selection.range?.atEnd); },
        contains: node => node === editor,
    };
    selection.anchorNode = editor;
    const dialog = { isConnected: true, dataset: {}, getClientRects: () => [1],
        getAttribute: () => 'editor-test', contains: node => node === editor || node === input,
        querySelectorAll: selector => selector.includes('input[') ? [input] : [editor], querySelector: () => null,
    };
    const document = {
        querySelectorAll: selector => selector.includes('[role=') ? [dialog] : [{ href: 'https://www.band.us/band/123/post', textContent: '가상 밴드' }],
        getElementById: () => ({ textContent: '글쓰기' }),
        createRange: () => ({ collapsed: false, atEnd: false, selectNodeContents() {}, setStart() {}, toString: () => state.caretMoved ? state.text : '', collapse(toStart) { this.collapsed = true; this.atEnd = !toStart; } }),
        execCommand(command, _show, text) {
            if (command === 'insertText') {
                if (options.failCaption) return false;
                state.text = text; selection.isCollapsed = true; return true;
            }
            assert.equal(command, 'insertParagraph'); assert.equal(selection.range?.atEnd, true);
            state.text += '\n'; selection.isCollapsed = true; return true;
        },
    };
    class DomEvent { constructor(type) { this.type = type; } }
    class DataTransfer { constructor() { this.files = []; this.items = { add: file => this.files.push(file) }; } }
    const action = vm.runInNewContext('(' + bandComposerAction.toString() + ')', {
        location, document, window: { getSelection: () => selection }, HTMLInputElement: FileInput,
        DataTransfer, File: class { constructor(_data, name) { this.name = name; } },
        Event: DomEvent, KeyboardEvent: DomEvent, MouseEvent: DomEvent, URL, Date, Uint8Array, atob,
        setTimeout(callback, delay) { assert.equal(delay, 150); return setTimeout(() => { if (options.changeBand) location.pathname = '/band/456/post'; if (options.changeCaret) state.caretMoved = true; callback(); }, 0); },
    });
    const packet = { ...source(), id: 'prepared', expiresAt: Date.now() + 60000, expectedBandId: '123', expectedComposerId: 'editor-test:postPhotoInput_test' };
    return { state, attach: () => action(packet) };
}

test('photo insertion follows the caption even when the editor previously remembered its beginning', async () => {
    for (const existingText of ['', '관리자가 먼저 작성한 문구', '새로운 소식을 남겨보세요.']) {
        const f = await orderingFixture({ existingText }); const result = await f.attach();
        assert.equal(f.state.order, 'caption -> photos'); assert.equal(f.state.changes, 1);
        assert.equal(f.state.text.trim(), existingText || source().text);
        assert.equal(result.photoPlacement, 'after-caption'); assert.equal(result.published, false);
        assert.ok(f.state.events.indexOf('keyup') < f.state.events.indexOf('file-change'));
    }
});

test('failed caption insertion stops before attaching any photos', async () => {
    const f = await orderingFixture({ failCaption: true });
    await assert.rejects(f.attach, /공지 문구를 넣지 못해/);
    assert.equal(f.state.changes, 0);
});

test('switching the BAND during selection settlement stops before file delivery', async () => {
    const f = await orderingFixture({ changeBand: true });
    await assert.rejects(f.attach, /글쓰기 화면이나 입력 위치가 바뀌었/);
    assert.equal(f.state.changes, 0);
});

test('moving the caret back before text during settlement stops before file delivery', async () => {
    const f = await orderingFixture({ changeCaret: true });
    await assert.rejects(f.attach, /커서가 문구 앞으로 이동/);
    assert.equal(f.state.changes, 0);
});
