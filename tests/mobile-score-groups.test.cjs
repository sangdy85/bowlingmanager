// Run: node --test tests/mobile-score-groups.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { createRequire } = require('node:module');
const { NextRequest } = require('next/server');

function loadTs(relative, overrides = {}, cache = new Map()) {
    const filename = path.resolve(__dirname, '..', relative);
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const nativeRequire = createRequire(filename);
    const localRequire = id => {
        if (Object.hasOwn(overrides, id)) return overrides[id];
        if (id.startsWith('@/')) return loadTs(`src/${id.slice(2)}.ts`, overrides, cache);
        return nativeRequire(id);
    };
    const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    }).outputText;
    new Function('require', 'module', 'exports', compiled)(localRequire, module, module.exports);
    return module.exports;
}

const { groupScores } = loadTs('src/lib/score-groups.ts');
const date = day => new Date(`2026-09-${String(day).padStart(2, '0')}T00:00:00.000Z`);
const record = (changes = {}) => ({
    id: 'score-1', source: 'PERSONAL', score: 200, gameDate: date(22),
    gameType: ' 정기전 ', memo: null, team: { id: 'team-1', name: '배볼러' },
    createdAt: new Date('2026-09-22T01:00:00.000Z'), ...changes,
});

test('groups same calendar date, normalized type and team with totals and deterministic order', () => {
    const groups = groupScores([
        record({ id: 'later', score: 213, createdAt: new Date('2026-09-22T02:00:00Z') }),
        record({ id: 'first', score: 202, createdAt: new Date('2026-09-22T01:00:00Z') }),
    ]);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].gameType, '정기전');
    assert.deepEqual(groups[0].scores.map(item => item.score), [202, 213]);
    assert.equal(groups[0].total, 415);
    assert.equal(groups[0].average, 207.5);
    assert.equal(groups[0].gameCount, 2);
});

test('separates different dates, types, teams, sources and explicit sessions', () => {
    const groups = groupScores([
        record(),
        record({ id: 'date', gameDate: date(21) }),
        record({ id: 'type', gameType: '벙개' }),
        record({ id: 'team', team: { id: 'team-2', name: '다른 팀' } }),
        record({ id: 'source', source: 'LEAGUE' }),
        record({ id: 'session-a', sessionId: 'a' }),
        record({ id: 'session-b', sessionId: 'b' }),
    ]);
    assert.equal(groups.length, 7);
});

test('null team and null type form an explicit group and gameOrder wins over timestamps', () => {
    const groups = groupScores([
        record({ id: 'game-2', team: null, gameType: null, gameOrder: 2,
            createdAt: new Date('2026-09-22T01:00:00Z') }),
        record({ id: 'game-1', team: null, gameType: null, gameOrder: 1,
            createdAt: new Date('2026-09-22T02:00:00Z') }),
    ]);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].team, null);
    assert.equal(groups[0].gameType, null);
    assert.deepEqual(groups[0].scores.map(item => item.id), ['game-1', 'game-2']);
});

test('group IDs are stable and blank game types normalize to null', () => {
    const records = [
        record({ id: 'blank', gameType: '   ', team: null }),
        record({ id: 'null', gameType: null, team: null }),
    ];
    const first = groupScores(records);
    const second = groupScores([...records].reverse());
    assert.equal(first.length, 1);
    assert.equal(first[0].gameType, null);
    assert.equal(first[0].id, second[0].id);
});

test('group pagination defaults invalid values and caps limit at 100', () => {
    const { parseMobileScorePagination, parseMobileScoreFilters } = loadTs('src/lib/mobile-api/scores.ts', {
        '@/lib/prisma': { score: {} },
    });
    assert.deepEqual(parseMobileScorePagination(new URLSearchParams('page=bad&limit=0')),
        { page: 1, limit: 20 });
    assert.deepEqual(parseMobileScorePagination(new URLSearchParams('page=2&limit=1000')),
        { page: 2, limit: 100 });
    assert.deepEqual(parseMobileScoreFilters(new URLSearchParams(
        'year=2025&category=OFFICIAL&officialType=STANDING_LEAGUE&minAverage=180&maxAverage=220',
    )), {
        year: 2025, category: 'OFFICIAL', officialType: 'STANDING_LEAGUE', minAverage: 180, maxAverage: 220,
    });
    assert.throws(() => parseMobileScoreFilters(new URLSearchParams('category=REGULAR&officialType=EVENT')),
        error => error.code === 'INVALID_FILTER');
});

