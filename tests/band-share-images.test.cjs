const test = require('node:test');
const assert = require('node:assert/strict');
const { File } = require('node:buffer');
const { createShareFixture } = require('./helpers/band-share-fixture.cjs');
const load = () => createShareFixture().load('src/lib/band/share-images.ts');

test('image wrapping retains all Korean/emoji, blank lines and long unbroken links', () => {
    const { wrapAnnouncementLines } = load();
    const text = '🎳 결과\n\nhttps://bowlingmanager.co.kr/' + 'a'.repeat(60);
    const lines = wrapAnnouncementLines(text, value => Array.from(value).length * 10, 80);
    assert.equal(lines.join(''), text.replaceAll('\n', ''));
    assert.equal(lines[1], '');
    assert.ok(lines.every(line => Array.from(line).length <= 8));
    assert.equal(lines.filter(line => line.includes('🎳')).length, 1);
});

test('long announcements paginate PNGs without dropping the last result or exceeding canvas height', async () => {
    const { createAnnouncementImages } = load();
    const old = global.document;
    const drawn = [], heights = [];
    const ctx = { measureText: value => ({ width: value.length * 10 }), fillRect() {}, fillText: text => drawn.push(text) };
    const canvas = { width: 0, height: 0, getContext: () => ctx, toDataURL: () => { heights.push(canvas.height); return 'data:image/png;base64,iVBORw=='; } };
    global.document = { createElement: name => { assert.equal(name, 'canvas'); return canvas; }, fonts: { ready: Promise.resolve() } };
    try {
        const text = Array.from({ length: 90 }, (_, i) => `${i + 1}위 선수-${i} 600점`).join('\n');
        const images = await createAnnouncementImages(text);
        assert.equal(images.length, 3);
        assert.ok(drawn.includes('90위 선수-89 600점'));
        assert.equal(drawn.filter(line => /위 선수-/.test(line)).length, 90);
        assert.ok(heights.every(height => height <= 1800));
        assert.equal(new Set(images.map(image => image.name)).size, 3);
    } finally { global.document = old; }
});

test('image files preserve PNG bytes and names and reject arbitrary external URLs', () => {
    const old = global.File; global.File = File;
    try {
        const { bandShareImageFiles } = load();
        const files = bandShareImageFiles([{ name: '1주차_팀순위.png', dataUrl: 'data:image/png;base64,iVBORw0KGgo=' }]);
        assert.equal(files[0].name, '1주차_팀순위.png'); assert.equal(files[0].type, 'image/png'); assert.equal(files[0].size, 8);
        assert.throws(() => bandShareImageFiles([{ name: 'bad', dataUrl: 'https://example.com/private.png' }]));
    } finally { global.File = old; }
});

test('native sharing requires actual file support and checks the exact files plus edited text', () => {
    const { canShareBandImages } = load();
    const files = [{ name: 'result.png' }], text = '수정 문구 & 🎳';
    assert.equal(canShareBandImages(files, text, {}), false);
    assert.equal(canShareBandImages([], text, { share() {}, canShare: () => true }), false);
    assert.equal(canShareBandImages(files, text, { share() {}, canShare: () => false }), false);
    assert.equal(canShareBandImages(files, text, { share() {}, canShare: () => { throw Error('policy'); } }), false);
    assert.equal(canShareBandImages(files, text, { share() {}, canShare: data => { assert.equal(data.files, files); assert.equal(data.text, text); return true; } }), true);
});
