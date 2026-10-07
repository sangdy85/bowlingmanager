const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const compiled = ts.transpileModule(fs.readFileSync('src/lib/participant-search.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const loaded = { exports: {} };
new Function('exports', 'module', compiled)(loaded.exports, loaded);
const { getParticipantSearchIds: search } = loaded.exports;
const participants = [
    { id: 'first', guestName: '김예원', guestTeamName: 'Blue Club' },
    { id: 'second', user: { name: '문성복' }, team: { name: '가상 클럽' } },
    { id: 'waitlisted', guestName: '김예원', guestTeamName: '다른 팀' },
    { id: 'solo', user: null, team: null },
];

test('blank search shows everyone and never changes source order or data', () => {
    const snapshot = JSON.stringify(participants);
    assert.deepEqual([...search(participants, '  ')], participants.map(p => p.id));
    search(participants, '김예원');
    assert.equal(JSON.stringify(participants), snapshot);
});
test('names and teams support multiple words and case-insensitive matching', () => {
    assert.deepEqual([...search(participants, ' club  김예원 ')], ['first']);
    assert.deepEqual([...search(participants, '가상 문성복')], ['second']);
});
test('duplicate names retain distinct registration IDs including later participants', () => {
    assert.deepEqual([...search(participants, '김예원')], ['first', 'waitlisted']);
    assert.deepEqual([...search(participants, '다른 팀')], ['waitlisted']);
});
test('missing fields and unmatched searches are safe', () => {
    assert.deepEqual([...search(participants, '개인')], ['solo']);
    assert.equal(search(participants, '없는이름').size, 0);
    assert.equal(search([], '김').size, 0);
});
