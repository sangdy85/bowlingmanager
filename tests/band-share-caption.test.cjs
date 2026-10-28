const test = require('node:test');
const assert = require('node:assert/strict');
const { createShareFixture } = require('./helpers/band-share-fixture.cjs');

test('default share caption includes the selected league match date and homepage notice; image records remain complete', async () => {
    const f = createShareFixture();
    const result = await f.actions.getBandSharePreviewAction(f.input);
    assert.equal(result.success, true);
    assert.equal(result.preview.shareText, '가상 대회\n1주차 · 공식 결과표 4종\n\n📅 2026.01.01 (목)\n\n경기 결과는 아래 홈페이지에서도 확인 가능합니다!\nhttps://bowlingmanager.co.kr/');
    assert.equal(result.preview.belowImageText, '');
    assert.match(result.preview.content, /팀 순위표/);
    assert.match(result.preview.content, /경기 결과/);
    assert.match(result.preview.content, /개인 평균 TOP 2/);
    assert.doesNotMatch(result.preview.shareText, /AVG|핀/);
});

test('each announcement type uses the selected round and the correct short item label', async () => {
    const f = createShareFixture(); f.tournament.type = 'CHAMP';
    for (const [type, label] of [['PARTICIPANTS', '참가자 명단'], ['LANE_ASSIGNMENT', '레인 배정'], ['FINAL_RESULT', '최종 결과']]) {
        const result = await f.actions.getBandSharePreviewAction({ ...f.input, type });
        const { buildBandShareCaption, readBandShareDefaults } = f.load('src/lib/band/share-caption.ts');
        assert.equal(result.preview.shareText, buildBandShareCaption('가상 대회', 1, type, readBandShareDefaults(null), {
            eventDate: f.rounds[0].date, now: new Date(result.preview.generatedAt),
        }).shareText);
        assert.ok(result.preview.content.length > result.preview.shareText.length);
    }
});

test('KST date rollover: results use event date; recruitment, participants and lanes use posting date', () => {
    const f = createShareFixture();
    const { buildBandShareCaption, readBandShareDefaults, BAND_SHARE_SITE_NOTICE } = f.load('src/lib/band/share-caption.ts');
    const defaults = readBandShareDefaults(null);
    const dates = { eventDate: '2026-10-20T15:30:00Z', now: new Date('2026-10-27T15:01:00Z') };
    for (const type of ['FINAL_RESULT', 'LEAGUE_WEEKLY_RESULT']) {
        const value = buildBandShareCaption('대회', 4, type, defaults, dates).shareText;
        assert.match(value, /📅 2026\.10\.21 \(수\)/);
        assert.equal(value.split(BAND_SHARE_SITE_NOTICE).length, 2);
    }
    for (const type of ['RECRUITMENT', 'PARTICIPANTS', 'LANE_ASSIGNMENT']) {
        assert.match(buildBandShareCaption('대회', 4, type, defaults, dates).shareText, /📅 2026\.10\.28 \(수\)/);
        assert.match(buildBandShareCaption('대회', null, type, defaults, { ...dates, now: new Date('2026-10-27T14:59:00Z') }).shareText, /📅 2026\.10\.27 \(화\)/);
    }
});

test('server uses the selected round date and ignores caller-supplied dates; absent round date falls back to tournament date', async () => {
    const f = createShareFixture();
    f.tournament.type = 'EVENT'; f.rounds[2].date = new Date('2026-10-20T15:30:00Z');
    const result = await f.actions.getBandSharePreviewAction({ ...f.input, type: 'FINAL_RESULT', roundId: 'r3', date: '2099-01-01' });
    assert.equal(result.success, true); assert.match(result.preview.shareText, /2026\.10\.21/);
    f.rounds[2].date = null;
    f.tournament.startDate = new Date('2026-10-10T01:00:00Z');
    const fallback = await f.actions.getBandSharePreviewAction({ ...f.input, type: 'FINAL_RESULT', roundId: 'r3' });
    assert.equal(fallback.success, true); assert.match(fallback.preview.shareText, /2026\.10\.10/);
    assert.equal(f.calls.writes, 0); assert.equal(f.calls.external, 0);
});

