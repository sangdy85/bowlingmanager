// Run: node --test tests/mobile-teams.test.cjs
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

function team(changes = {}) {
    return {
        id: 'team-1', name: 'Fixture Club', ownerId: 'owner-1',
        User: [{ id: 'manager-1' }], _count: { members: 3 }, ...changes,
    };
}

function dependencies(changes = {}) {
    return {
        listMemberships: async () => [{ team: team() }],
        findAccessibleTeam: async () => team(),
        listMembers: async () => [
            { id: 'membership-member', userId: 'member-1', alias: null, user: { name: '회원', handicap: null } },
            { id: 'membership-owner', userId: 'owner-1', alias: '팀장 별명', user: { name: '팀장', handicap: 12 } },
            { id: 'membership-manager', userId: 'manager-1', alias: null, user: { name: '매니저', handicap: 8 } },
        ],
        ...changes,
    };
}

const teams = loadTs('src/lib/mobile-api/teams.ts', { '@/lib/prisma': {} });

test('team list returns one or multiple active memberships with current roles', async () => {
    const result = await teams.listMobileTeams('owner-1', dependencies({
        listMemberships: async () => [
            { team: team({ User: [{ id: 'manager-1' }, { id: 'owner-1' }] }) },
            { team: team({ id: 'team-2', name: 'Second Club', ownerId: 'other', User: [{ id: 'owner-1' }], _count: { members: 5 } }) },
        ],
    }));
    assert.deepEqual(result, [
        { id: 'team-1', name: 'Fixture Club', myRole: 'OWNER', memberCount: 3 },
        { id: 'team-2', name: 'Second Club', myRole: 'MANAGER', memberCount: 5 },
    ]);
});

test('team list supports a user with no memberships', async () => {
    const result = await teams.listMobileTeams('user-1', dependencies({ listMemberships: async () => [] }));
    assert.deepEqual(result, []);
});

test('default team list query uses TeamMember and excludes inactive teams', async () => {
    let query;
    const service = loadTs('src/lib/mobile-api/teams.ts', {
        '@/lib/prisma': {
            teamMember: { findMany: async args => { query = args; return []; } },
            team: { findFirst: async () => null },
        },
    });
    await service.listMobileTeams('user-1');
    assert.deepEqual(query.where, { userId: 'user-1', team: { isActive: true } });
    assert.deepEqual(query.orderBy, [{ joinedAt: 'asc' }, { id: 'asc' }]);
});

test('detail requires an active membership and supports an ordinary member', async () => {
    const seen = [];
    const result = await teams.getMobileTeamDetail('member-1', 'team-1', dependencies({
        findAccessibleTeam: async (userId, teamId) => {
            seen.push({ userId, teamId });
            return team();
        },
    }));
    assert.deepEqual(seen, [{ userId: 'member-1', teamId: 'team-1' }]);
    assert.deepEqual(result, { id: 'team-1', name: 'Fixture Club', myRole: 'MEMBER', memberCount: 3 });
});

test('detail hides missing teams and teams belonging to another user', async () => {
    const result = await teams.getMobileTeamDetail('outsider', 'other-team', dependencies({
        findAccessibleTeam: async () => null,
    }));
    assert.equal(result, null);
});

test('detail hides other active teams, inactive memberships and owners without membership', async () => {
    for (const scenario of ['other-active-team', 'inactive-team', 'owner-without-membership']) {
        let lookups = 0;
        const result = await teams.getMobileTeamDetail('user-1', scenario, dependencies({
            findAccessibleTeam: async () => { lookups += 1; return null; },
        }));
        assert.equal(result, null, scenario);
        assert.equal(lookups, 1, scenario);
    }
});

test('default detail query enforces active team membership server-side', async () => {
    let query;
    const service = loadTs('src/lib/mobile-api/teams.ts', {
        '@/lib/prisma': {
            teamMember: { findMany: async () => [] },
            team: { findFirst: async args => { query = args; return null; } },
        },
    });
    await service.getMobileTeamDetail('user-1', 'team-1');
    assert.deepEqual(query.where, {
        id: 'team-1', isActive: true, members: { some: { userId: 'user-1' } },
    });
});

test('member list exposes display name, role and nullable handicap only', async () => {
    const result = await teams.listMobileTeamMembers('member-1', 'team-1', dependencies());
    assert.deepEqual(result, [
        { id: 'membership-manager', name: '매니저', role: 'MANAGER', handicap: 8 },
        { id: 'membership-owner', name: '팀장 별명', role: 'OWNER', handicap: 12 },
        { id: 'membership-member', name: '회원', role: 'MEMBER', handicap: null },
    ]);
    assert.equal(JSON.stringify(result).includes('email'), false);
    assert.equal(JSON.stringify(result).includes('userId'), false);
    for (const member of result) {
        assert.deepEqual(Object.keys(member).sort(), ['handicap', 'id', 'name', 'role']);
    }
});

