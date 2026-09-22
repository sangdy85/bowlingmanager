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
    const { parseMobileScorePagination } = loadTs('src/lib/mobile-api/scores.ts', {
        '@/lib/prisma': { score: {} },
    });
    assert.deepEqual(parseMobileScorePagination(new URLSearchParams('page=bad&limit=0')),
        { page: 1, limit: 20 });
    assert.deepEqual(parseMobileScorePagination(new URLSearchParams('page=2&limit=1000')),
        { page: 2, limit: 100 });
});

test('group pagination happens after complete rows are grouped, so a boundary cannot split a session', async () => {
    const rows = [
        record({ id: 'a1' }), record({ id: 'a2' }),
        record({ id: 'b1', gameDate: date(21) }), record({ id: 'b2', gameDate: date(21) }),
        record({ id: 'c1', gameDate: date(20) }),
    ].map(({ team, ...item }) => ({ ...item, Team: team }));
    const prisma = { score: { findMany: async () => rows } };
    const { getMobileScoreGroups } = loadTs('src/lib/mobile-api/scores.ts', { '@/lib/prisma': prisma });
    const first = await getMobileScoreGroups('user-1', 1, 2);
    const second = await getMobileScoreGroups('user-1', 2, 2);
    assert.deepEqual(first.items.map(group => group.gameCount), [2, 2]);
    assert.deepEqual(second.items.map(group => group.gameCount), [1]);
    assert.deepEqual(first.pagination, { page: 1, limit: 2, total: 3, totalPages: 2 });
});

test('empty rows produce empty group pagination', async () => {
    const prisma = { score: { findMany: async () => [] } };
    const { getMobileScoreGroups } = loadTs('src/lib/mobile-api/scores.ts', { '@/lib/prisma': prisma });
    const result = await getMobileScoreGroups('user-1', 1, 20);
    assert.deepEqual(result, {
        items: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
});

test('group route requires auth and scopes the query to the authenticated user', async () => {
    let capturedWhere;
    const prisma = { score: { findMany: async args => {
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
