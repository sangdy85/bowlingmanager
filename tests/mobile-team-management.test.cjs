// Run: node --test tests/mobile-team-management.test.cjs
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

const service = loadTs('src/lib/mobile-api/team-management.ts', {
  '@/lib/prisma': {},
  uuid: { v4: () => 'new-score' },
});

const team = {
  id: 'team-1', ownerId: 'owner', User: [{ id: 'manager' }, { id: 'manager-target' }],
  members: [
    { id: 'membership-owner', userId: 'owner', alias: null, user: { name: '팀장' } },
    { id: 'membership-manager', userId: 'manager', alias: '매니저 별명', user: { name: '매니저' } },
    { id: 'membership-manager-target', userId: 'manager-target', alias: null, user: { name: '다른 매니저' } },
    { id: 'membership-member', userId: 'member', alias: null, user: { name: '일반 회원' } },
  ],
};

const scoreRows = [
  {
    id: 'score-1', score: 0, gameDate: new Date('2026-09-18T15:00:00.000Z'), gameType: '정기전',
    userId: 'member', guestName: null, memo: 'fixture', createdAt: new Date('2026-09-18T15:01:00.000Z'),
    User: { name: '일반 회원' },
  },
  {
    id: 'score-2', score: 300, gameDate: new Date('2026-09-18T15:00:00.000Z'), gameType: '정기전',
    userId: null, guestName: '게스트', memo: 'fixture', createdAt: new Date('2026-09-18T15:02:00.000Z'), User: null,
  },
];

function fixture(changes = {}) {
  const state = { replace: null, deleted: null, removed: null, role: null };
  return {
    state,
    dependencies: {
      findAccessibleTeam: async actor => ['owner', 'manager', 'member'].includes(actor) ? team : null,
      listScores: async requestedTeam => requestedTeam === 'team-1' ? scoreRows : [],
      replaceScores: async input => { state.replace = input; return { createdCount: input.participants.reduce((sum, row) => sum + row.scores.length, 0) }; },
      deleteScores: async input => { state.deleted = input; return { deletedCount: input.expectedIds.length }; },
      removeMember: async input => { state.removed = input; },
      setManager: async (teamId, userId, enabled) => { state.role = { teamId, userId, enabled }; },
      ...changes,
    },
  };
}

function validMutation(revision, changes = {}) {
  return {
    revision, date: '2026-09-20', gameType: '정기전', memo: null,
    participants: [
      { memberId: 'membership-member', name: '일반 회원', scores: [0, 300] },
      { memberId: null, name: '새 게스트', scores: [200] },
    ],
    ...changes,
  };
}

test('OWNER and MANAGER can load editable records while MEMBER cannot', async () => {
  for (const actor of ['owner', 'manager']) {
    const result = await service.getEditableTeamActivity(actor, 'team-1', '2026-09-19~REGULAR', fixture().dependencies);
    assert.equal(result.role, actor === 'owner' ? 'OWNER' : 'MANAGER');
    assert.equal(result.activity.scoreCount, 2);
    assert.equal(result.activity.participants[0].memberId, 'membership-member');
    assert.equal(result.activity.participants[1].memberId, null);
    assert.equal(result.activity.revision.length, 64);
  }
  await assert.rejects(
    () => service.getEditableTeamActivity('member', 'team-1', '2026-09-19~REGULAR', fixture().dependencies),
    error => error.code === 'FORBIDDEN' && error.status === 403,
  );
});

test('outsider, inactive or membership-less privileged identities receive TEAM_NOT_FOUND', async () => {
  for (const actor of ['outsider', 'super-admin']) {
    await assert.rejects(
      () => service.getEditableTeamActivity(actor, 'team-1', '2026-09-19~REGULAR', fixture().dependencies),
      error => error.code === 'TEAM_NOT_FOUND' && error.status === 404,
    );
  }
});

test('activity edit parser accepts 0 and 300 and rejects invalid payloads', () => {
  const parsed = service.parseTeamActivityMutation(validMutation('revision'));
  assert.deepEqual(parsed.participants[0].scores, [0, 300]);
  for (const score of [-1, 301, 1.5]) {
    assert.throws(
      () => service.parseTeamActivityMutation(validMutation('revision', { participants: [{ memberId: 'membership-member', name: '회원', scores: [score] }] })),
      error => error.code === 'INVALID_SCORE',
    );
  }
  assert.throws(() => service.parseTeamActivityMutation(validMutation('revision', { participants: [] })), error => error.code === 'INVALID_PARTICIPANTS');
  assert.throws(
    () => service.parseTeamActivityMutation(validMutation('revision', { participants: [
      { memberId: 'membership-member', name: '회원', scores: [200] },
      { memberId: 'membership-member', name: '회원', scores: [210] },
    ] })),
    error => error.code === 'DUPLICATE_PARTICIPANT',
  );
});

