const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function loadLaneMovement() {
    const filename = path.resolve(__dirname, '../src/lib/lane-movement.ts');
    const module = { exports: {} };
    const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    new Function('require', 'module', 'exports', compiled)(require, module, module.exports);
    return module.exports;
}

const { calculateMovedLane, calculateGameLaneAssignments, wrapLane } = loadLaneMovement();

const move = (lane, moveType, tableCount, firstLane = 1, lastLane = 18) =>
    calculateMovedLane({ lane, firstLane, lastLane, moveType, tableCount });

test('CROSS count 2 maps every lane in 1..18 using odd-right and even-left', () => {
    const expected = [5, 16, 7, 18, 9, 2, 11, 4, 13, 6, 15, 8, 17, 10, 1, 12, 3, 14];
    assert.deepEqual(Array.from({ length: 18 }, (_, index) => move(index + 1, 'CROSS', 2)), expected);
});

test('CROSS preserves direction over repeated games and supports table counts 1, 2, and 3', () => {
    const sequence = (lane, count, games) => calculateGameLaneAssignments({
        lane, slot: 2, gameCount: games, firstLane: 1, lastLane: 18, moveType: 'CROSS', tableCount: count,
    }).map(item => item.lane);

    assert.deepEqual(sequence(9, 1, 3), [9, 11, 13]);
    assert.deepEqual(sequence(10, 1, 3), [10, 8, 6]);
    assert.deepEqual(sequence(9, 2, 4), [9, 13, 17, 3]);
    assert.deepEqual(sequence(10, 2, 4), [10, 6, 2, 16]);
    assert.deepEqual(sequence(9, 3, 3), [9, 15, 3]);
    assert.deepEqual(sequence(10, 3, 3), [10, 4, 16]);
});

test('RIGHT and LEFT keep table-to-lane conversion and circular boundaries', () => {
    assert.deepEqual([15, 16, 17, 18].map(lane => move(lane, 'RIGHT', 2)), [1, 2, 3, 4]);
    assert.deepEqual([1, 2, 3, 4].map(lane => move(lane, 'LEFT', 2)), [15, 16, 17, 18]);
    assert.equal(move(17, 'RIGHT', 2), 3);
    assert.equal(move(2, 'LEFT', 2), 16);
});

test('movement uses a configured non-1 lane range', () => {
    assert.equal(move(17, 'RIGHT', 2, 7, 18), 9);
    assert.equal(move(8, 'LEFT', 2, 7, 18), 16);
    assert.equal(move(17, 'CROSS', 2, 7, 18), 9);
    assert.equal(move(8, 'CROSS', 2, 7, 18), 16);
});

test('three-game assignments preserve slot and drive raw score lane lookup', () => {
    const assignments = calculateGameLaneAssignments({
        lane: 9, slot: 2, gameCount: 3, firstLane: 1, lastLane: 18, moveType: 'CROSS', tableCount: 2,
    });
    assert.deepEqual(assignments, [
        { gameNumber: 1, lane: 9, slot: 2 },
        { gameNumber: 2, lane: 13, slot: 2 },
        { gameNumber: 3, lane: 17, slot: 2 },
    ]);

    const rawScores = [
        { lane: 9, slot: 2, games: [101, 0, 0] },
        { lane: 13, slot: 2, games: [0, 202, 0] },
        { lane: 17, slot: 2, games: [0, 0, 303] },
    ];
    assert.deepEqual(assignments.map(({ gameNumber, lane, slot }) =>
        rawScores.find(row => row.lane === lane && row.slot === slot).games[gameNumber - 1]
    ), [101, 202, 303]);
});

test('helper rejects invalid ranges, lanes, counts, NaN, and non-integers', () => {
    assert.throws(() => move(9, 'CROSS', 2, 18, 1), /firstLane/);
    assert.throws(() => move(19, 'CROSS', 2), /within/);
    assert.throws(() => move(9, 'CROSS', 0), /tableCount/);
    assert.throws(() => move(9, 'CROSS', -1), /tableCount/);
    assert.throws(() => move(9, 'CROSS', 1.5), /tableCount/);
    assert.throws(() => move(Number.NaN, 'CROSS', 2), /lane/);
    assert.throws(() => wrapLane(2.5, 1, 18), /lane/);
    assert.throws(() => move(9, 'DIAGONAL', 2), /Unsupported/);
});

test('no movement keeps the lane while still validating lane data', () => {
    assert.equal(calculateMovedLane({ lane: 9, firstLane: 1, lastLane: 18 }), 9);
    assert.throws(() => calculateMovedLane({ lane: 19, firstLane: 1, lastLane: 18 }), /within/);
});

test('tournament bulk editor retains result-save wiring and uses shared lane assignments', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../src/components/tournaments/RoundBulkResultEditor.tsx'), 'utf8');
    assert.match(source, /calculateGameLaneAssignments/);
    assert.match(source, /await updateLeagueRoundResults\(round\.id, dataToSave\)/);
    assert.match(source, /teamAScores: teamData\.teamA\.map/);
    assert.match(source, /teamBScores: teamData\.teamB\.map/);
    assert.doesNotMatch(source, /Odd lanes move left|Even lanes move right/);
});
