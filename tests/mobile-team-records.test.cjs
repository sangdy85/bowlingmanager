// Run: node --test tests/mobile-team-records.test.cjs
// Synthetic in-memory fixtures only. No database or production calls.
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

const records = loadTs('src/lib/team-records.ts');
const service = loadTs('src/lib/mobile-api/team-records.ts', { '@/lib/prisma': {} });

const members = [
    { id: 'membership-a', userId: 'user-a', name: '에이스 별명' },
    { id: 'membership-b', userId: 'user-b', name: '볼러' },
];

function score(id, scoreValue, date, changes = {}) {
    return {
        id, score: scoreValue, gameDate: new Date(`${date}T03:00:00.000Z`),
        gameType: '정기전', userId: 'user-a', guestName: null, memo: null,
        createdAt: new Date(`${date}T03:00:00.000Z`), user: { name: '실명' }, ...changes,
    };
}

const fixture = [
    score('a-1', 200, '2026-01-10'),
    score('a-2', 220, '2026-01-10'),
    score('b-1', 180, '2026-01-10', { userId: 'user-b', user: { name: '볼러' } }),
    score('guest-1', 190, '2026-01-10', { userId: null, user: null, guestName: '손님' }),
    score('a-3', 210, '2026-02-11'),
    score('guest-only', 150, '2026-03-12', { userId: null, user: null, guestName: '다른 손님' }),
    score('casual', 300, '2026-04-13', { gameType: '벙개' }),
    score('other-null', 170, '2026-05-14', { gameType: null }),
    score('unknown', 250, '2026-06-15', { gameType: '연습' }),
];

test('game taxonomy matches the web filter and treats null as 기타', () => {
    assert.deepEqual(records.TEAM_GAME_TYPES, ['정기전', '벙개', '상주', '교류전', '기타']);
    assert.equal(records.normalizeTeamGameType(null), '기타');
    assert.equal(records.filterTeamRecordScores(fixture, 'OTHER').length, 1);
    assert.equal(records.filterTeamRecordScores(fixture, 'ALL').some(item => item.id === 'unknown'), false);
});

test('statistics preserve web attendance, games, totals, monthly and average rules', () => {
    const result = records.calculateTeamStatistics(fixture, members, 'REGULAR');
    assert.deepEqual(result.summary, {
        activityCount: 3,
        memberCount: 2,
        attendanceRate: 50,
        gameCount: 4,
        monthlyAverages: [200, 210, null, null, null, null, null, null, null, null, null, null],
        total: 810,
        average: 202.5,
    });
    assert.deepEqual(result.members[0], {
        id: 'membership-a', name: '에이스 별명', attendanceRate: 66.7,
        attended: 2, activityCount: 3, gameCount: 3,
        monthlyAverages: [210, 210, null, null, null, null, null, null, null, null, null, null],
        total: 630, average: 210,
    });
    assert.equal(result.members[1].attendanceRate, 33.3);
});

test('guest scores affect activity denominator and team daily average but never member rows', () => {
    const statistics = records.calculateTeamStatistics(fixture, members, 'REGULAR');
    assert.equal(statistics.summary.activityCount, 3);
    assert.equal(statistics.members.some(member => member.name.includes('손님')), false);
    const activities = records.createTeamActivities('team-1', fixture, members, 'REGULAR');
    assert.equal(activities.find(item => item.date === '2026-03-12').dailyAverage, 150);
});

test('activity grouping follows the web KST calendar date and date-only session rule', () => {
    const midnight = score('late', 200, '2026-01-10', { gameDate: new Date('2026-01-10T16:00:00Z') });
    const activities = records.createTeamActivities('team-1', [midnight], members, 'REGULAR');
    assert.equal(activities.single, undefined);
    assert.equal(activities[0].date, '2026-01-11');
    assert.equal(activities[0].id, '2026-01-11~REGULAR');
});