test('activity update supports participant/game additions and removals in one atomic call', async () => {
  const { state, dependencies } = fixture();
  const editable = await service.getEditableTeamActivity('owner', 'team-1', '2026-09-19~REGULAR', dependencies);
  const result = await service.updateTeamActivity(
    'owner', 'team-1', '2026-09-19~REGULAR', validMutation(editable.activity.revision), dependencies,
  );
  assert.deepEqual(result, { activityId: '2026-09-20~ALL', updatedCount: 3 });
  assert.deepEqual(state.replace.expectedIds, ['score-1', 'score-2']);
  assert.equal(state.replace.participants[1].name, '새 게스트');
});

test('activity update blocks cross-team member injection and stale revisions', async () => {
  const { state, dependencies } = fixture();
  const editable = await service.getEditableTeamActivity('manager', 'team-1', '2026-09-19~REGULAR', dependencies);
  await assert.rejects(
    () => service.updateTeamActivity('manager', 'team-1', '2026-09-19~REGULAR', validMutation(editable.activity.revision, {
      participants: [{ memberId: 'other-team-membership', name: '침입', scores: [200] }],
    }), dependencies),
    error => error.code === 'INVALID_MEMBER',
  );
  await assert.rejects(
    () => service.updateTeamActivity('manager', 'team-1', '2026-09-19~REGULAR', validMutation('stale'), dependencies),
    error => error.code === 'ACTIVITY_CONFLICT' && error.status === 409,
  );
  assert.equal(state.replace, null);
});

test('activity edit and delete keep REGULAR CASUAL and ALL scopes isolated', async () => {
  const mixedRows = [
    { ...scoreRows[0], id: 'regular', gameType: '정기전' },
    { ...scoreRows[1], id: 'casual', gameType: '벙개' },
    { ...scoreRows[1], id: 'other', gameType: '기타' },
    { ...scoreRows[1], id: 'unsupported', gameType: '지원하지않음' },
  ];
  for (const [filter, expectedIds] of [
    ['REGULAR', ['regular']],
    ['CASUAL', ['casual']],
    ['ALL', ['regular', 'casual', 'other']],
  ]) {
    const current = fixture({ listScores: async () => mixedRows });
    const activityId = `2026-09-19~${filter}`;
    const editable = await service.getEditableTeamActivity('owner', 'team-1', activityId, current.dependencies);
    await service.deleteTeamActivity('owner', 'team-1', activityId, editable.activity.revision, current.dependencies);
    assert.deepEqual(current.state.deleted.expectedIds, expectedIds);
    assert.equal(current.state.deleted.filter, filter);
  }
});

test('activity revision is deterministic and covers every persisted score field', async () => {
  async function revision(rows) {
    const current = fixture({ listScores: async () => rows });
    return (await service.getEditableTeamActivity(
      'owner', 'team-1', '2026-09-19~REGULAR', current.dependencies,
    )).activity.revision;
  }

  const baseline = await revision(scoreRows);
  assert.equal(await revision([...scoreRows].reverse()), baseline);
  const changes = [
    rows => rows.map((row, index) => index === 0 ? { ...row, id: 'changed-id' } : row),
    rows => rows.map((row, index) => index === 0 ? { ...row, score: 1 } : row),
    rows => rows.map((row, index) => index === 0 ? { ...row, gameDate: new Date('2026-09-18T16:00:00.000Z') } : row),
    rows => rows.map((row, index) => index === 0 ? { ...row, gameType: '벙개' } : row),
    rows => rows.map((row, index) => index === 0 ? { ...row, userId: 'owner' } : row),
    rows => rows.map((row, index) => index === 1 ? { ...row, guestName: '다른 게스트' } : row),
    rows => rows.map((row, index) => index === 0 ? { ...row, memo: 'changed' } : row),
    rows => rows.map((row, index) => index === 0 ? { ...row, createdAt: new Date('2026-09-18T15:03:00.000Z') } : row),
    rows => rows.slice(0, 1),
    rows => [...rows, { ...rows[0], id: 'added-score', createdAt: new Date('2026-09-18T15:04:00.000Z') }],
  ];
  for (const change of changes) {
    assert.notEqual(await revision(change(scoreRows)), baseline);
  }
});

test('transaction failures propagate without reporting edit or delete success', async () => {
  let current = fixture({ replaceScores: async () => { throw new Error('rollback edit'); } });
  let editable = await service.getEditableTeamActivity('owner', 'team-1', '2026-09-19~REGULAR', current.dependencies);
  await assert.rejects(() => service.updateTeamActivity(
    'owner', 'team-1', '2026-09-19~REGULAR', validMutation(editable.activity.revision), current.dependencies,
  ), /rollback edit/);

  current = fixture({ deleteScores: async () => { throw new Error('rollback delete'); } });
  editable = await service.getEditableTeamActivity('owner', 'team-1', '2026-09-19~REGULAR', current.dependencies);
  await assert.rejects(() => service.deleteTeamActivity(
    'owner', 'team-1', '2026-09-19~REGULAR', editable.activity.revision, current.dependencies,
  ), /rollback delete/);
});

