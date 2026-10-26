const test = require('node:test');
const assert = require('node:assert/strict');
const { createShareFixture } = require('./helpers/band-share-fixture.cjs');

test('official preview works without any BAND credentials, signing secret, connection, API or history access', async () => {
    const names = ['BAND_CLIENT_ID', 'BAND_CLIENT_SECRET', 'BAND_REDIRECT_URI', 'BAND_TOKEN_ENCRYPTION_KEY', 'AUTH_SECRET'];
    const saved = names.map(name => [name, process.env[name]]);
    try {
        names.forEach(name => delete process.env[name]);
        const f = createShareFixture();
        const result = await f.actions.getBandSharePreviewAction(f.input);
        assert.equal(result.success, true);
        for (const section of ['🏆 팀 순위표', '👥 개인 순위표', '📝 1주차 경기 결과', '🔥 개인 평균 TOP 2', '?week=1']) assert.ok(result.preview.content.includes(section), section);
        assert.equal(result.preview.roundId, 'r1');
        assert.equal(f.calls.writes, 0); assert.equal(f.calls.external, 0);
    } finally { saved.forEach(([name, value]) => value === undefined ? delete process.env[name] : process.env[name] = value); }
});

test('selected week uses server round mapping, cumulative standings and fresh selected matches', async () => {
    const f = createShareFixture();
    const one = await f.actions.getBandSharePreviewAction(f.input);
    const three = await f.actions.getBandSharePreviewAction({ ...f.input, roundId: 'r3', week: 3, content: 'FORGED', revision: 999, scores: [9999] });
    assert.equal(three.success, true); assert.match(three.preview.content, /3주차 경기 결과/);
    assert.notEqual(one.preview.content, three.preview.content); assert.ok(!three.preview.content.includes('FORGED'));
    f.rounds[0].matchups[0].individualScores[0].score1 = 289;
    const fresh = await f.actions.getBandSharePreviewAction(f.input);
    assert.match(fresh.preview.content, /289\/191\/201/);
    assert.equal(f.calls.writes, 0);
});

test('wrong week, foreign/missing round, wrong center, bad type and malformed IDs are denied', async () => {
    const f = createShareFixture();
    for (const patch of [{ week: 3 }, { week: undefined }, { week: 1.5 }, { roundId: 'foreign' }, { centerId: 'other' }, { tournamentId: 'unknown' }, { type: 'TEST' }, { tournamentId: '' }]) {
        assert.equal((await f.actions.getBandSharePreviewAction({ ...f.input, ...patch })).success, false, JSON.stringify(patch));
    }
    for (const input of [null, {}, { ...f.input, centerId: 4 }]) assert.equal((await f.actions.getBandSharePreviewAction(input)).success, false);
});

test('OWNER outside managers and MANAGER are allowed; member, other center admin and unauthenticated are denied before target read', async () => {
    const f = createShareFixture();
    for (const user of ['owner', 'manager']) { f.flags.user = user; assert.equal((await f.actions.getBandSharePreviewAction(f.input)).success, true); }
    const before = f.calls.target;
    for (const user of ['member', 'other-manager', null]) { f.flags.user = user; assert.equal((await f.actions.getBandSharePreviewAction(f.input)).success, false); }
    assert.equal(f.calls.target, before);
});

test('unfinished and matchless league weeks are blocked without any writes', async () => {
    const f = createShareFixture();
    for (const n of [2, 4]) assert.equal((await f.actions.getBandSharePreviewAction({ ...f.input, roundId: `r${n}`, week: n })).success, false);
    assert.equal(f.calls.writes, 0); assert.equal(f.calls.external, 0);
});

test('an authenticated admin of another owned center cannot substitute a foreign tournament or round', async () => {
    const f = createShareFixture(); f.flags.user = 'other-manager';
    assert.equal((await f.actions.getBandSharePreviewAction({ ...f.input, centerId: 'other' })).success, false);
    f.flags.user = 'owner';
    assert.equal((await f.actions.getBandSharePreviewAction({ ...f.input, centerId: 'missing' })).success, false);
    assert.equal(f.calls.writes, 0); assert.equal(f.calls.external, 0);
});