test('KST grouping joins different UTC dates that land on one Korean calendar date', () => {
    const scores = [
        score('before-midnight-utc', 200, '2026-09-18', { gameDate: new Date('2026-09-18T16:00:00Z') }),
        score('after-midnight-utc', 210, '2026-09-19', { gameDate: new Date('2026-09-19T14:00:00Z') }),
    ];
    const activities = records.createTeamActivities('team-1', scores, members, 'REGULAR');
    assert.equal(activities.length, 1);
    assert.equal(activities[0].date, '2026-09-19');
    assert.equal(activities[0].gameCount, 2);
});

test('KST grouping splits one UTC date when it crosses Korean midnight', () => {
    const scores = [
        score('kst-day-one', 200, '2026-09-19', { gameDate: new Date('2026-09-19T14:00:00Z') }),
        score('kst-day-two', 210, '2026-09-19', { gameDate: new Date('2026-09-19T16:00:00Z') }),
    ];
    const activities = records.createTeamActivities('team-1', scores, members, 'REGULAR');
    assert.deepEqual(activities.map(activity => activity.date), ['2026-09-20', '2026-09-19']);
});

test('ALL keeps mixed game types in one date activity while detail preserves each selected filter', () => {
    const mixed = [
        score('regular', 200, '2026-09-19'),
        score('casual', 180, '2026-09-19', { gameType: '벙개' }),
    ];
    const all = records.createTeamActivities('team-1', mixed, members, 'ALL');
    const regular = records.createTeamActivities('team-1', mixed, members, 'REGULAR');
    const casual = records.createTeamActivities('team-1', mixed, members, 'CASUAL');
    assert.equal(all.length, 1);
    assert.equal(all[0].gameCount, 2);
    assert.equal(all[0].gameType, '정기전'); // Web uses the first non-empty type as the heading.
    assert.equal(regular[0].gameCount, 1);
    assert.equal(casual[0].gameCount, 1);
    assert.equal(records.createTeamActivityDetail('team-1', '2026-09-19', mixed, members, 'REGULAR').gameCount, 1);
    assert.equal(records.createTeamActivityDetail('team-1', '2026-09-19', mixed, members, 'CASUAL').gameType, '벙개');
});

test('activity detail supports aliases, guests, variable games, totals and sequential tie ranks', () => {
    const tied = [
        score('a1', 200, '2026-07-01'), score('a2', 200, '2026-07-01'),
        score('b1', 400, '2026-07-01', { userId: 'user-b', user: { name: '볼러' } }),
        score('g1', 100, '2026-07-01', { userId: null, user: null, guestName: '손님' }),
    ];
    const detail = records.createTeamActivityDetail('team-1', '2026-07-01', tied, members, 'REGULAR');
    assert.equal(detail.participantCount, 3);
    assert.deepEqual(detail.participants.map(item => ({ rank: item.rank, name: item.name, scores: item.scores, total: item.total })), [
        { rank: 1, name: '에이스 별명', scores: [200, 200], total: 400 },
        { rank: 2, name: '볼러', scores: [400], total: 400 },
        { rank: 3, name: '손님(비)', scores: [100], total: 100 },
    ]);
    assert.equal(detail.participants[0].id, 'membership-a');
    assert.equal(detail.participants[2].id.includes('손님'), false);
});

test('activity ids reject malformed values and preserve the filter', () => {
    assert.deepEqual(records.parseTeamActivityId('2026-09-19~INTERCLUB'), {
        date: '2026-09-19', filter: 'INTERCLUB',
    });
    assert.equal(records.parseTeamActivityId('2026-02-30~REGULAR'), null);
    assert.equal(records.parseTeamActivityId('2026-09-19~INVALID'), null);
});