test('member display names retain the web alias fallback policy', async () => {
    const result = await teams.listMobileTeamMembers('member-1', 'team-1', dependencies({
        listMembers: async () => [
            { id: 'null-alias', userId: 'member-1', alias: null, user: { name: '기본 이름', handicap: null } },
            { id: 'empty-alias', userId: 'member-2', alias: '', user: { name: '빈 별명 대체', handicap: null } },
            { id: 'space-alias', userId: 'member-3', alias: '   ', user: { name: '공백 별명', handicap: null } },
        ],
    }));
    assert.deepEqual(result.map(member => member.name), ['   ', '기본 이름', '빈 별명 대체']);
});

test('default member query uses deterministic joined order before response sorting', async () => {
    let query;
    const service = loadTs('src/lib/mobile-api/teams.ts', {
        '@/lib/prisma': {
            team: { findFirst: async () => team() },
            teamMember: { findMany: async args => { query = args; return []; } },
        },
    });
    assert.deepEqual(await service.listMobileTeamMembers('user-1', 'team-1'), []);
    assert.deepEqual(query.where, { teamId: 'team-1' });
    assert.deepEqual(query.orderBy, [{ joinedAt: 'asc' }, { id: 'asc' }]);
});

test('member list never runs the member query for an inaccessible team', async () => {
    let memberQueries = 0;
    const result = await teams.listMobileTeamMembers('outsider', 'team-1', dependencies({
        findAccessibleTeam: async () => null,
        listMembers: async () => { memberQueries += 1; return []; },
    }));
    assert.equal(result, null);
    assert.equal(memberQueries, 0);
});

function loadListRoute({ userId = 'user-1', result = [] } = {}) {
    return loadTs('src/app/api/mobile/v1/teams/route.ts', {
        '@/lib/mobile-api/auth': { getMobileApiUserId: async () => userId },
        '@/lib/mobile-api/teams': { listMobileTeams: async () => result },
    });
}

function loadDetailRoute({ userId = 'user-1', result = null } = {}) {
    return loadTs('src/app/api/mobile/v1/teams/[teamId]/route.ts', {
        '@/lib/mobile-api/auth': { getMobileApiUserId: async () => userId },
        '@/lib/mobile-api/teams': { getMobileTeamDetail: async () => result },
    });
}

function loadMembersRoute({ userId = 'user-1', result = null } = {}) {
    return loadTs('src/app/api/mobile/v1/teams/[teamId]/members/route.ts', {
        '@/lib/mobile-api/auth': { getMobileApiUserId: async () => userId },
        '@/lib/mobile-api/teams': { listMobileTeamMembers: async () => result },
    });
}

const request = new Request('https://example.test/api/mobile/v1/teams');
const context = { params: Promise.resolve({ teamId: 'team-1' }) };

test('team list route requires authentication and returns an empty list', async () => {
    assert.equal((await loadListRoute({ userId: null }).GET(request)).status, 401);
    const response = await loadListRoute().GET(request);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { success: true, data: { teams: [] } });
});

test('team detail route returns data for a member and 404 for inaccessible IDs', async () => {
    let route = loadDetailRoute({ result: { id: 'team-1', name: 'Fixture Club', myRole: 'MEMBER', memberCount: 3 } });
    let response = await route.GET(request, context);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).data.team.myRole, 'MEMBER');

    route = loadDetailRoute({ result: null });
    response = await route.GET(request, context);
    assert.equal(response.status, 404);
    assert.equal((await response.json()).error.code, 'TEAM_NOT_FOUND');
});

test('team detail route requires authentication', async () => {
    const response = await loadDetailRoute({ userId: null }).GET(request, context);
    assert.equal(response.status, 401);
});

test('team members route requires authentication and hides inaccessible teams', async () => {
    assert.equal((await loadMembersRoute({ userId: null }).GET(request, context)).status, 401);
    const response = await loadMembersRoute({ result: null }).GET(request, context);
    assert.equal(response.status, 404);
    assert.equal((await response.json()).error.code, 'TEAM_NOT_FOUND');
});

test('team members route returns roles and nullable handicap without private fields', async () => {
    const members = [{ id: 'membership-1', name: '회원', role: 'MEMBER', handicap: null }];
    const response = await loadMembersRoute({ result: members }).GET(request, context);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body, { success: true, data: { members } });
    assert.equal(JSON.stringify(body).includes('email'), false);
});

test('invalid Bearer credentials never fall back to a valid web session', async () => {
    let sessionCalls = 0;
    const mobileAuth = loadTs('src/lib/mobile-api/auth.ts', {
        '@/auth': {
            auth: async () => {
                sessionCalls += 1;
                return { user: { id: 'web-session-user' } };
            },
        },
        '@/lib/mobile-api/token': { verifyMobileAccessToken: () => null },
    });

    const invalidBearer = new Request('https://example.test/api/mobile/v1/teams', {
        headers: { Authorization: 'Bearer invalid-token' },
    });
    assert.equal(await mobileAuth.getMobileApiUserId(invalidBearer), null);
    assert.equal(sessionCalls, 0);

    assert.equal(
        await mobileAuth.getMobileApiUserId(new Request('https://example.test/api/mobile/v1/teams')),
        'web-session-user',
    );
    assert.equal(sessionCalls, 1);
});
