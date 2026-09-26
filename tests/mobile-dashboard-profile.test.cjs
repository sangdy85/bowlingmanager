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

const profile = loadTs('src/lib/personal-profile.ts');
const dashboard = loadTs('src/lib/mobile-api/dashboard.ts', { '@/lib/prisma': {} });
const day = (value, time = '00:00:00') => new Date(`2026-09-${String(value).padStart(2, '0')}T${time}.000Z`);
const personal = (id, score, gameDate, changes = {}) => ({
    id, source: 'PERSONAL', score, gameDate, gameType: '정기전', memo: null,
    team: { id: 'team-1', name: '팀 1' }, ...changes,
});
const teamScore = (id, teamId, userId, score, gameDate, changes = {}) => ({
    id, teamId, userId, score, gameDate, gameType: '정기전', guestName: null,
    memo: null, createdAt: gameDate, User: userId ? { name: changes.name || userId } : null,
    ...changes,
});
const member = (id, teamId, userId, name = userId) => ({ id, teamId, userId, name });
const team = (id, role, name = id) => ({
    id: `membership-${id}`, teamId: id,
    team: {
        id, name,
        ownerId: role === 'OWNER' ? 'user-a' : null,
        User: role === 'MANAGER' ? [{ id: 'user-a' }] : [],
        seasonRankingEnabled: false,
        bowlerHiddenEnabled: false,
    },
});

test('web radar helper keeps five axes and the exact web formulas', () => {
    const result = profile.calculatePersonalProfile({
        regularScores: [
            { score: 200, gameDate: day(1) }, { score: 220, gameDate: day(1) },
            { score: 230, gameDate: day(2) }, { score: 240, gameDate: day(2) },
            { score: 210, gameDate: day(3) }, { score: 215, gameDate: day(3) },
        ],
        officialSessions: [
            { scores: [200, 220] }, { scores: [240, 250] }, { scores: [210, 230] },
        ],
        allTeamRegularScores: [
            { score: 1, gameDate: day(1), teamId: 'team-1' },
            { score: 1, gameDate: day(2), teamId: 'team-1' },
            { score: 1, gameDate: day(3), teamId: 'team-1' },
            { score: 1, gameDate: day(4), teamId: 'team-1' },
        ],
    });
    assert.deepEqual(result.radar.axes.map(axis => axis.label),
        ['기량(에버)', '포텐셜', '기복', '안정감', '성실']);
    assert.equal(result.radar.series.length, 2);
    assert.deepEqual(result.radar.series[0].values, [8.516666666666666, 7, 9.833333333333334, 10, 7.5]);
    assert.deepEqual(result.radar.series[1].values, [9.1, 9, 9.333333333333334, 10, 3]);
});

test('radar handles empty and sparse data and clamps normalization boundaries', () => {
    const empty = profile.calculatePersonalProfile({
        regularScores: [], officialSessions: [], allTeamRegularScores: [],
    });
    assert.equal(empty.radar.axes.length, 5);
    assert.deepEqual(empty.radar.series, []);
    const sparse = profile.calculatePersonalProfile({
        regularScores: [{ score: 50, gameDate: day(1) }, { score: 300, gameDate: day(2) }],
        officialSessions: [{ scores: [0] }, { scores: [300] }],
        allTeamRegularScores: [],
    });
    assert.deepEqual(sparse.radar.series, []);
    const bounded = profile.calculatePersonalProfile({
        regularScores: [
            { score: 0, gameDate: day(1) }, { score: 300, gameDate: day(1) },
            { score: 0, gameDate: day(2) }, { score: 300, gameDate: day(2) },
            { score: 0, gameDate: day(3) }, { score: 300, gameDate: day(3) },
        ],
        officialSessions: [], allTeamRegularScores: [],
    });
    assert.ok(bounded.radar.series[0].values.every(value => value >= 0 && value <= 10));
});