test('activity and opaque participant ids are deterministic, distinct and hide internal ids', () => {
    assert.equal(
        records.createTeamActivityId('2026-09-19', 'REGULAR'),
        records.createTeamActivityId('2026-09-19', 'REGULAR'),
    );
    assert.notEqual(
        records.createTeamActivityId('2026-09-19', 'REGULAR'),
        records.createTeamActivityId('2026-09-19', 'CASUAL'),
    );
    const formerAndGuests = [
        score('former-a', 200, '2026-09-19', { userId: 'internal-user-a', user: { name: '탈퇴 A' } }),
        score('former-b', 190, '2026-09-19', { userId: 'internal-user-b', user: { name: '탈퇴 B' } }),
        score('guest-a', 180, '2026-09-19', { userId: null, user: null, guestName: '손님 A' }),
        score('guest-b', 170, '2026-09-19', { userId: null, user: null, guestName: '손님 B' }),
    ];
    const first = records.createTeamActivityDetail('team-1', '2026-09-19', formerAndGuests, [], 'REGULAR');
    const second = records.createTeamActivityDetail('team-1', '2026-09-19', formerAndGuests, [], 'REGULAR');
    const ids = first.participants.map(participant => participant.id);
    assert.equal(new Set(ids).size, 4);
    assert.deepEqual(ids, second.participants.map(participant => participant.id));
    assert.equal(ids.some(id => id.includes('internal-user') || id.includes('former-a')), false);
});

test('team attendance averages raw member ratios before rounding like the web', () => {
    const scores = [];
    for (let day = 1; day <= 7; day += 1) {
        scores.push(score(`guest-${day}`, 100, `2026-08-0${day}`, { userId: null, user: null, guestName: `손님${day}` }));
    }
    scores.push(score('member-a', 200, '2026-08-01'));
    scores.push(score('member-b-1', 200, '2026-08-01', { userId: 'user-b', user: { name: '볼러' } }));
    scores.push(score('member-b-2', 200, '2026-08-02', { userId: 'user-b', user: { name: '볼러' } }));
    const result = records.calculateTeamStatistics(scores, members, 'REGULAR');
    assert.deepEqual(result.members.map(member => member.attendanceRate), [28.6, 14.3]);
    assert.equal(result.summary.attendanceRate, 21.4);
});

function dependencies(changes = {}) {
    return {
        findAccessibleTeam: async () => ({ id: 'team-1' }),
        listMembers: async () => members.map(member => ({
            id: member.id, userId: member.userId, alias: member.name,
            user: { name: `${member.name} 실명` },
        })),
        listScores: async () => fixture.map(({ user, ...item }) => ({ ...item, User: user })),
        listScoreDates: async () => [{ gameDate: new Date('2024-01-01') }, { gameDate: new Date('2026-01-01') }],
        ...changes,
    };
}

test('statistics service enforces membership before any record query', async () => {
    let recordQueries = 0;
    const result = await service.getMobileTeamStatistics('outsider', 'team-1', { year: 2026, filter: 'REGULAR' }, dependencies({
        findAccessibleTeam: async () => null,
        listScores: async () => { recordQueries += 1; return []; },
    }));
    assert.equal(result, null);
    assert.equal(recordQueries, 0);
});

test('member, manager and owner use the same active-membership read policy', async () => {
    for (const userId of ['member', 'manager', 'owner']) {
        const result = await service.getMobileTeamStatistics(userId, 'team-1', { year: 2026, filter: 'REGULAR' }, dependencies({
            findAccessibleTeam: async candidate => ['member', 'manager', 'owner'].includes(candidate) ? { id: 'team-1' } : null,
        }));
        assert.notEqual(result, null);
    }
    const inactive = await service.getMobileTeamStatistics('member', 'team-1', { year: 2026, filter: 'REGULAR' }, dependencies({
        findAccessibleTeam: async () => null,
    }));
    assert.equal(inactive, null);
});

test('year statistics queries members, scores and year dates once without member N+1 calls', async () => {
    const calls = { members: 0, scores: 0, dates: 0 };
    await service.getMobileTeamStatistics('user-a', 'team-1', { year: 2026, filter: 'REGULAR' }, dependencies({
        listMembers: async () => { calls.members += 1; return []; },
        listScores: async () => { calls.scores += 1; return []; },
        listScoreDates: async () => { calls.dates += 1; return []; },
    }));
    assert.deepEqual(calls, { members: 1, scores: 1, dates: 1 });
});

