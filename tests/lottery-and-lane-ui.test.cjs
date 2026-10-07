const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(name) {
    const source = fs.readFileSync(path.join(__dirname, '../src/lib', name + '.ts'), 'utf8');
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
    const module = { exports: {} };
    new Function('require', 'module', 'exports', code)(require, module, module.exports);
    return module.exports;
}
const { getEligibleCandidates, getPrizeWinnerRegistrationIds, getSpinRotation, randomCandidateIndex } = load('lottery-ui');
const { getLaneAnnouncement } = load('lane-announcement');
const { getRoundFinalResults } = load('round-final-results');
const person = (id, extras = {}) => ({ id: 'p-' + id, registrationId: id, createdAt: '2026-10-01', registration: { guestName: '동명이인', guestTeamName: '테스트팀' }, ...extras });
test('lane announcement sorts numeric encoded lanes, separates missing lanes and exposes no private fields', () => {
    const participants = [{ id: 'a', guestName: '가상A', lane: 101, paymentStatus: 'PAID', handicap: 20 }, { id: 'b', user: { name: '가상B' }, lane: 22 }, { id: 'c', lane: null }, { id: 'd', lane: 21 }, { id: 'e', lane: 0 }];
    const before = JSON.stringify(participants);
    const result = getLaneAnnouncement(participants);
    assert.deepEqual(result.assigned.map(p => p.lane), [21, 22, 101]);
    assert.deepEqual(result.unassigned.map(p => p.id), ['c', 'e']);
    assert.deepEqual(Object.keys(result.assigned[0]).sort(), ['id', 'lane', 'name', 'team']);
    assert.equal(JSON.stringify(participants), before);
});
test('candidates exclude winners, rankers and waitlist by registration ID; same names remain independent', () => {
    const participants = ['a', 'b', 'c', 'd', 'e', 'f'].map((id, i) => person(id, { createdAt: `2026-10-0${i + 1}` }));
    const before = JSON.stringify(participants);
    assert.deepEqual(getEligibleCandidates(participants, ['a'], ['b', 'c'], 5).map(p => p.registrationId), ['d', 'e']);
    assert.equal(getEligibleCandidates(participants, [], [], 0).length, 6);
    assert.equal(JSON.stringify(participants), before);
});
test('sequential draws exhaust a pool without duplicates even with duplicate input IDs', () => {
    const participants = [...Array.from({ length: 20 }, (_, i) => person(String(i))), person('0')];
    const winners = [];
    for (let i = 0; i < 20; i++) {
        const pool = getEligibleCandidates(participants, winners, [], 0);
        winners.push(pool[randomCandidateIndex(pool.length)].registrationId);
    }
    assert.equal(new Set(winners).size, 20);
    assert.deepEqual(getEligibleCandidates(participants, winners, [], 0), []);
    assert.equal(getEligibleCandidates(participants, [], [], 0).length, 20);
});
test('wheel arrow lands in the selected sector for every candidate from pools of 1 to 200', () => {
    for (let count = 1; count <= 200; count++) for (let index = 0; index < count; index++) {
        const rotation = getSpinRotation(index, count);
        const underArrow = ((360 - rotation % 360) % 360) / (360 / count);
        assert.equal(Math.floor(underArrow), index);
    }
    assert.throws(() => getSpinRotation(0, 0));
    assert.throws(() => randomCandidateIndex(0));
});
function fixture() {
    const participants = [person('a', { handicap: 10 }), person('b', { handicap: 0 }), person('c', { handicap: 0 }), person('d', { handicap: 0 })];
    const values = { a: [190, 190, 190], b: [200, 200, 200], c: [180, 220, 200], d: [300, 300, 300] };
    return { tournament: { type: 'CHAMP', maxParticipants: 3, settings: JSON.stringify({ gameCount: 3 }) }, roundNumber: 1, participants, individualScores: participants.flatMap(p => values[p.registrationId].map((score, i) => ({ registrationId: p.registrationId, gameNumber: i + 1, score }))) };
}
test('existing result order preserves handicap and high-low tie breakers and excludes waitlisted scores', () => {
    const round = fixture();
    const before = JSON.stringify(round);
    const { sortedResults } = getRoundFinalResults(round);
    assert.deepEqual(sortedResults.map(p => p.id), ['b', 'c', 'a']);
    assert.deepEqual(sortedResults.map(p => p.total), [600, 600, 600]);
    assert.equal(JSON.stringify(round), before);
});
test('existing result totals retain 300 cap and previous winner penalty behavior', () => {
    const round = fixture();
    round.tournament.maxParticipants = 0;
    round.tournament.settings = JSON.stringify({ gameCount: 3, minusHandicapRank1: -20 });
    round.participants[3].handicap = 20;
    round.prevRoundWinners = { rank1: { name: '동명이인', team: '테스트팀' } };
    const winner = getRoundFinalResults(round).sortedResults.find(p => p.id === 'd');
    assert.equal(winner.total, 880);
});


test('prize exclusion uses current round results for both individual and team formats', () => {
    const individual = [
        { id: 'a', scores: [200, 200, 200] },
        { id: 'b', scores: [190, 190, 190] },
        { id: 'c', scores: [180, 180, 180] },
        { id: 'd', scores: [170, 170, 170] },
    ];
    assert.deepEqual(getPrizeWinnerRegistrationIds(individual, false), ['a', 'b', 'c']);

    const team = [
        { id: 'group_1', scores: [600, 610, 620], registrationIds: ['a', 'b'] },
        { id: 'group_2', scores: [590, 600, 610], registrationIds: ['c', 'd'] },
        { id: 'group_3', scores: [580, 590, 600], registrationIds: ['e', 'f'] },
        { id: 'group_4', scores: [570, 580, 590], registrationIds: ['g', 'h'] },
    ];
    assert.deepEqual(getPrizeWinnerRegistrationIds(team, true), ['a', 'b', 'c', 'd', 'e', 'f']);
});

test('team podium exclusions de-duplicate registration IDs', () => {
    const team = [
        { id: 'group_1', scores: [600], registrationIds: ['a', 'b'] },
        { id: 'group_2', scores: [590], registrationIds: ['b', 'c'] },
        { id: 'group_3', scores: [580], registrationIds: ['d'] },
    ];
    assert.deepEqual(getPrizeWinnerRegistrationIds(team, true), ['a', 'b', 'c', 'd']);
});
