const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

const compiled = ts.transpileModule(fs.readFileSync('src/lib/side-game-announcement.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

const loaded = { exports: {} };
new Function('exports', 'module', compiled)(loaded.exports, loaded);

const {
    buildSideGameAnnouncementRows: rows,
    splitSideGameAnnouncementRows: split,
    formatSideGameAnnouncement: format,
} = loaded.exports;

const players = [
    { regId: 'a', name: '김예원' },
    { regId: 'b', name: '문성복' },
    { regId: 'c', name: '김예원' },
    { regId: 'd', name: '홍길동' },
];

test('announcement lists anyone participating in side, extra or ball in original registration order', () => {
    const result = rows(players, {
        a: new Set(['STANDARD', 'BALL']),
        b: new Set(['EXTRA']),
        c: new Set(['STANDARD', 'EXTRA']),
        d: new Set(['BALL']),
    });

    assert.deepEqual(result.map(row => [row.regId, row.name]), [
        ['a', '김예원'],
        ['b', '문성복'],
        ['c', '김예원'],
        ['d', '홍길동'],
    ]);
});

test('announcement columns are side, extra, ball and preserve registration IDs', () => {
    const result = rows(players, {
        a: new Set(['STANDARD', 'BALL']),
        c: new Set(['STANDARD', 'EXTRA', 'BALL']),
    });

    assert.deepEqual(result, [
        { regId: 'a', name: '김예원', standard: true, extra: false, ball: true },
        { regId: 'c', name: '김예원', standard: true, extra: true, ball: true },
    ]);
});

test('split balances 12 participants as 6 and 6, and 20 as 10 and 10', () => {
    const makeRows = count => Array.from({ length: count }, (_, index) => ({
        regId: String(index + 1),
        name: `선수${index + 1}`,
        standard: true,
        extra: index % 2 === 0,
        ball: index % 3 === 0,
    }));

    assert.deepEqual(split(makeRows(12)).map(side => side.length), [6, 6]);
    assert.deepEqual(split(makeRows(20)).map(side => side.length), [10, 10]);
});

test('odd participant counts keep one extra row on the left table', () => {
    const result = Array.from({ length: 7 }, (_, index) => ({
        regId: String(index),
        name: `선수${index}`,
        standard: true,
        extra: false,
        ball: false,
    }));

    assert.deepEqual(split(result).map(side => side.length), [4, 3]);
});

test('copy text uses side-extra-ball order and marks extra-only and ball-only participants', () => {
    const result = rows(players, {
        a: new Set(['STANDARD', 'BALL']),
        b: new Set(['EXTRA']),
        d: new Set(['BALL']),
    });
    const text = format(result, 3);

    assert.match(text, /^\[3회차 사이드 게임 명단\]/);
    assert.match(text, /이름\t사이드\t번외\t볼사이드\t\t이름\t사이드\t번외\t볼사이드/);
    assert.match(text, /김예원\tO\t\tO/);
    assert.match(text, /문성복\t\tO\t/);
    assert.match(text, /홍길동\t\t\tO/);
});

test('announcement projection never mutates source players or participation used by save', () => {
    const selection = {
        a: new Set(['STANDARD']),
        b: new Set(['EXTRA']),
    };
    const beforeSelection = JSON.stringify(Object.entries(selection).map(([id, set]) => [id, [...set]]));
    const beforePlayers = JSON.stringify(players);

    format(rows(players, selection), 3);

    assert.equal(JSON.stringify(players), beforePlayers);
    assert.equal(
        JSON.stringify(Object.entries(selection).map(([id, set]) => [id, [...set]])),
        beforeSelection,
    );
});

test('empty announcement is safe', () => {
    assert.deepEqual(rows([], {}), []);
    assert.equal(format([], 1), '[1회차 사이드 게임 명단]\n이름\t사이드\t번외\t볼사이드\t\t이름\t사이드\t번외\t볼사이드');
});