test('integrated record filters combine year, taxonomy and session average before pagination', async () => {
    const { getMobileScoreGroups } = loadTs('src/lib/mobile-api/scores.ts', { '@/lib/prisma': {} });
    const integratedRows = [
        record({ id: 'regular', score: 200, gameType: '정기전', gameDate: new Date('2025-01-01Z') }),
        record({ id: 'meetup', score: 210, gameType: '벙개', gameDate: new Date('2025-02-01Z') }),
        record({ id: 'exchange', score: 220, gameType: '교류전', gameDate: new Date('2025-03-01Z') }),
        record({ id: 'league', source: 'LEAGUE', score: 190, gameType: '상주리그', gameDate: new Date('2025-04-01Z') }),
        record({ id: 'champ', source: 'TOURNAMENT', score: 230, gameType: '챔프전', gameDate: new Date('2026-04-01Z') }),
        record({ id: 'event', source: 'TOURNAMENT', score: 180, gameType: '이벤트전', gameDate: new Date('2025-05-01Z') }),
        record({ id: 'other', score: 170, gameType: null, gameDate: new Date('2025-06-01Z') }),
    ];
    const result = await getMobileScoreGroups('user-1', 1, 20,
        groupDependencies({ integratedRows }), {
            year: 2025, category: 'OFFICIAL', officialType: 'STANDING_LEAGUE',
            minAverage: 180, maxAverage: 200,
        });
    assert.deepEqual(result.availableYears, [2026, 2025]);
    assert.equal(result.pagination.total, 1);
    assert.deepEqual(result.items.map(item => ({
        id: item.scores[0].id, year: item.year, category: item.category, subcategory: item.subcategory,
    })), [{ id: 'league', year: 2025, category: 'OFFICIAL', subcategory: 'STANDING_LEAGUE' }]);
});

test('record taxonomy retains every club, official and unknown category', () => {
    const { recordTaxonomy } = loadTs('src/lib/mobile-api/scores.ts', { '@/lib/prisma': {} });
    const cases = [
        [{ source: 'PERSONAL', gameType: '정기전' }, ['REGULAR', null]],
        [{ source: 'PERSONAL', gameType: '벙개' }, ['MEETUP', null]],
        [{ source: 'PERSONAL', gameType: '교류전' }, ['EXCHANGE', null]],
        [{ source: 'LEAGUE', gameType: '상주리그' }, ['OFFICIAL', 'STANDING_LEAGUE']],
        [{ source: 'TOURNAMENT', gameType: '챔프전' }, ['OFFICIAL', 'CHAMPIONSHIP']],
        [{ source: 'TOURNAMENT', gameType: '이벤트전' }, ['OFFICIAL', 'EVENT']],
        [{ source: 'PERSONAL', gameType: '연습' }, ['OTHER', null]],
        [{ source: 'PERSONAL', gameType: null }, ['OTHER', null]],
    ];
    for (const [input, expected] of cases) {
        const result = recordTaxonomy(input);
        assert.deepEqual([result.category, result.subcategory], expected);
    }
});

test('group pagination happens after complete rows are grouped, so a boundary cannot split a session', async () => {
    const rows = [
        record({ id: 'a1' }), record({ id: 'a2' }),
        record({ id: 'b1', gameDate: date(21) }), record({ id: 'b2', gameDate: date(21) }),
        record({ id: 'c1', gameDate: date(20) }),
    ].map(({ team, ...item }) => ({ ...item, Team: team }));
    const { getMobileScoreGroups } = loadTs('src/lib/mobile-api/scores.ts', { '@/lib/prisma': {} });
    const dependencies = groupDependencies({ userRows: rows });
    const first = await getMobileScoreGroups('user-1', 1, 2, dependencies);
    const second = await getMobileScoreGroups('user-1', 2, 2, dependencies);
    assert.deepEqual(first.items.map(group => group.gameCount), [2, 2]);
    assert.equal(first.items[0].activityId, '2026-09-22~REGULAR');
    assert.deepEqual(second.items.map(group => group.gameCount), [1]);
    assert.deepEqual(first.pagination, { page: 1, limit: 2, total: 3, totalPages: 2 });
});