test('dashboard medals use membership identity, KST activities and exclude fourth and non-regular', () => {
    const user = { id: 'user-a', name: '동명이인', teamMemberships: [team('team-1', 'MEMBER')] };
    const members = [
        member('membership-team-1', 'team-1', 'user-a', '별명'),
        member('member-b', 'team-1', 'user-b', '동명이인'),
        member('member-c', 'team-1', 'user-c'),
        member('member-d', 'team-1', 'user-d'),
    ];
    const scores = [];
    const totals = [400, 300, 200, 100];
    for (let index = 0; index < 4; index += 1) {
        const gameDate = day(index + 1, '01:00:00');
        scores.push(teamScore(`me-${index}`, 'team-1', 'user-a', totals[index], gameDate));
        scores.push(teamScore(`b-${index}`, 'team-1', 'user-b', index === 0 ? 300 : 400, gameDate));
        scores.push(teamScore(`c-${index}`, 'team-1', 'user-c', index < 2 ? 200 : 300, gameDate));
        scores.push(teamScore(`d-${index}`, 'team-1', 'user-d', index === 3 ? 200 : 100, gameDate));
    }
    scores.push(teamScore('guest', 'team-1', null, 500, day(1, '01:40:00'), { guestName: '별명' }));
    scores.push(teamScore('casual', 'team-1', 'user-a', 300, day(8), { gameType: '벙개' }));
    const extension = dashboard.createDashboardExtensions(user, [], [], scores, members);
    assert.deepEqual(extension.medals, { goldCount: 0, silverCount: 2, bronzeCount: 1 });
    assert.equal(JSON.stringify(extension).includes('user-b'), false);
    assert.equal(JSON.stringify(extension).includes('guest'), false);
});

test('medals join UTC boundary rows by KST date and keep teams isolated', () => {
    const user = {
        id: 'user-a', name: '볼러',
        teamMemberships: [team('team-1', 'MEMBER'), team('team-2', 'MEMBER')],
    };
    const members = [
        member('membership-team-1', 'team-1', 'user-a'),
        member('one-b', 'team-1', 'user-b'),
        member('membership-team-2', 'team-2', 'user-a'),
        member('two-b', 'team-2', 'user-b'),
    ];
    const scores = [
        teamScore('me-before', 'team-1', 'user-a', 200, new Date('2026-09-01T15:30:00Z')),
        teamScore('me-after', 'team-1', 'user-a', 200, new Date('2026-09-02T00:10:00Z')),
        teamScore('rival', 'team-1', 'user-b', 390, new Date('2026-09-02T01:00:00Z')),
        teamScore('other-me', 'team-2', 'user-a', 100, new Date('2026-09-02T01:00:00Z')),
        teamScore('other-rival', 'team-2', 'user-b', 200, new Date('2026-09-02T01:00:00Z')),
    ];
    const extension = dashboard.createDashboardExtensions(user, [], [], scores, members);
    assert.deepEqual(extension.medals, { goldCount: 1, silverCount: 1, bronzeCount: 0 });
});

test('team summaries include every active membership and role with member-only statistics', () => {
    const user = {
        id: 'user-a', name: '볼러',
        teamMemberships: [team('one', 'OWNER', '첫 팀'), team('two', 'MANAGER', '둘째 팀'), team('three', 'MEMBER', '셋째 팀')],
    };
    const members = user.teamMemberships.map(item => member(item.id, item.teamId, 'user-a'));
    const scores = [
        teamScore('one-a', 'one', 'user-a', 200, day(1)),
        teamScore('one-b', 'one', 'user-b', 180, day(1)),
        teamScore('two-a', 'two', 'user-a', 220, day(2)),
    ];
    const extension = dashboard.createDashboardExtensions(user, [], [], scores, members);
    assert.deepEqual(extension.teamSummaries.map(item => item.myRole), ['OWNER', 'MANAGER', 'MEMBER']);
    assert.deepEqual(extension.teamSummaries.map(item => item.gameCount), [1, 1, 0]);
    assert.deepEqual(extension.teamSummaries.map(item => item.average), [200, 220, 0]);
});

