const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');
const folder = path.resolve(__dirname, '../extensions/band-photo-helper');
const png = 'data:image/png;base64,iVBORw0KGgo=';
const packet = (sourceUrl = 'https://bowlingmanager.co.kr/centers/test/rounds/four') => ({
    version: 1, sourceUrl, text: '챔프전 4회차\n최종 결과',
    images: [{ name: '챔프전 4회차 결과_1.png', dataUrl: png }],
});
const sender = (url = 'https://bowlingmanager.co.kr/') => ({ id: 'helper', frameId: 0, tab: { id: 7 }, url, origin: new URL(url).origin });

async function workerFixture() {
    const { createController, sourceCaptureCommand } = await import(pathToFileURL(path.join(folder, 'controller.js')));
    let pending = null, receive, opened = 0;
    const context = {
        createController, sourceCaptureCommand,
        getPacket: async () => pending, putPacket: async value => { pending = structuredClone(value); }, clearPacket: async () => { pending = null; },
        chrome: {
            runtime: { id: 'helper', getURL: file => 'chrome-extension://helper/' + file,
                onMessage: { addListener: fn => { receive = fn; } }, onStartup: { addListener() {} }, onInstalled: { addListener() {} } },
            tabs: { create: async ({ url }) => { assert.equal(url, 'https://www.band.us/'); opened++; } },
            alarms: { create: async () => {}, clear: async () => {}, onAlarm: { addListener() {} } },
        },
    };
    const script = fs.readFileSync(path.join(folder, 'worker.js'), 'utf8').replace(/^import .*\r?\n/gm, '');
    vm.runInNewContext(script, context);
    return {
        // Chrome messages use JSON serialization; include that boundary too.
        send: (message, from) => new Promise((resolve, reject) => {
            const waiting = receive(JSON.parse(JSON.stringify(message)), from, resolve);
            if (waiting !== true) reject(Error('No worker response'));
        }),
        get pending() { return pending; }, get opened() { return opened; },
    };
}

test('source-button capture still works after an in-site route/query/hash change without reloading the document', async () => {
    const f = await workerFixture();
    for (const host of ['bowlingmanager.co.kr', 'www.bowlingmanager.co.kr']) {
        const current = `https://${host}/centers/test/rounds/four?tab=results#band`;
        const response = await f.send({ action: 'capture-prepared', packet: packet(current) }, sender(`https://${host}/centers`));
        assert.equal(response.ok, true);
        assert.equal(response.result.packet.names.length, 1);
        assert.equal(f.pending.sourceUrl, `https://${host}/centers/test/rounds/four`);
    }
    assert.equal(f.opened, 2);
});

test('official top-level sender validation rejects foreign hosts, origins and frames with no BAND window', async () => {
    const f = await workerFixture();
    const invalid = [
        { ...sender(), frameId: 1 }, { ...sender(), origin: 'https://evil.test' },
        { ...sender(), url: 'https://evil.test/' }, { ...sender(), tab: {} },
    ];
    for (const from of invalid) {
        const response = await f.send({ action: 'capture-prepared', packet: packet() }, from);
        assert.equal(response.ok, false); assert.match(response.message, /새로고침|공식/);
    }
    for (const url of ['https://www.bowlingmanager.co.kr/other', 'https://evil.test/', 'http://bowlingmanager.co.kr/', 'https://user:secret@bowlingmanager.co.kr/', 'https://bowlingmanager.co.kr:8443/']) {
        const response = await f.send({ action: 'capture-prepared', packet: packet(url) }, sender());
        assert.equal(response.ok, false);
    }
    assert.equal(f.opened, 0); assert.equal(f.pending, null);
    for (const action of ['attach', 'inspect', 'status', 'clear']) {
        await assert.rejects(f.send({ action, packet: packet() }, sender()), /No worker response/);
    }
    await assert.rejects(f.send({ action: 'capture-prepared', packet: packet() }, { ...sender(), id: 'another-extension' }), /No worker response/);
});

test('a large final-table PNG survives the worker message and storage boundary byte for byte', async () => {
    const f = await workerFixture();
    const input = packet();
    input.images[0].dataUrl = png.slice(0, -1) + 'A'.repeat(2 * 1024 * 1024) + '=';
    const response = await f.send({ action: 'capture-prepared', packet: input }, sender());
    assert.equal(response.ok, true); assert.equal(f.opened, 1);
    assert.deepEqual(f.pending.images, input.images);
    assert.equal(response.result.packet.images, undefined);
    assert.equal(response.result.published, undefined);
});

test('missing worker responses and stale extension contexts tell the administrator how to recover', async () => {
    for (const stale of [false, true]) {
        let click;
        const emitted = [];
        class Element { closest() { return this; } getAttribute() { return 'photo-request'; } }
        const window = { dispatchEvent: event => emitted.push(event) }; window.top = window;
        const code = fs.readFileSync(path.join(folder, 'bridge.js'), 'utf8')
            .replace("await import(chrome.runtime.getURL('transfer.js'))", 'await Promise.resolve({ readPreparedSource: mockRead })');
        await vm.runInNewContext(code, {
            window, Element, location: new URL('https://bowlingmanager.co.kr/centers/test'),
            document: { addEventListener: (type, listener) => { assert.equal(type, 'click'); click = listener; }, documentElement: { dataset: {} } },
            Event: class { constructor(type) { this.type = type; } },
            CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
            queueMicrotask, mockRead: packet,
            chrome: { runtime: { getManifest: () => ({ version: '0.2.5' }), sendMessage: async () => {
                if (stale) throw Error('Extension context invalidated.');
                return undefined;
            } } },
        });
        await new Promise(setImmediate);
        await click({ isTrusted: false, target: new Element() });
        assert.equal(emitted.filter(e => e.detail).length, 0);
        await click({ isTrusted: true, target: new Element() });
        const result = emitted.find(e => e.detail)?.detail;
        assert.equal(result.ok, false); assert.equal(result.requestId, 'photo-request');
        assert.match(result.message, /새로고침/);
        assert.match(result.message, stale ? /업데이트/ : /응답이 없습니다/);
    }
});
