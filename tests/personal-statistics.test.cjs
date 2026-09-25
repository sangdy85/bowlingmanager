// Run: node --test tests/personal-statistics.test.cjs
// In-memory fixtures only. No database connection, writes, or extra dependencies.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { createRequire } = require('node:module');

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

// Evaluate the Prisma predicates used by these reads, including nested relations.
function matches(row, where) {
    return Object.entries(where).every(([key, value]) => {
        if (key === 'AND') return value.every(part => matches(row, part));
        if (key === 'OR') return value.some(part => matches(row, part));
        const actual = row?.[key];
        if (value === null || typeof value !== 'object') return actual === value;
        if ('contains' in value) return typeof actual === 'string' && actual.includes(value.contains);
        if ('in' in value) return value.in.includes(actual);
        if ('gte' in value || 'lte' in value) return actual != null
            && (!('gte' in value) || actual >= value.gte)
            && (!('lte' in value) || actual <= value.lte);
        return matches(actual, value);
    });
}

const user = { id: 'fixture-user', name: 'Fixture Bowler', teamMemberships: [
    { id: 'member-1', teamId: 'team-1', team: {
        id: 'team-1', name: 'Fixture Team', ownerId: null, User: [],
    } },
] };
const date = new Date('2026-06-01T00:00:00.000Z');
const personal = (changes = {}) => ({ id: 'p', userId: user.id, score: 200,
    gameDate: date, createdAt: date, gameType: null, memo: null, Team: null, ...changes });
const league = (changes = {}) => ({ id: 'l', userId: user.id, playerName: null,
    matchupId: 'matchup-1', teamId: 'team-1', Team: { name: 'Fixture Team' }, handicap: 10,
    score1: 190, score2: 0, score3: -1, createdAt: date,
    LeagueMatchup: { round: { date, tournament: { name: 'Fixture League', type: 'LEAGUE' } } },
    ...changes });
const tournament = (changes = {}) => ({ id: 't', registrationId: 'registration-1', roundId: 'round-1',
    gameNumber: 1, score: 195, createdAt: date,
    round: { date }, registration: { userId: user.id, guestName: null,
        teamId: null, guestTeamName: null, handicap: 5, team: null,
        tournament: { name: 'Fixture Event', type: 'EVENT' } }, ...changes });

function database(rows = {}) {
    const calls = [];
    const db = {};
    for (const model of ['score', 'leagueMatchupIndividualScore', 'tournamentScore']) {
        db[model] = { findMany: async args => {
            calls.push({ model, ...args });
            return (rows[model] || []).filter(row => matches(row, args.where));
        } };
    }
    db.user = { findUnique: async args => {
        assert.deepEqual(args.where, { id: user.id });
        assert.deepEqual(args.select.teamMemberships.where, { team: { isActive: true } });
        return user;
    } };
    db.teamMember = { findMany: async () => [{
        id: 'member-1', teamId: 'team-1', userId: user.id, alias: null,
        user: { name: user.name },
    }] };
    db.teamEvent = { findMany: async () => [] };
    return { db, calls };
}
const shared = loadTs('src/lib/personal-statistics.ts', { '@/lib/prisma': {} });
async function calculate(rows, year = 2026) {
    const { db, calls } = database(rows);
    const data = await shared.getPersonalStatisticsData(user, year, db);
    return { data, calls, summary: shared.summarizeIntegratedRecords(data.integratedRecords, year) };
}

test('personal scores, zero and over-300 values match web; only 벙개 is excluded', async () => {
    const { summary, data } = await calculate({ score: [personal(), personal({ id: 'zero', score: 0 }),
        personal({ id: 'high', score: 310 }), personal({ id: 'excluded', gameType: '벙개', score: 300 })] });
    assert.equal(summary.average, 170);
    assert.equal(summary.highScore, 310);
    assert.equal(summary.gameCount, 3);
    assert.equal(data.myYearlyScores.length, 4); // Web's other rows retain 벙개.
});

test('league includes positive raw games only and adds handicap per game', async () => {
    const { summary } = await calculate({ leagueMatchupIndividualScore: [league({ score1: 300, score2: 180 })] });
    assert.equal(summary.gameCount, 2);
    assert.equal(summary.highScore, 310);
    assert.equal(summary.average, 250);
    assert.deepEqual(summary.recentScores.map(s => s.id), ['LEAGUE:l:1', 'LEAGUE:l:2']);
});