test('participant announcement exposes only public display fields, never account contacts or private attachments', async () => {
    const f = createShareFixture(); f.tournament.type = 'CHAMP';
    f.rounds[0].participants[0].registration.user = { name: '회원', email: 'PRIVATE_EMAIL', phone: 'PRIVATE_PHONE' };
    f.tournament.attachments = [{ url: 'PRIVATE_FILE' }];
    const result = await f.actions.getBandSharePreviewAction({ ...f.input, type: 'PARTICIPANTS' });
    assert.equal(result.success, true);
    for (const value of ['PRIVATE_EMAIL', 'PRIVATE_PHONE', 'PRIVATE_FILE']) assert.ok(!result.preview.content.includes(value));
});

for (const type of ['CHAMP', 'EVENT']) test(`${type}: participants, lanes and all final ranks reuse the real builders and score action`, async () => {
    const f = createShareFixture(); f.tournament.type = type;
    const input = { ...f.input, week: undefined };
    const participants = await f.actions.getBandSharePreviewAction({ ...input, type: 'PARTICIPANTS' });
    assert.equal(participants.success, true); assert.match(participants.preview.content, /참가 4명/);
    const lanes = await f.actions.getBandSharePreviewAction({ ...input, type: 'LANE_ASSIGNMENT' });
    assert.equal(lanes.success, true); assert.match(lanes.preview.content, /선수0 · 테스트팀 · 1-1/);
    const results = await f.actions.getBandSharePreviewAction({ ...input, type: 'FINAL_RESULT' });
    assert.equal(results.success, true); assert.match(results.preview.content, /4위 선수3/); assert.match(results.preview.content, /543점/);
    f.rounds[0].individualScores.pop();
    assert.equal((await f.actions.getBandSharePreviewAction({ ...input, type: 'FINAL_RESULT' })).success, false);
    f.rounds[0].participants[0].lane = null;
    assert.equal((await f.actions.getBandSharePreviewAction({ ...input, type: 'LANE_ASSIGNMENT' })).success, false);
    assert.equal(f.calls.writes, 0); assert.equal(f.calls.external, 0);
});

test('edited text round-trips in UTF-8, with a fixed route and exact official endpoints', () => {
    const { load } = createShareFixture();
    const share = load('src/lib/band/official-share.ts');
    const text = '🎳 수정 공지\n홍길동 & 1위? #점수 + 100%\nhttps://www.bowlingmanager.co.kr/a?x=1&y=2';
    const links = share.buildBandShareLinks(text);
    const web = new URL(links.webUrl), app = new URL(links.appUrl);
    assert.equal(web.origin + web.pathname, 'https://band.us/plugin/share');
    assert.equal(app.protocol + '//' + app.host + app.pathname, 'bandapp://create/post');
    assert.equal(web.searchParams.get('body'), text); assert.equal(app.searchParams.get('text'), text);
    assert.equal(web.searchParams.get('route'), 'bowlingmanager.co.kr');
    assert.equal(links.contentBytes, Buffer.byteLength(text, 'utf8'));
});

test('oversized body is never truncated: copy full text then use an empty official composer', () => {
    const { load } = createShareFixture(); const { buildBandShareLinks } = load('src/lib/band/official-share.ts');
    const links = buildBandShareLinks('한글🎳'.repeat(5000));
    assert.equal(links.tooLong, true); assert.equal(new URL(links.webUrl).searchParams.get('body'), '');
    assert.equal(new URL(links.appUrl).searchParams.get('text'), '');
    assert.ok(links.webUrl.length < 200);
});

test('PC popup launch is synchronous, isolates opener and detects blocking; no posting callback exists', () => {
    const { load } = createShareFixture(); const { openBandSharePopup } = load('src/lib/band/official-share.ts');
    let destination; const popup = { opener: 'previous', location: { replace: url => destination = url } };
    assert.equal(openBandSharePopup('수정 문구', (url, target) => { assert.equal(url, 'about:blank'); assert.equal(target, '_blank'); return popup; }), true);
    assert.equal(popup.opener, null); assert.equal(new URL(destination).searchParams.get('body'), '수정 문구');
    assert.equal(openBandSharePopup('내용', () => null), false);
});