test('dashboard performs fixed batch loads for multiple teams and preserves legacy metrics', async () => {
    const calls = { user: 0, personal: 0, scores: 0, members: 0 };
    const user = {
        id: 'user-a', name: '볼러',
        teamMemberships: [team('one', 'OWNER'), team('two', 'MEMBER')],
    };
    const record = personal('p-1', 210, day(1));
    const result = await dashboard.getMobileDashboard('user-a', 2026, {
        findUser: async () => { calls.user += 1; return user; },
        loadPersonal: async () => {
            calls.personal += 1;
            return { integratedRecords: [record], allRecords: [record], officialRecords: [], myYearlyScores: [record] };
        },
        listTeamScores: async teamIds => { calls.scores += 1; assert.deepEqual(teamIds, ['one', 'two']); return []; },
        listTeamMembers: async teamIds => { calls.members += 1; assert.deepEqual(teamIds, ['one', 'two']); return []; },
    });
    assert.deepEqual(calls, { user: 1, personal: 1, scores: 1, members: 1 });
    assert.deepEqual(
        { average: result.average, highScore: result.highScore, gameCount: result.gameCount, recentAverage: result.recentAverage },
        { average: 210, highScore: 210, gameCount: 1, recentAverage: 210 },
    );
    assert.equal(result.recentSessions[0].activityId, '2026-09-01~REGULAR');
});

test('dashboard returns the additive next event without changing legacy metrics', async () => {
    const user = { id: 'user-a', name: '볼러', teamMemberships: [team('one', 'MEMBER')] };
    const nextEvent = {
        eventId: 'event-1', teamId: 'one', teamName: 'one', title: '정기전',
        eventType: '정기전', competitionType: null,
        dateTime: '2026-09-30T10:00:00.000Z', location: '서울 볼링장',
        attendanceStatus: 'UNANSWERED', laneMode: 'BULK', laneStatus: 'NOT_STARTED',
        assignedLane: null, hiddenEnabled: false, competitionState: null,
        individualGroup: null, teamAssignment: null, eventVoteStatus: null,
    };
    const result = await dashboard.getMobileDashboard('user-a', 2026, {
        findUser: async () => user,
        loadPersonal: async () => ({ integratedRecords: [], allRecords: [], officialRecords: [], myYearlyScores: [] }),
        listTeamScores: async () => [],
        listTeamMembers: async () => [],
        loadNextEvent: async () => nextEvent,
    });
    assert.deepEqual(result.nextEvent, nextEvent);
    assert.equal(result.gameCount, 0);
});

test('dashboard adds regular official totals and multiple club achievements without replacing legacy fields', async () => {
    const user = {
        id: 'user-a', name: '볼러',
        teamMemberships: [team('one', 'OWNER'), team('two', 'MEMBER')],
    };
    const regular = personal('regular', 200, day(1));
    const meetup = personal('meetup', 180, day(2), { gameType: '벙개' });
    const official = personal('official', 220, day(3), { source: 'LEAGUE', gameType: '상주리그' });
    const achievements = [
        { teamId: 'one', teamName: 'one', enabled: true, bowlerHiddenEnabled: false,
            seasonName: '2026', rank: 2, points: 20, gold: 1, silver: 0, bronze: 0,
            individualPoints: null, teamPoints: null, eventPoints: null },
        { teamId: 'two', teamName: 'two', enabled: true, bowlerHiddenEnabled: true,
            seasonName: 'Hidden', rank: 1, points: 30, gold: 1, silver: 0, bronze: 0,
            individualPoints: 10, teamPoints: 10, eventPoints: 10 },
    ];
    const result = await dashboard.getMobileDashboard('user-a', 2026, {
        findUser: async () => user,
        loadPersonal: async () => ({
            integratedRecords: [regular, official], allRecords: [regular, meetup, official],
            officialRecords: [official], myYearlyScores: [regular, meetup],
        }),
        listTeamScores: async () => [],
        listTeamMembers: async () => [],
        countAllGames: async () => 3,
        listClubAchievements: async () => achievements,
    });
    assert.equal(result.regularAverage, 200);
    assert.equal(result.officialAverage, 220);
    assert.equal(result.totalGameCount, 3);
    assert.deepEqual(result.clubAchievements, achievements);
    assert.equal(result.average, 210);
});