test('statistics service returns active years and empty years safely', async () => {
    const result = await service.getMobileTeamStatistics('user-a', 'team-1', { year: 2025, filter: 'REGULAR' }, dependencies({
        listScores: async () => [],
    }));
    assert.deepEqual(result.availableYears, [2025, 2026, 2024]);
    assert.equal(result.summary.gameCount, 0);
    assert.deepEqual(result.members, []);
});

test('activities paginate complete date groups in latest order', async () => {
    const result = await service.getMobileTeamActivities('user-a', 'team-1', { year: 2026, filter: 'REGULAR' }, 2, 1, dependencies());
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].date, '2026-02-11');
    assert.deepEqual(result.pagination, { page: 2, limit: 1, total: 3, totalPages: 3 });
});

test('expanded feed applies multi-type OR filters and splits same KST date by game type', () => {
    const mixed = [
        score('regular-a', 200, '2026-09-19'),
        score('regular-b', 210, '2026-09-19', { userId: 'user-b', user: { name: '볼러' } }),
        score('casual-a', 180, '2026-09-19', { gameType: '벙개' }),
        score('house-a', 190, '2026-09-19', { gameType: '상주' }),
    ];
    const feed = records.createTeamActivityFeed('team-1', mixed, members, ['REGULAR', 'CASUAL']);
    assert.deepEqual(feed.map(item => ({ id: item.id, gameType: item.gameType })), [
        { id: '2026-09-19~REGULAR', gameType: '정기전' },
        { id: '2026-09-19~CASUAL', gameType: '벙개' },
    ]);
    assert.deepEqual(feed[0].participants.map(item => item.rank), [1, 2]);
    assert.equal(feed.some(item => item.gameType === '상주'), false);
});

test('expanded feed preserves aliases, guests, complete variable games, totals and averages', () => {
    const mixed = [
        score('a1', 200, '2026-09-19'),
        score('a2', 220, '2026-09-19'),
        score('b1', 210, '2026-09-19', { userId: 'user-b', user: { name: '볼러' } }),
        score('guest', 180, '2026-09-19', { userId: null, user: null, guestName: '손님' }),
    ];
    const [activity] = records.createTeamActivityFeed('team-1', mixed, members, ['REGULAR']);
    assert.deepEqual(activity.participants.map(item => ({
        name: item.name, scores: item.scores, total: item.total, average: item.average,
    })), [
        { name: '에이스 별명', scores: [200, 220], total: 420, average: 210 },
        { name: '볼러', scores: [210], total: 210, average: 210 },
        { name: '손님(비)', scores: [180], total: 180, average: 180 },
    ]);
    assert.equal(JSON.stringify(activity).includes('user-a'), false);
});

test('feed query accepts comma and repeated types, normalizes taxonomy order and rejects invalid values', () => {
    assert.deepEqual(
        service.parseTeamActivityFeedQuery(new URLSearchParams('year=2026&types=CASUAL,REGULAR&types=HOUSE')),
        { year: 2026, types: ['REGULAR', 'CASUAL', 'HOUSE'] },
    );
    assert.deepEqual(
        service.parseTeamActivityFeedQuery(new URLSearchParams('year=2026')),
        { year: 2026, types: ['REGULAR', 'CASUAL', 'HOUSE'] },
    );
    assert.equal(service.parseTeamActivityFeedQuery(new URLSearchParams('year=2026&types=ALL')), null);
    assert.equal(service.parseTeamActivityFeedQuery(new URLSearchParams('year=2026&types=LEAGUE')), null);
});