test('saved top/bottom defaults are freshly read, combined exactly once and never replace image records', async () => {
    const f = createShareFixture();
    f.tournament.settings = JSON.stringify({ gameCount: 3, bandOfficialShare: { aboveImageText: '함께한 선수 여러분 🎳', belowImageText: '다음 주 안내\n시간을 확인해주세요.' } });
    const first = await f.actions.getBandSharePreviewAction(f.input);
    assert.match(first.preview.shareText, /\n\n함께한 선수 여러분 🎳$/);
    const { combineBandShareText } = f.load('src/lib/band/share-caption.ts');
    assert.equal(combineBandShareText(first.preview.shareText, first.preview.belowImageText), first.preview.shareText + '\n\n다음 주 안내\n시간을 확인해주세요.');
    assert.doesNotMatch(first.preview.content, /함께한 선수/);
    f.tournament.settings = '{"gameCount":3}';
    const second = await f.actions.getBandSharePreviewAction(f.input);
    assert.equal(second.preview.belowImageText, '');
    assert.doesNotMatch(second.preview.shareText, /함께한 선수/);
});

function writableFixture() {
    const f = createShareFixture();
    let saved;
    f.db.tournament.updateMany = async query => { saved = query; f.calls.writes++; return { count: 1 }; };
    return { f, saved: () => saved, save: f.load('src/app/actions/band-post-settings-actions.ts').saveBandPostSettingsAction,
        input: { centerId: 'center', tournamentId: 't1', aboveImageText: ' 위 안내 ', belowImageText: ' 아래 안내 ' } };
}

test('settings save checks manager access, preserves all existing settings and guards concurrent edits', async () => {
    const { f, saved, save, input } = writableFixture();
    f.tournament.settings = '{"gameCount":3,"bandAutoPost":true,"roundMaxParticipants":{"1":54}}';
    assert.equal((await save(input)).success, true);
    const query = saved(), value = JSON.parse(query.data.settings);
    assert.equal(query.where.settings, f.tournament.settings);
    assert.equal(query.where.centerId, 'center');
    assert.equal(value.gameCount, 3); assert.equal(value.bandAutoPost, true);
    assert.deepEqual(value.roundMaxParticipants, { 1: 54 });
    assert.deepEqual(value.bandOfficialShare, { aboveImageText: '위 안내', belowImageText: '아래 안내' });
    assert.equal(f.calls.writes, 1); assert.equal(f.calls.external, 0);
    f.db.tournament.updateMany = async () => ({ count: 0 });
    assert.equal((await save(input)).success, false);
});

test('settings cannot be saved by members, other-center managers, unauthenticated users or with invalid text', async () => {
    const { f, save, input } = writableFixture();
    for (const user of ['member', 'other-manager', null]) { f.flags.user = user; assert.equal((await save(input)).success, false); }
    f.flags.user = 'other-manager'; assert.equal((await save({ ...input, centerId: 'other' })).success, false);
    f.flags.user = 'owner';
    assert.equal((await save({ ...input, aboveImageText: 'a'.repeat(2001) })).success, false);
    assert.equal((await save({ ...input, belowImageText: null })).success, false);
    f.tournament.settings = '{broken'; assert.equal((await save(input)).success, false);
    assert.equal(f.calls.writes, 0);
});

test('clearing both defaults uses existing settings JSON without migration or OAuth changes', async () => {
    const { f, save, input, saved } = writableFixture();
    f.tournament.settings = null;
    assert.equal((await save({ ...input, aboveImageText: '', belowImageText: '' })).success, true);
    assert.deepEqual(JSON.parse(saved().data.settings), { bandOfficialShare: { aboveImageText: '', belowImageText: '' } });
});
