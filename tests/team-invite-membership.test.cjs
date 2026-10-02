// Run: node --test tests/team-invite-membership.test.cjs
// Synthetic fixtures only. No database or production calls.
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

const membership = loadTs('src/lib/team-membership.ts', { '@/lib/prisma': {} });

function fixtureDependencies(changes = {}) {
  const events = [];
  return {
    events,
    findTeamByCode: async code => ({
      id: 'team-1', name: 'Fixture Club', isActive: true, ownerId: 'owner-1',
      User: [{ id: 'manager-1' }], _count: { members: 2 }, code,
    }),
    findMembership: async () => null,
    findUserName: async () => '김볼러',
    listSameNameMembers: async () => [],
    updateMemberAlias: async (id, alias) => events.push(['alias', id, alias]),
    createMembership: async (userId, teamId, alias) => events.push(['create', userId, teamId, alias]),
    migrateUserRecords: async (userId, teamId) => events.push(['migrate', userId, teamId]),
    ...changes,
  };
}

test('team code normalization is bounded to the existing six-character format', () => {
  assert.equal(membership.normalizeTeamCode(' a1b2c3 '), 'A1B2C3');
  for (const invalid of [null, '', 'A1B2', 'A1B2C3D', 'A1-2C3', '<script>']) {
    assert.equal(membership.normalizeTeamCode(invalid), null);
  }
});

test('normal join creates membership then preserves personal-record migration', async () => {
  const deps = fixtureDependencies();
  const result = await membership.joinTeamByCode({ userId: 'user-1', code: ' test01 ' }, deps);
  assert.equal(result.status, 'JOINED');
  assert.deepEqual(result.team, { id: 'team-1', name: 'Fixture Club', myRole: 'MEMBER', memberCount: 3 });
  assert.deepEqual(deps.events, [
    ['create', 'user-1', 'team-1', null],
    ['migrate', 'user-1', 'team-1'],
  ]);
});

test('existing membership is distinguishable and does not mutate records', async () => {
  const deps = fixtureDependencies({ findMembership: async () => ({ id: 'membership-1' }) });
  const result = await membership.joinTeamByCode({ userId: 'user-1', code: 'TEST01' }, deps);
  assert.equal(result.status, 'ALREADY_MEMBER');
  assert.deepEqual(deps.events, []);
});

test('missing and inactive teams are rejected without membership writes', async () => {
  let deps = fixtureDependencies({ findTeamByCode: async () => null });
  assert.equal((await membership.joinTeamByCode({ userId: 'user-1', code: 'TEST01' }, deps)).status, 'TEAM_NOT_FOUND');
  deps = fixtureDependencies({ findTeamByCode: async code => ({ id: 'team-1', name: 'x', code, isActive: false, ownerId: null, User: [], _count: { members: 0 } }) });
  assert.equal((await membership.joinTeamByCode({ userId: 'user-1', code: 'TEST01' }, deps)).status, 'TEAM_INACTIVE');
  assert.deepEqual(deps.events, []);
});

test('alias collision updates only same-name members and aliases the new member', async () => {
  const deps = fixtureDependencies({
    listSameNameMembers: async () => [{ id: 'same-1', alias: null }, { id: 'same-2', alias: '김볼러 B' }],
  });
  await membership.joinTeamByCode({ userId: 'new-user', code: 'TEST01' }, deps);
  assert.deepEqual(deps.events, [
    ['alias', 'same-1', '김볼러 A'],
    ['create', 'new-user', 'team-1', '김볼러 C'],
    ['migrate', 'new-user', 'team-1'],
  ]);
  assert.equal(JSON.stringify(deps.events).includes('other-member'), false);
});

test('public invite lookup returns safe display fields and normalized code only', async () => {
  let seen;
  const result = await membership.getPublicTeamInvite(' test01 ', {
    findActiveTeam: async code => { seen = code; return { name: '초대 동호회', _count: { members: 7 } }; },
  });
  assert.equal(seen, 'TEST01');
  assert.deepEqual(result, { code: 'TEST01', name: '초대 동호회', memberCount: 7 });
  assert.deepEqual(await membership.getPublicTeamInvite('bad', { findActiveTeam: async () => { throw new Error('must not query'); } }), null);
});

function loadJoinRoute({ userId = 'user-1', result } = {}) {
  return loadTs('src/app/api/mobile/v1/teams/join/route.ts', {
    '@/lib/mobile-api/auth': { getMobileApiUserId: async () => userId },
    '@/lib/team-membership': {
      joinTeamByCode: async input => result ?? ({
        status: 'JOINED',
        team: { id: 'team-1', name: 'Fixture Club', myRole: 'MEMBER', memberCount: 3 },
        input,
      }),
    },
  });
}

function post(body) {
  return new Request('https://example.test/api/mobile/v1/teams/join', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body,
  });
}

test('mobile join API requires auth and rejects missing or malformed bodies', async () => {
  assert.equal((await loadJoinRoute({ userId: null }).POST(post('{}'))).status, 401);
  assert.equal((await loadJoinRoute().POST(post(''))).status, 400);
  assert.equal((await loadJoinRoute({ result: { status: 'INVALID_CODE' } }).POST(post('{}'))).status, 400);
});

test('mobile join API returns joined and already-member outcomes without private fields', async () => {
  let response = await loadJoinRoute().POST(post(JSON.stringify({ code: ' test01 ' })));
  assert.equal(response.status, 200);
  let body = await response.json();
  assert.equal(body.data.joined, true);
  assert.equal(body.data.alreadyMember, false);
  assert.equal(JSON.stringify(body).includes('email'), false);

  response = await loadJoinRoute({
    result: { status: 'ALREADY_MEMBER', team: { id: 'team-1', name: 'Fixture Club', myRole: 'MEMBER', memberCount: 3 } },
  }).POST(post(JSON.stringify({ code: 'TEST01' })));
  body = await response.json();
  assert.equal(body.data.joined, false);
  assert.equal(body.data.alreadyMember, true);
});

test('invite page is dynamic, noindex/nofollow, absent from sitemap, and prefill is normalized', () => {
  const invitePage = fs.readFileSync(path.resolve(__dirname, '../src/app/invite/team/[code]/page.tsx'), 'utf8');
  const joinPage = fs.readFileSync(path.resolve(__dirname, '../src/app/team/join/page.tsx'), 'utf8');
  const sitemap = fs.readFileSync(path.resolve(__dirname, '../src/app/sitemap.ts'), 'utf8');
  assert.match(invitePage, /index:\s*false,\s*follow:\s*false/);
  assert.match(invitePage, /force-dynamic/);
  assert.match(invitePage, /getPublicTeamInvite/);
  assert.doesNotMatch(sitemap, /invite\/team/);
  assert.match(joinPage, /normalizeTeamCode/);
  assert.match(joinPage, /initialCode/);
});