test('expanded feed paginates complete activities, exposes only membership identity and computes manager permission', async () => {
    const calls = { members: 0, scores: 0 };
    const result = await service.getMobileTeamActivityFeed(
        'user-a', 'team-1', { year: 2026, types: ['REGULAR', 'CASUAL'] }, 2, 1,
        dependencies({
            findAccessibleTeam: async () => ({ id: 'team-1', ownerId: null, User: [{ id: 'user-a' }] }),
            listMembers: async () => { calls.members += 1; return members.map(member => ({
                id: member.id, userId: member.userId, alias: member.name, user: { name: member.name },
            })); },
            listScores: async () => { calls.scores += 1; return fixture.map(({ user, ...item }) => ({ ...item, User: user })); },
        }),
    );
    assert.deepEqual(calls, { members: 1, scores: 1 });
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].canManage, true);
    assert.equal(result.currentMemberId, 'membership-a');
    assert.deepEqual(result.pagination, { page: 2, limit: 1, total: 4, totalPages: 4 });
    const serialized = JSON.stringify(result);
    assert.equal(serialized.includes('user-a'), false);
    assert.equal(serialized.includes('email'), false);
});

test('expanded feed blocks outsiders before member and score queries and members cannot manage', async () => {
    let queries = 0;
    const blocked = await service.getMobileTeamActivityFeed(
        'outsider', 'team-1', { year: 2026, types: ['REGULAR'] }, 1, 10,
        dependencies({
            findAccessibleTeam: async () => null,
            listMembers: async () => { queries += 1; return []; },
            listScores: async () => { queries += 1; return []; },
        }),
    );
    assert.equal(blocked, null);
    assert.equal(queries, 0);
    const member = await service.getMobileTeamActivityFeed(
        'user-a', 'team-1', { year: 2026, types: ['REGULAR'] }, 1, 10,
        dependencies({ findAccessibleTeam: async () => ({ id: 'team-1', ownerId: 'other', User: [] }) }),
    );
    assert.equal(member.items.every(item => item.canManage === false), true);

    const owner = await service.getMobileTeamActivityFeed(
        'user-a', 'team-1', { year: 2026, types: ['REGULAR'] }, 1, 10,
        dependencies({ findAccessibleTeam: async () => ({ id: 'team-1', ownerId: 'user-a', User: [] }) }),
    );
    assert.equal(owner.items.every(item => item.canManage === true), true);
});

test('activity detail distinguishes invalid, inaccessible, missing and found records', async () => {
    assert.equal((await service.getMobileTeamActivityDetail('user-a', 'team-1', 'bad', dependencies())).kind, 'INVALID_ACTIVITY');
    assert.equal((await service.getMobileTeamActivityDetail('outsider', 'team-1', '2026-01-10~REGULAR', dependencies({ findAccessibleTeam: async () => null }))).kind, 'TEAM_NOT_FOUND');
    assert.equal((await service.getMobileTeamActivityDetail('user-a', 'team-1', '2026-08-01~REGULAR', dependencies({ listScores: async () => [] }))).kind, 'ACTIVITY_NOT_FOUND');
    const found = await service.getMobileTeamActivityDetail('user-a', 'team-1', '2026-01-10~REGULAR', dependencies());
    assert.equal(found.kind, 'FOUND');
    assert.equal(found.activity.participantCount, 3);
    const serialized = JSON.stringify(found.activity);
    assert.equal(serialized.includes('user-a'), false);
    assert.equal(serialized.includes('email'), false);
});

test('query and pagination parsing are strict and bounded', () => {
    assert.deepEqual(service.parseTeamRecordsQuery(new URLSearchParams('year=2026&type=HOUSE')), { year: 2026, filter: 'HOUSE' });
    assert.equal(service.parseTeamRecordsQuery(new URLSearchParams('year=x&type=HOUSE')), null);
    assert.equal(service.parseTeamRecordsQuery(new URLSearchParams('year=2026&type=bad')), null);
    assert.deepEqual(service.parseTeamActivitiesPagination(new URLSearchParams('page=2&limit=999')), { page: 2, limit: 100 });
    assert.equal(service.parseTeamActivitiesPagination(new URLSearchParams('page=0')), null);
});

function routeOverrides(result, userId = 'user-a') {
    return {
        '@/lib/mobile-api/auth': { getMobileApiUserId: async () => userId },
        '@/lib/mobile-api/team-records': result,
    };
}

const context = { params: Promise.resolve({ teamId: 'team-1', activityId: '2026-01-10~REGULAR' }) };

