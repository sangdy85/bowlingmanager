// Run: node --test tests/mobile-super-admin.test.cjs
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

const service = loadTs('src/lib/mobile-api/super-admin.ts', { '@/lib/prisma': {} });
const team = (changes = {}) => ({
  id: 'team-1', name: '테스트 동호회', code: 'TEST01',
  bowlerHiddenEnabled: false, seasonRankingEnabled: true, ...changes,
});
const dependencies = (changes = {}) => ({
  findUserRole: async () => ({ role: 'SUPER_ADMIN' }),
  listTeams: async () => [team()],
  findTeam: async () => team(),
  updateBowlerHidden: async (teamId, enabled) => team({ id: teamId, bowlerHiddenEnabled: enabled }),
  ...changes,
});

test('SUPER_ADMIN can list teams and toggle activation without team membership', async () => {
  const seen = [];
  const deps = dependencies({
    findUserRole: async userId => { seen.push(['role', userId]); return { role: 'SUPER_ADMIN' }; },
    updateBowlerHidden: async (teamId, enabled) => {
      seen.push(['update', teamId, enabled]);
      return team({ bowlerHiddenEnabled: enabled });
    },
  });
  assert.deepEqual(await service.listMobileSuperAdminTeams('admin-1', deps), [team()]);
  const updated = await service.setMobileTeamBowlerHiddenEnabled('admin-1', 'team-1', true, deps);
  assert.equal(updated.bowlerHiddenEnabled, true);
  assert.deepEqual(seen, [
    ['role', 'admin-1'],
    ['role', 'admin-1'],
    ['update', 'team-1', true],
  ]);
});

for (const role of ['OWNER', 'MANAGER', 'MEMBER', 'OUTSIDER', 'USER']) {
  test(`${role} cannot list or mutate Bowler Hidden activation`, async () => {
    let reads = 0;
    let updates = 0;
    const deps = dependencies({
      findUserRole: async () => ({ role }),
      listTeams: async () => { reads += 1; return []; },
      findTeam: async () => { reads += 1; return team(); },
      updateBowlerHidden: async () => { updates += 1; return team(); },
    });
    await assert.rejects(
      () => service.listMobileSuperAdminTeams('actor', deps),
      error => error.code === 'FORBIDDEN' && error.status === 403,
    );
    await assert.rejects(
      () => service.setMobileTeamBowlerHiddenEnabled('actor', 'team-1', true, deps),
      error => error.code === 'FORBIDDEN' && error.status === 403,
    );
    assert.equal(reads, 0);
    assert.equal(updates, 0);
  });
}

test('current database role is checked on every request and inactive teams are not mutated', async () => {
  let updates = 0;
  const deps = dependencies({
    findUserRole: async () => ({ role: 'SUPER_ADMIN' }),
    findTeam: async () => null,
    updateBowlerHidden: async () => { updates += 1; return team(); },
  });
  await assert.rejects(
    () => service.setMobileTeamBowlerHiddenEnabled('admin', 'missing', true, deps),
    error => error.code === 'TEAM_NOT_FOUND' && error.status === 404,
  );
  assert.equal(updates, 0);
});

function loadToggleRoute({ userId = 'admin-1', mutate } = {}) {
  return loadTs('src/app/api/mobile/v1/admin/teams/[teamId]/bowler-hidden/route.ts', {
    '@/lib/mobile-api/auth': { getMobileApiUserId: async () => userId },
    '@/lib/mobile-api/super-admin': {
      MobileSuperAdminError: service.MobileSuperAdminError,
      setMobileTeamBowlerHiddenEnabled: mutate || (async (_userId, teamId, enabled) => team({ id: teamId, bowlerHiddenEnabled: enabled })),
    },
  });
}

function loadListRoute({ userId = 'admin-1', list } = {}) {
  return loadTs('src/app/api/mobile/v1/admin/teams/route.ts', {
    '@/lib/mobile-api/auth': { getMobileApiUserId: async () => userId },
    '@/lib/mobile-api/super-admin': {
      MobileSuperAdminError: service.MobileSuperAdminError,
      listMobileSuperAdminTeams: list || (async () => [team()]),
    },
  });
}

const context = { params: Promise.resolve({ teamId: 'team-1' }) };
const request = body => new Request('https://example.test/api/mobile/v1/admin/teams/team-1/bowler-hidden', {
  method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
});

test('team-list route requires authentication and returns only management fields', async () => {
  const listRequest = new Request('https://example.test/api/mobile/v1/admin/teams');
  assert.equal((await loadListRoute({ userId: null }).GET(listRequest)).status, 401);
  const response = await loadListRoute().GET(listRequest);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    success: true,
    data: { teams: [team()] },
  });
});

test('toggle route requires authentication and accepts only the enabled boolean payload', async () => {
  assert.equal((await loadToggleRoute({ userId: null }).PATCH(request({ enabled: true }), context)).status, 401);
  let calls = 0;
  const route = loadToggleRoute({ mutate: async (...args) => { calls += 1; return team({ bowlerHiddenEnabled: args[2] }); } });
  for (const body of [
    {}, { enabled: 'true' }, { enabled: true, role: 'SUPER_ADMIN' },
    { enabled: true, teamId: 'other-team' }, null,
  ]) {
    const response = await route.PATCH(request(body), context);
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, 'INVALID_REQUEST');
  }
  assert.equal(calls, 0);
  const response = await route.PATCH(request({ enabled: true }), context);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.team.bowlerHiddenEnabled, true);
  assert.equal(calls, 1);
});

test('toggle route maps current-role authorization failure without internal details', async () => {
  const route = loadToggleRoute({
    mutate: async () => { throw new service.MobileSuperAdminError('FORBIDDEN', '슈퍼 관리자 권한이 필요합니다.', 403); },
  });
  const response = await route.PATCH(request({ enabled: false }), context);
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), {
    success: false,
    error: { code: 'FORBIDDEN', message: '슈퍼 관리자 권한이 필요합니다.' },
  });
});
