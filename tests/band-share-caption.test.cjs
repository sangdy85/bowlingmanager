const test = require('node:test');
const assert = require('node:assert/strict');
const { createShareFixture } = require('./helpers/band-share-fixture.cjs');

test('default share caption contains only name/week/item; original report remains complete for images', async () => {
    const f = createShareFixture();
    const result = await f.actions.getBandSharePreviewAction(f.input);
    assert.equal(result.success, true);
    assert.equal(result.preview.shareText, '가상 대회\n1주차 · 공식 결과표 4종');
    assert.equal(result.preview.belowImageText, '');
    assert.match(result.preview.content, /팀 순위표/);
    assert.match(result.preview.content, /경기 결과/);
    assert.match(result.preview.content, /개인 평균 TOP 2/);
    assert.doesNotMatch(result.preview.shareText, /AVG|핀|https:/);
});

test('each announcement type uses the selected round and the correct short item label', async () => {
    const f = createShareFixture(); f.tournament.type = 'CHAMP';
    for (const [type, label] of [['PARTICIPANTS', '참가자 명단'], ['LANE_ASSIGNMENT', '레인 배정'], ['FINAL_RESULT', '최종 결과']]) {
        const result = await f.actions.getBandSharePreviewAction({ ...f.input, type });
        assert.equal(result.preview.shareText, `가상 대회\n1회차 · ${label}`);
        assert.ok(result.preview.content.length > result.preview.shareText.length);
    }
});

test('saved top/bottom defaults are freshly read, combined exactly once and never replace image records', async () => {
    const f = createShareFixture();
    f.tournament.settings = JSON.stringify({ gameCount: 3, bandOfficialShare: { aboveImageText: '함께한 선수 여러분 🎳', belowImageText: '다음 주 안내\n시간을 확인해주세요.' } });
    const first = await f.actions.getBandSharePreviewAction(f.input);
    assert.match(first.preview.shareText, /공식 결과표 4종\n\n함께한 선수 여러분 🎳$/);
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