test('tournament adds registration handicap and includes zero as web does', async () => {
    const { summary } = await calculate({ tournamentScore: [tournament(), tournament({ id: 'zero', score: 0 })] });
    assert.equal(summary.average, 102.5);
    assert.equal(summary.gameCount, 2);
    assert.equal(summary.recentScores[0].source, 'TOURNAMENT');
    assert.equal(summary.recentScores[0].team, null);
});

test('mixed normalized records equal the legacy web integrated fixture calculation', async () => {
    const { data, summary } = await calculate({ score: [personal({ score: 211 }), personal({ gameType: '벙개' })],
        leagueMatchupIndividualScore: [league({ score2: 210 })], tournamentScore: [tournament()] });
    // Frozen pre-extraction /personal array formula + StatsDisplayRow formula.
    const web = [
        ...data.myYearlyScores.filter(s => s.gameType !== '벙개').map(s => s.score),
        ...data.leagueScores.flatMap(s => [s.score1, s.score2, s.score3].filter(v => v > 0).map(v => v + (s.handicap || 0))),
        ...data.tournamentScores.map(s => s.score + (s.registration.handicap || 0)),
    ];
    assert.equal(summary.gameCount, web.length);
    assert.equal(summary.highScore, Math.max(...web));
    assert.equal(summary.average, Number((web.reduce((a, b) => a + b, 0) / web.length).toFixed(1)));
    assert.equal(summary.average, 207.8);
    assert.equal(new Set(summary.recentScores.map(s => s.source)).size, 3);
});

test('recent ten use event date then stable ID, without mutating integrated records', async () => {
    const { data, summary } = await calculate({ score: Array.from({ length: 12 }, (_, i) => personal({
        id: String(i), score: 100 + i, gameDate: new Date(Date.UTC(2026, 0, i + 1)),
    })) });
    assert.equal(summary.recentScores.length, 10);
    assert.equal(summary.recentScores[0].score, 111);
    assert.equal(summary.recentScores[9].score, 102);
    assert.equal(summary.recentAverage, 106.5);
    assert.equal(data.integratedRecords[0].score, 100);
    const forward = shared.summarizeIntegratedRecords(data.integratedRecords.map(s => ({ ...s, gameDate: date })), 2026);
    const reverse = shared.summarizeIntegratedRecords(data.integratedRecords.map(s => ({ ...s, gameDate: date })).reverse(), 2026);
    assert.deepEqual(forward, reverse);
});

test('adding recentSessions does not change the four legacy dashboard metrics', async () => {
    const { summary } = await calculate({
        score: [personal({ id: 'p1', score: 202 }), personal({ id: 'p2', score: 213 })],
        leagueMatchupIndividualScore: [league({ handicap: 0, score1: 208, score2: 192 })],
    });
    assert.deepEqual({
        average: summary.average,
        highScore: summary.highScore,
        gameCount: summary.gameCount,
        recentAverage: summary.recentAverage,
    }, {
        average: 203.8,
        highScore: 213,
        gameCount: 4,
        recentAverage: 203.8,
    });
});

test('no records returns zero metrics and an empty list', async () => {
    assert.deepEqual((await calculate({})).summary, { year: 2026, average: 0, highScore: 0,
        gameCount: 0, recentScores: [], recentSessions: [], recentAverage: 0 });
});

test('dashboard sessions keep sources separate and use stable official session identities', async () => {
    const { summary } = await calculate({
        score: [personal({ id: 'p1', score: 200 }), personal({ id: 'p2', score: 210 })],
        leagueMatchupIndividualScore: [league({ score1: 180, score2: 190 })],
        tournamentScore: [
            tournament({ id: 't1', gameNumber: 1, score: 170 }),
            tournament({ id: 't2', gameNumber: 2, score: 180 }),
        ],
    });
    assert.equal(summary.recentSessions.length, 3);
    assert.deepEqual(summary.recentSessions.map(session => session.source).sort(),
        ['LEAGUE', 'PERSONAL', 'TOURNAMENT']);
    assert.deepEqual(summary.recentSessions.find(session => session.source === 'LEAGUE').scores.map(s => s.score),
        [190, 200]);
    assert.deepEqual(summary.recentSessions.find(session => session.source === 'TOURNAMENT').scores.map(s => s.score),
        [175, 185]);
});

