const test = require('node:test');
const assert = require('node:assert/strict');
const { createShareFixture } = require('./helpers/band-share-fixture.cjs');

for (const type of ['CHAMP', 'EVENT']) test(`${type}: structured participant/lane/result tables use the selected round and public fields`, async () => {
    const f = createShareFixture(); f.tournament.type = type;
    f.rounds[2].participants[0].registration = { ...f.rounds[2].participants[0].registration,
        guestName: '선택 회차 선수', user: { name: '회원', email: 'PRIVATE_EMAIL' }, phone: 'PRIVATE_PHONE' };
    for (const kind of ['PARTICIPANTS', 'LANE_ASSIGNMENT', 'FINAL_RESULT']) {
        const result = await f.actions.getBandSharePreviewAction({ ...f.input, roundId: 'r3', type: kind });
        assert.equal(result.success, true);
        const table = result.preview.table;
        assert.equal(table.kind, kind); assert.match(table.title, /3회차/);
        assert.equal(table.rows.length, 4);
        assert.ok(table.rows.some(r => r.cells.includes('선택 회차 선수')));
        assert.doesNotMatch(JSON.stringify(table), /PRIVATE_EMAIL|PRIVATE_PHONE|registrationId|userId/);
        assert.ok(table.rows.every(r => r.cells.length === table.columns.length));
    }
    assert.equal(f.calls.writes, 0); assert.equal(f.calls.external, 0);
});

test('result table reuses official result calculation including capped games, positive handicap and female highlights', async () => {
    const f = createShareFixture(); f.tournament.type = 'CHAMP';
    const r = f.rounds[0]; r.participants[0].handicap = 12; r.participants[0].isFemaleChamp = true;
    r.individualScores.filter(s => s.registrationId === 'reg0').forEach((s, i) => { s.score = [202, 222, 275][i]; });
    const result = await f.actions.getBandSharePreviewAction({ ...f.input, type: 'FINAL_RESULT' });
    assert.equal(result.success, true);
    const table = result.preview.table;
    assert.deepEqual(table.columns.map(c => c.label), ['순위', '팀', '성함', '1G', '2G', '3G', '핸디', '총점']);
    assert.deepEqual(table.rows[0].cells, ['1', '테스트팀', '선수0 (여챔)', '214', '234', '287', '36', '735']);
    assert.equal(table.rows[0].highlight, true);
    assert.equal(table.rows[3].highlight, false);
    assert.equal(table.twoColumns, true);
});

test('previous-round penalties match the displayed official result, even when text totals alone are insufficient', async () => {
    const f = createShareFixture(); f.tournament.type = 'CHAMP';
    f.tournament.settings = JSON.stringify({ gameCount: 3, minusHandicapRank1: 20 });
    const result = await f.actions.getBandSharePreviewAction({ ...f.input, roundId: 'r2', type: 'FINAL_RESULT' });
    assert.equal(result.success, true);
    const row = result.preview.table.rows.find(row => row.cells[2] === '선수0');
    assert.deepEqual(row.cells.slice(3), ['182', '182', '182', '-20', '526']);
    assert.deepEqual(row.redColumns, [6]);
});

test('lane table sorts numeric lanes and includes both lane and position; waitlisted names remain in participant table', async () => {
    const f = createShareFixture(); f.tournament.type = 'EVENT'; f.tournament.maxParticipants = 3;
    f.rounds[0].participants[0].lane = 172; f.rounds[0].participants[1].lane = 43; f.rounds[0].participants[2].lane = 92;
    const lanes = await f.actions.getBandSharePreviewAction({ ...f.input, type: 'LANE_ASSIGNMENT' });
    assert.deepEqual(lanes.preview.table.rows.map(r => r.cells[1]), ['4-3', '9-2', '17-2']);
    const people = await f.actions.getBandSharePreviewAction({ ...f.input, type: 'PARTICIPANTS' });
    assert.equal(people.preview.table.rows.at(-1).cells.at(-1), '대기');
});

test('team events retain official group totals and member names in one wide table', async () => {
    const f = createShareFixture(); f.tournament.type = 'EVENT'; f.tournament.settings = '{"gameCount":3,"gameMode":"TEAM_2"}';
    f.rounds[0].participants.forEach((p, i) => { p.registration.entryGroupId = 'group_' + Math.floor(i / 2); });
    const result = await f.actions.getBandSharePreviewAction({ ...f.input, type: 'FINAL_RESULT' });
    assert.equal(result.success, true);
    assert.equal(result.preview.table.twoColumns, false); assert.equal(result.preview.table.rowUnit, '팀');
    assert.equal(result.preview.table.rows.length, 2);
    assert.match(result.preview.table.rows[0].cells[2], /선수0, 선수1/);
});

test('pagination keeps every row across the 54-person boundary and rejects excess instead of dropping people', () => {
    const { splitShareTablePages } = createShareFixture().load('src/lib/band/share-images.ts');
    const table = { kind: 'PARTICIPANTS', title: '가상 명단', twoColumns: true, columns: [{label:'번호',width:50},{label:'성함',width:100}],
        rows: Array.from({ length: 55 }, (_, i) => ({ cells: [String(i + 1), '선수' + i] })) };
    const pages = splitShareTablePages(table);
    assert.deepEqual(pages.map(p => p.length), [54, 1]);
    assert.deepEqual(pages.flat(), table.rows);
    assert.deepEqual(splitShareTablePages({ ...table, twoColumns: false }).map(p => p.length), [27, 27, 1]);
    assert.throws(() => splitShareTablePages({ ...table, rows: Array.from({ length: 1081 }, () => table.rows[0]) }), /20개/);
});

test('fresh table lookup rechecks center scope and score completeness, even after the initial preview gate', async () => {
    const f = createShareFixture(); f.tournament.type = 'CHAMP';
    const { getBandShareTableData } = f.load('src/lib/band/share-table-data.ts');
    await assert.rejects(() => getBandShareTableData('t1', 'r1', 'FINAL_RESULT', 'other'), /회차/);
    f.rounds[0].individualScores.pop();
    await assert.rejects(() => getBandShareTableData('t1', 'r1', 'FINAL_RESULT', 'center'), /점수 입력/);
    assert.equal(f.calls.writes, 0); assert.equal(f.calls.external, 0);
});