test('statistics route requires auth, validates query and hides inaccessible teams', async () => {
    let route = loadTs('src/app/api/mobile/v1/teams/[teamId]/statistics/route.ts', routeOverrides({}, null));
    assert.equal((await route.GET(new Request('https://example.test?year=2026'), context)).status, 401);
    route = loadTs('src/app/api/mobile/v1/teams/[teamId]/statistics/route.ts', routeOverrides({
        parseTeamRecordsQuery: () => null,
    }));
    assert.equal((await route.GET(new Request('https://example.test?year=x'), context)).status, 400);
    route = loadTs('src/app/api/mobile/v1/teams/[teamId]/statistics/route.ts', routeOverrides({
        parseTeamRecordsQuery: () => ({ year: 2026, filter: 'REGULAR' }),
        getMobileTeamStatistics: async () => null,
    }));
    assert.equal((await route.GET(new Request('https://example.test?year=2026'), context)).status, 404);
});

test('activities and detail routes return the standard success envelopes', async () => {
    let route = loadTs('src/app/api/mobile/v1/teams/[teamId]/activities/route.ts', routeOverrides({
        parseTeamRecordsQuery: () => ({ year: 2026, filter: 'REGULAR' }),
        parseTeamActivitiesPagination: () => ({ page: 1, limit: 20 }),
        getMobileTeamActivities: async () => ({ items: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } }),
    }));
    let response = await route.GET(new Request('https://example.test'), context);
    assert.deepEqual(await response.json(), { success: true, data: { items: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } } });

    route = loadTs('src/app/api/mobile/v1/teams/[teamId]/activities/[activityId]/route.ts', routeOverrides({
        getMobileTeamActivityDetail: async () => ({ kind: 'FOUND', activity: { id: 'activity-1' } }),
    }));
    response = await route.GET(new Request('https://example.test'), context);
    assert.deepEqual(await response.json(), { success: true, data: { activity: { id: 'activity-1' } } });
});

test('expanded feed route authenticates, validates and returns the standard envelope', async () => {
    let route = loadTs('src/app/api/mobile/v1/teams/[teamId]/activities/feed/route.ts', routeOverrides({}, null));
    assert.equal((await route.GET(new Request('https://example.test'), context)).status, 401);
    route = loadTs('src/app/api/mobile/v1/teams/[teamId]/activities/feed/route.ts', routeOverrides({
        parseTeamActivityFeedQuery: () => null,
        parseTeamActivitiesPagination: () => ({ page: 1, limit: 10 }),
    }));
    assert.equal((await route.GET(new Request('https://example.test'), context)).status, 400);
    route = loadTs('src/app/api/mobile/v1/teams/[teamId]/activities/feed/route.ts', routeOverrides({
        parseTeamActivityFeedQuery: () => ({ year: 2026, types: ['REGULAR'] }),
        parseTeamActivitiesPagination: () => ({ page: 1, limit: 10 }),
        getMobileTeamActivityFeed: async () => ({ items: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } }),
    }));
    const response = await route.GET(new Request('https://example.test'), context);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).success, true);
});

test('mobile helper output matches the legacy web calculation fixture', () => {
    const webExpected = {
        memberNames: ['에이스 별명', '볼러'],
        attendance: ['66.7% (2/3)', '33.3% (1/3)'],
        games: [3, 1], totals: [630, 180], averages: ['210.0', '180.0'],
    };
    const mobile = records.calculateTeamStatistics(fixture, members, 'REGULAR').members;
    assert.deepEqual(mobile.map(row => row.name), webExpected.memberNames);
    assert.deepEqual(mobile.map(row => `${row.attendanceRate.toFixed(1)}% (${row.attended}/${row.activityCount})`), webExpected.attendance);
    assert.deepEqual(mobile.map(row => row.gameCount), webExpected.games);
    assert.deepEqual(mobile.map(row => row.total), webExpected.totals);
    assert.deepEqual(mobile.map(row => row.average.toFixed(1)), webExpected.averages);
});