test('empty rows produce empty group pagination', async () => {
    const { getMobileScoreGroups } = loadTs('src/lib/mobile-api/scores.ts', { '@/lib/prisma': {} });
    const result = await getMobileScoreGroups('user-1', 1, 20, groupDependencies());
    assert.deepEqual(result, {
        items: [], availableYears: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
});

test('regular team groups use the Phase 12 participant rank for 1st through 4th place', async () => {
    const { getMobileScoreGroups } = loadTs('src/lib/mobile-api/scores.ts', { '@/lib/prisma': {} });
    for (const expectedPosition of [1, 2, 3, 4]) {
        const gameDate = new Date('2026-09-18T15:00:00.000Z');
        const myTotal = 270 - expectedPosition * 20;
        const userRows = [userScore({ id: 'mine', score: myTotal, gameDate })];
        const opponents = Array.from({ length: 4 }, (_, index) => teamScore({
            id: `other-${index}`, score: 240 - index * 20, gameDate,
            userId: `other-user-${index}`, userName: `상대 ${index}`,
        }));
        const myScore = teamScore({ id: 'mine', score: myTotal, gameDate });
        const members = [member('membership-me', 'user-1', '내 별명'),
            ...opponents.map((_, index) => member(`membership-${index}`, `other-user-${index}`, `상대 ${index}`))];
        const result = await getMobileScoreGroups('user-1', 1, 20, groupDependencies({
            userRows, teamRows: [myScore, ...opponents], members,
        }));
        assert.deepEqual(result.items[0].rank, { position: expectedPosition, participantCount: 5 });
    }
});

test('rank identity uses TeamMember user identity, preserves aliases and never name-matches guests', async () => {
    const { getMobileScoreGroups } = loadTs('src/lib/mobile-api/scores.ts', { '@/lib/prisma': {} });
    const gameDate = new Date('2026-09-18T15:00:00.000Z');
    const result = await getMobileScoreGroups('user-1', 1, 20, groupDependencies({
        userRows: [userScore({ id: 'mine', score: 200, gameDate })],
        teamRows: [
            teamScore({ id: 'guest', score: 300, gameDate, userId: null, guestName: '같은 이름', userName: null }),
            teamScore({ id: 'other', score: 250, gameDate, userId: 'other-user', userName: '같은 이름' }),
            teamScore({ id: 'mine', score: 200, gameDate, userId: 'user-1', userName: '원래 이름' }),
        ],
        members: [
            member('membership-me', 'user-1', '같은 이름', '원래 이름'),
            member('membership-other', 'other-user', null, '같은 이름'),
        ],
    }));
    assert.deepEqual(result.items[0].rank, { position: 3, participantCount: 3 });
    const serialized = JSON.stringify(result.items[0]);
    assert.equal(serialized.includes('other-user'), false);
    assert.equal(serialized.includes('membership-other'), false);
    assert.deepEqual(Object.keys(result.items[0].rank), ['position', 'participantCount']);
});

test('ties keep the existing sequential Phase 12 ranks', async () => {
    const { getMobileScoreGroups } = loadTs('src/lib/mobile-api/scores.ts', { '@/lib/prisma': {} });
    const gameDate = new Date('2026-09-18T15:00:00.000Z');
    const result = await getMobileScoreGroups('user-1', 1, 20, groupDependencies({
        userRows: [userScore({ id: 'mine', score: 200, gameDate })],
        teamRows: [
            teamScore({ id: 'first', score: 200, gameDate, userId: 'other-user', userName: '먼저' }),
            teamScore({ id: 'mine', score: 200, gameDate }),
        ],
        members: [member('membership-other', 'other-user', '먼저'), member('membership-me', 'user-1', '나')],
    }));
    assert.deepEqual(result.items[0].rank, { position: 2, participantCount: 2 });
});

test('rank is null outside regular team groups and when one UTC group crosses KST dates', async () => {
    const { getMobileScoreGroups } = loadTs('src/lib/mobile-api/scores.ts', { '@/lib/prisma': {} });
    const userRows = [
        userScore({ id: 'casual', gameType: '벙개', gameDate: date(22) }),
        userScore({ id: 'house', gameType: '상주', gameDate: date(21) }),
        userScore({ id: 'personal', team: null, gameDate: date(20) }),
        userScore({ id: 'boundary-a', gameDate: new Date('2026-09-19T14:59:00.000Z') }),
        userScore({ id: 'boundary-b', gameDate: new Date('2026-09-19T15:01:00.000Z') }),
    ];
    const dependencies = groupDependencies({ userRows });
    const result = await getMobileScoreGroups('user-1', 1, 20, dependencies);
    assert.equal(result.items.length, 4);
    assert.equal(result.items.every(item => item.rank === null), true);
    assert.equal(dependencies.calls.teamScores, 0);
    assert.equal(dependencies.calls.members, 0);
});

test('rank maps the UTC Records group to its KST activity and isolates other teams and dates', async () => {
    const { getMobileScoreGroups } = loadTs('src/lib/mobile-api/scores.ts', { '@/lib/prisma': {} });
    const gameDate = new Date('2026-09-18T15:00:00.000Z');
    const dependencies = groupDependencies({
        userRows: [userScore({ id: 'mine', score: 200, gameDate })],
        teamRows: [
            teamScore({ id: 'mine', score: 200, gameDate }),
            teamScore({ id: 'same-scope', score: 210, gameDate, userId: 'other-user', userName: '상대' }),
            teamScore({ id: 'other-team', score: 300, gameDate, teamId: 'team-2', userId: 'other-2', userName: '다른 팀' }),
            teamScore({ id: 'other-date', score: 300, gameDate: new Date('2026-09-19T15:00:00.000Z'), userId: 'other-3', userName: '다른 날짜' }),
        ],
        members: [member('membership-me', 'user-1', '나'), member('membership-other', 'other-user', '상대')],
    });
    const result = await getMobileScoreGroups('user-1', 1, 20, dependencies);
    assert.deepEqual(dependencies.scopes, [{ teamId: 'team-1', date: '2026-09-19' }]);
    assert.deepEqual(result.items[0].rank, { position: 2, participantCount: 2 });
});

test('rank survives pagination and uses a constant number of batch queries', async () => {
    const { getMobileScoreGroups } = loadTs('src/lib/mobile-api/scores.ts', { '@/lib/prisma': {} });
    const userRows = Array.from({ length: 25 }, (_, index) => userScore({
        id: `mine-${index}`, score: 200, gameDate: new Date(Date.UTC(2026, 8, 25 - index, 15)),
    }));
    const teamRows = userRows.map((row) => teamScore({
        id: row.id, score: row.score, gameDate: row.gameDate,
    }));
    const dependencies = groupDependencies({
        userRows, teamRows, members: [member('membership-me', 'user-1', '나')],
    });
    const result = await getMobileScoreGroups('user-1', 2, 20, dependencies);
    assert.equal(result.items.length, 5);
    assert.equal(result.items.every(item => item.rank?.position === 1), true);
    assert.equal(dependencies.calls.userScores, 1);
    assert.equal(dependencies.calls.teamScores, 1);
    assert.equal(dependencies.calls.members, 1);
    assert.equal(dependencies.scopes.length, 5);
});

test('group route requires auth and scopes the query to the authenticated user', async () => {
    let capturedWhere;
    const prisma = { user: { findUnique: async () => null }, score: { findMany: async args => {
        capturedWhere = args.where;
        return [];
    } } };
    const authenticated = loadTs('src/app/api/mobile/v1/scores/groups/route.ts', {
        '@/lib/prisma': prisma,
        '@/lib/mobile-api/auth': { getMobileApiUserId: async () => 'user-1' },
    });
    const response = await authenticated.GET(new NextRequest(
        'https://example.test/api/mobile/v1/scores/groups?page=1&limit=20',
    ));
    assert.equal(response.status, 200);
    assert.equal(capturedWhere.userId, 'user-1');

    const unauthenticated = loadTs('src/app/api/mobile/v1/scores/groups/route.ts', {
        '@/lib/prisma': prisma,
        '@/lib/mobile-api/auth': { getMobileApiUserId: async () => null },
    });
    assert.equal((await unauthenticated.GET(new NextRequest(
        'https://example.test/api/mobile/v1/scores/groups',
    ))).status, 401);
});

function userScore(changes = {}) {
    const base = record(changes);
    const { source, team, ...score } = base;
    return { ...score, Team: team };
}

function teamScore({
    id = 'mine', score = 200, gameDate = new Date('2026-09-18T15:00:00.000Z'),
    gameType = '정기전', teamId = 'team-1', userId = 'user-1', guestName = null,
    userName = '나', memo = null,
} = {}) {
    return {
        id, score, gameDate, gameType, teamId, userId, guestName, memo,
        createdAt: new Date(gameDate.getTime() + 1000),
        User: userName == null ? null : { name: userName },
    };
}

function member(id, userId, alias, name = alias ?? userId) {
    return { id, teamId: 'team-1', userId, alias, user: { name } };
}

function groupDependencies({ userRows = [], teamRows = [], members = [], integratedRows } = {}) {
    const dependencies = {
        calls: { userScores: 0, teamScores: 0, members: 0 },
        scopes: [],
        async listUserScores() {
            dependencies.calls.userScores += 1;
            return userRows;
        },
        async listTeamRegularScores(scopes) {
            dependencies.calls.teamScores += 1;
            dependencies.scopes = scopes;
            const keys = new Set(scopes.map(scope => `${scope.teamId}:${scope.date}`));
            return teamRows.filter(row => keys.has(`${row.teamId}:${new Date(row.gameDate.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)}`));
        },
        async listTeamMembers(teamIds) {
            dependencies.calls.members += 1;
            return members.filter(row => teamIds.includes(row.teamId));
        },
    };
    if (integratedRows) dependencies.listIntegratedRecords = async () => integratedRows;
    return dependencies;
}