test('dashboard returns at most seven complete recent sessions', async () => {
    const { summary } = await calculate({ score: Array.from({ length: 9 }, (_, index) => personal({
        id: `session-${index}`, score: 180 + index,
        gameDate: new Date(Date.UTC(2026, 0, index + 1)),
    })) });
    assert.equal(summary.recentSessions.length, 7);
    assert.equal(summary.recentSessions[0].scores[0].score, 188);
    assert.equal(summary.recentSessions[6].scores[0].score, 182);
});

test('all three sources use UTC inclusive year bounds, not createdAt or KST year', async () => {
    const timestamps = ['2025-12-31T23:59:59.999Z', '2026-01-01T00:00:00.000Z',
        '2026-12-31T23:59:59.999Z', '2027-01-01T00:00:00.000Z'];
    const { summary } = await calculate({
        score: timestamps.map((value, i) => personal({ id: String(i), gameDate: new Date(value) })),
        leagueMatchupIndividualScore: timestamps.map((value, i) => league({ id: String(i),
            LeagueMatchup: { round: { date: new Date(value) } } })),
        tournamentScore: timestamps.map((value, i) => tournament({ id: String(i), round: { date: new Date(value) } })),
    });
    assert.equal(summary.gameCount, 6);
});

test('unrelated user IDs and null Score userId are excluded', async () => {
    const { summary } = await calculate({ score: [personal({ userId: 'other' }), personal({ userId: null })],
        leagueMatchupIndividualScore: [league({ userId: 'other', playerName: 'Unrelated' })],
        tournamentScore: [tournament({ registration: { ...tournament().registration, userId: 'other', guestName: 'Unrelated' } })] });
    assert.equal(summary.gameCount, 0);
});

test('legacy official name plus active team ID/name fallback is preserved', async () => {
    const { summary } = await calculate({ leagueMatchupIndividualScore: [
        league({ userId: null, playerName: user.name }),
        league({ id: 'same-name-team', userId: 'other', teamId: 'old-team', playerName: user.name }),
        league({ id: 'excluded', userId: null, teamId: 'foreign-team', Team: { name: 'Other' }, playerName: user.name }),
    ], tournamentScore: [tournament({ registration: { ...tournament().registration,
        userId: null, guestName: user.name, guestTeamName: 'Fixture Team' } })] });
    assert.equal(summary.gameCount, 3);
});

test('malformed/duplicate/out-of-range years rejected and missing year defaults to current year', () => {
    const { parseDashboardYear } = loadTs('src/lib/mobile-api/dashboard.ts', { '@/lib/prisma': {} });
    for (const value of ['', 'abc', '2026.0', '2026x', '1899', '2101', ' 2026', '2026&year=2025']) {
        assert.equal(parseDashboardYear(new URLSearchParams(`year=${value}`)), null);
    }
    assert.equal(parseDashboardYear(new URLSearchParams('year=2026')), 2026);
    assert.equal(parseDashboardYear(new URLSearchParams(), new Date(2025, 5, 1)), 2025);
});

test('dashboard route returns 400 envelope for invalid year and integrated 200 for valid year', async () => {
    const { db } = database({ score: [personal()] });
    const { GET } = loadTs('src/app/api/mobile/v1/dashboard/route.ts', {
        '@/lib/prisma': db, '@/lib/mobile-api/auth': { getMobileApiUserId: async () => user.id },
    });
    const invalid = await GET(new Request('https://example.test/api/mobile/v1/dashboard?year=bad'));
    assert.equal(invalid.status, 400);
    assert.equal((await invalid.json()).error.code, 'INVALID_YEAR');
    const valid = await GET(new Request('https://example.test/api/mobile/v1/dashboard?year=2026'));
    assert.equal(valid.status, 200);
    const body = await valid.json();
    assert.equal(body.success, true);
    assert.equal(body.data.year, 2026);
    assert.equal(body.data.average, 200);
    assert.equal(body.data.recentScores[0].source, 'PERSONAL');
});
