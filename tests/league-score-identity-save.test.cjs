const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function load(file, mocks = {}) {
    const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    const module = { exports: {} };
    new Function('require', 'module', 'exports', output)(
        id => Object.hasOwn(mocks, id) ? mocks[id] : require(id), module, module.exports,
    );
    return module.exports;
}
const identity = load('src/lib/league-score-identity.ts');
const row = (overrides = {}) => ({ id: 'score-1', teamId: 'team-1', teamSquad: null,
    userId: 'member-1', playerName: '테스트회원', handicap: 0, score1: 200, score2: 210, score3: 220, ...overrides });
const members = [{ userId: 'member-1', name: '테스트회원', teamId: 'team-1', squad: null }];

test('re-entering an unchanged name keeps its account; a different name clears it', () => {
    assert.equal(identity.changeLeaguePlayerName(row(), ' 테스트회원 ').userId, 'member-1');
    assert.equal(identity.changeLeaguePlayerName(row(), '다른선수').userId, null);
    assert.equal(identity.changeLeaguePlayerName(row({ identityMode: 'GUEST' }), '다른선수').identityMode, undefined);
});
test('stale editor preserves an already linked score without changing any score fields', () => {
    const input = row({ userId: null });
    assert.deepEqual(identity.preserveLeagueScoreIdentities([input], [row()], members), [row()]);
});
test('existing account name is a fallback when an old merge cleared the snapshot', () => {
    assert.equal(identity.preserveLeagueScoreIdentities([row({ userId: null })],
        [row({ playerName: null, User: { name: '테스트회원' } })], members)[0].userId, 'member-1');
});
test('names alone never turn guests into members, including another matchup/team/squad', () => {
    for (const previous of [[], [row({ id: 'other-score' })], [row({ teamId: 'other-team' })], [row({ teamSquad: 'B' })]]) {
        assert.equal(identity.preserveLeagueScoreIdentities([row({ userId: null })], previous, [])[0].userId, null);
    }
    assert.equal(identity.preserveLeagueScoreIdentities([row({ userId: null })], [row({ userId: null })], [])[0].userId, null);
});
test('ambiguous old clients do not borrow an arbitrary same-name account', () => {
    assert.equal(identity.preserveLeagueScoreIdentities([row({ id: undefined, userId: null })],
        [row(), row({ id: 'score-2', userId: 'member-2' })], [])[0].userId, null);
});
test('one matching team member links automatically; ambiguity requires a choice', () => {
    assert.equal(identity.preserveLeagueScoreIdentities([row({ userId: null })], [], members)[0].userId, 'member-1');
    assert.throws(() => identity.preserveLeagueScoreIdentities([row({ userId: null })], [],
        [...members, { ...members[0], userId: 'member-2' }]), /동명 회원/);
    assert.equal(identity.preserveLeagueScoreIdentities([row({ userId: null, identityMode: 'GUEST' })], [], members)[0].userId, null);
    assert.equal(identity.preserveLeagueScoreIdentities([row({ userId: null, playerName: '실제게스트' })], [], members)[0].userId, null);
});
test('explicit guest choice is retained; a selected member must belong to this team/squad', () => {
    assert.equal(identity.preserveLeagueScoreIdentities([row({ identityMode: 'GUEST' })], [row()], members)[0].userId, null);
    assert.throws(() => identity.preserveLeagueScoreIdentities([row({ userId: 'outsider' })], [row()], members), /등록된 회원/);
    assert.throws(() => identity.preserveLeagueScoreIdentities([row({ teamSquad: 'B' })], [], members), /등록된 회원/);
    assert.equal(identity.preserveLeagueScoreIdentities([row({ teamSquad: 'A' })], [],
        [{ ...members[0], squad: 'A' }])[0].userId, 'member-1');
});
test('duplicate same-match names cannot automatically create two rows for one account', () => {
    assert.throws(() => identity.preserveLeagueScoreIdentities([row({userId:null}),row({id:'second',userId:null})],[],members),/중복/);
});

function actionFixture() {
    let permitted = true;
    const writes = [];
    const tournament = { id: 'league-1', centerId: 'center-1', teamHandicapLimit: null,
        registrations: [{ ...members[0], user: { name: members[0].name } }] };
    const match = { id: 'match-1', individualScores: [row()], round: { tournamentId: tournament.id, tournament } };
    const prisma = {
        leagueMatchup: {
            findUnique: async () => match,
            update: input => { writes.push(input); return Promise.resolve(input); },
        },
        leagueRound: { findUnique: async () => ({ tournamentId: tournament.id, tournament, matchups: [match] }) },
        $transaction: async promises => Promise.all(promises),
    };
    const actions = load('src/app/actions/league-actions.ts', {
        '@/lib/prisma': { __esModule: true, default: prisma },
        '@/lib/league-score-identity': identity,
        '@/lib/center-league-identity': { getCenterLeagueMembers: async () => [] },
        '@/lib/auth-utils': { verifyCenterAdmin: async () => { if (!permitted) throw new Error('권한 없음'); } },
        '@/lib/league-templates': {}, '@/lib/tournament-utils': {}, 'next/cache': { revalidatePath() {} },
    });
    return { actions, writes, rejectPermission: () => { permitted = false; } };
}
for (const bulk of [false, true]) {
    const label = bulk ? 'bulk round save' : 'single matchup save';
    const save = (f, scores, matchupId = 'match-1') => bulk
        ? f.actions.updateLeagueRoundResults('round-1', [{ matchupId, teamAScores: scores, teamBScores: [] }])
        : f.actions.updateLeagueMatchupResult(matchupId, { teamAScores: scores, teamBScores: [] });
    test(`${label}: real action preserves member link, scores, team totals and wins`, async () => {
        const f = actionFixture();
        await save(f, [row({ userId: null })]);
        assert.equal(f.writes.length, 1);
        const result = f.writes[0].data;
        assert.deepEqual(result.individualScores.createMany.data, [{ teamId: 'team-1', teamSquad: null,
            userId: 'member-1', playerName: '테스트회원', handicap: 0, score1: 200, score2: 210, score3: 220 }]);
        assert.deepEqual([result.scoreA1, result.scoreA2, result.scoreA3, result.pointsA, result.pointsB], [200,210,220,4,0]);
    });
    test(`${label}: unregistered account and missing permission stop all writes`, async () => {
        const f = actionFixture();
        await assert.rejects(save(f, [row({ userId: 'outsider' })]), /등록된 회원/);
        f.rejectPermission();
        await assert.rejects(save(f, [row()]), /권한/);
        assert.equal(f.writes.length, 0);
    });
    if (bulk) test('bulk save refuses a matchup belonging to another round before writing', async () => {
        const f = actionFixture();
        await assert.rejects(save(f, [row()], 'other-round-match'), /해당 주차/);
        assert.equal(f.writes.length, 0);
    });
}