test('activity delete is manager-only, team-scoped and revision-protected', async () => {
  const { state, dependencies } = fixture();
  const editable = await service.getEditableTeamActivity('manager', 'team-1', '2026-09-19~REGULAR', dependencies);
  assert.deepEqual(
    await service.deleteTeamActivity('manager', 'team-1', '2026-09-19~REGULAR', editable.activity.revision, dependencies),
    { deletedCount: 2 },
  );
  assert.deepEqual(state.deleted.expectedIds, ['score-1', 'score-2']);
  await assert.rejects(
    () => service.deleteTeamActivity('manager', 'other-team', '2026-09-19~REGULAR', editable.activity.revision, dependencies),
    error => error.code === 'ACTIVITY_NOT_FOUND',
  );
});

test('member removal preserves web owner/manager protections', async () => {
  let current = fixture();
  await service.removeTeamMember('manager', 'team-1', 'membership-member', current.dependencies);
  assert.equal(current.state.removed.displayName, '일반 회원');
  for (const protectedId of ['membership-owner', 'membership-manager-target', 'membership-manager']) {
    current = fixture();
    await assert.rejects(
      () => service.removeTeamMember('manager', 'team-1', protectedId, current.dependencies),
      error => ['MEMBER_PROTECTED', 'SELF_REMOVAL_FORBIDDEN'].includes(error.code),
    );
    assert.equal(current.state.removed, null);
  }
  current = fixture();
  await service.removeTeamMember('owner', 'team-1', 'membership-manager-target', current.dependencies);
  assert.equal(current.state.removed.userId, 'manager-target');
  await assert.rejects(
    () => service.removeTeamMember('owner', 'team-1', 'membership-owner', current.dependencies),
    error => error.code === 'SELF_REMOVAL_FORBIDDEN',
  );
});

test('only OWNER changes manager roles and owner remains protected', async () => {
  let current = fixture();
  assert.deepEqual(
    await service.changeTeamMemberRole('owner', 'team-1', 'membership-member', 'MANAGER', current.dependencies),
    { memberId: 'membership-member', role: 'MANAGER' },
  );
  assert.deepEqual(current.state.role, { teamId: 'team-1', userId: 'member', enabled: true });
  await assert.rejects(
    () => service.changeTeamMemberRole('manager', 'team-1', 'membership-member', 'MANAGER', fixture().dependencies),
    error => error.code === 'FORBIDDEN',
  );
  await assert.rejects(
    () => service.changeTeamMemberRole('owner', 'team-1', 'membership-owner', 'MEMBER', fixture().dependencies),
    error => error.code === 'OWNER_PROTECTED',
  );
});

test('mobile bulk parser rejects duplicate current members and duplicate guests', () => {
  const capture = loadTs('src/lib/mobile-api/score-capture.ts', {
    '@/lib/score-bulk-service': { SCORE_GAME_TYPES: ['정기전', '벙개', '상주', '교류전', '기타'] },
  });
  for (const players of [
    [{ memberId: 'member-1', name: '회원', scores: [200] }, { memberId: 'member-1', name: '다른 표시', scores: [210] }],
    [{ name: '게스트', scores: [200] }, { name: '게스트', scores: [210] }],
  ]) {
    assert.throws(() => capture.parseMobileBulkScoreRequest({
      teamId: 'team-1', gameDate: '2026-09-20', gameType: '정기전', players,
    }), error => error.code === 'DUPLICATE_PARTICIPANT');
  }
});

test('management routes require auth and return minimal success envelopes', async () => {
  let userId = null;
  const management = {
    getEditableTeamActivity: async () => ({ role: 'OWNER', activity: { id: 'activity' } }),
    parseTeamActivityMutation: value => value,
    updateTeamActivity: async () => ({ activityId: 'next', updatedCount: 2 }),
    deleteTeamActivity: async () => ({ deletedCount: 2 }),
    removeTeamMember: async () => ({ removedMemberId: 'membership-1' }),
    changeTeamMemberRole: async () => ({ memberId: 'membership-1', role: 'MANAGER' }),
    TeamManagementError: service.TeamManagementError,
  };
  const overrides = {
    '@/lib/mobile-api/auth': { getMobileApiUserId: async () => userId },
    '@/lib/mobile-api/team-management': management,
    '@/lib/mobile-api/team-management-response': {
      teamManagementErrorResponse: error => { throw error; },
    },
  };
  const editRoute = loadTs('src/app/api/mobile/v1/teams/[teamId]/activities/[activityId]/edit/route.ts', overrides);
  const context = { params: Promise.resolve({ teamId: 'team-1', activityId: 'activity' }) };
  assert.equal((await editRoute.GET(new Request('https://example.test'), context)).status, 401);
  userId = 'owner';
  let response = await editRoute.PUT(new Request('https://example.test', {
    method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ revision: 'r' }),
  }), context);
  assert.deepEqual(await response.json(), { success: true, data: { activityId: 'next', updatedCount: 2 } });

  const memberRoute = loadTs('src/app/api/mobile/v1/teams/[teamId]/members/[memberId]/route.ts', overrides);
  const memberContext = { params: Promise.resolve({ teamId: 'team-1', memberId: 'membership-1' }) };
  response = await memberRoute.PATCH(new Request('https://example.test', {
    method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ role: 'MANAGER' }),
  }), memberContext);
  assert.deepEqual(await response.json(), { success: true, data: { memberId: 'membership-1', role: 'MANAGER' } });
});
