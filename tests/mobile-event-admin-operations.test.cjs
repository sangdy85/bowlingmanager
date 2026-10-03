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
  const module = { exports: {} }; cache.set(filename, module);
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

function fixture(overrides = {}) {
  return {
    id: 'event-1', teamId: 'team-1', title: '가을 정기전',
    competitionEnabled: true, competitionType: 'INDIVIDUAL', competitionMode: 'OFFICIAL',
    competitionStatus: 'GROUPS_READY', competitionGameCount: 3, rankPoints: '{}',
    draftGeneration: 1, currentPickNumber: 1, laneDrawStatus: 'NOT_STARTED',
    team: {
      ownerId: 'owner', User: [{ id: 'manager' }],
      members: [
        { id: 'm1', userId: 'owner', alias: null, user: { name: '팀장' } },
        { id: 'm2', userId: 'member', alias: null, user: { name: '회원' } },
      ],
    },
    laneAssignments: [], competitionTeams: [], competitionParticipants: [],
    eventCompetitionParticipants: [], eventCompetitionBallots: [], seasonPublications: [], adminAudits: [],
    _count: { scores: 0, charges: 0 },
    ...overrides,
  };
}

function harness(initial) {
  const event = initial;
  const calls = [];
  let deleted = false;
  const applyUpdate = data => {
    for (const [key, value] of Object.entries(data)) {
      if (value && typeof value === 'object' && value.increment) event[key] += value.increment;
      else event[key] = value;
    }
  };
  const tx = {
    teamEvent: {
      findFirst: async ({ where }) => !deleted && where.id === event.id && where.teamId === event.teamId ? event : null,
      update: async ({ data }) => { calls.push(['event.update', data]); applyUpdate(data); return event; },
      delete: async () => { calls.push(['event.delete']); deleted = true; return event; },
    },
    teamEventAttendance: { updateMany: async args => { calls.push(['attendance.updateMany', args]); return { count: 1 }; } },
    teamEventGuest: { updateMany: async args => { calls.push(['guest.updateMany', args]); return { count: 1 }; } },
    teamEventLaneAssignment: { deleteMany: async args => { calls.push(['lanes.deleteMany', args]); event.laneAssignments = []; return { count: 2 }; } },
    teamCompetitionParticipant: { update: async ({ where, data }) => {
      calls.push(['participant.update', where.id, data]);
      const row = event.competitionParticipants.find(item => item.id === where.id); Object.assign(row, data); return row;
    } },
    eventCompetitionParticipant: {
      deleteMany: async args => { calls.push(['eventParticipants.deleteMany', args]); event.eventCompetitionParticipants = []; return { count: 2 }; },
      updateMany: async args => { calls.push(['eventParticipants.updateMany', args]); return { count: 2 }; },
    },
    eventCompetitionBallot: { deleteMany: async args => {
      calls.push(['ballots.deleteMany', args]);
      const count = args.where.voterParticipantId
        ? event.eventCompetitionBallots.filter(item => item.voterParticipantId === args.where.voterParticipantId).length
        : event.eventCompetitionBallots.length;
      event.eventCompetitionBallots = args.where.voterParticipantId
        ? event.eventCompetitionBallots.filter(item => item.voterParticipantId !== args.where.voterParticipantId)
        : [];
      return { count };
    } },
    score: { deleteMany: async args => { calls.push(['scores.deleteMany', args]); const count = event._count.scores; event._count.scores = 0; return { count }; } },
    teamEventAdminAudit: { create: async ({ data }) => { calls.push(['audit.create', data]); return data; } },
  };
  const prisma = { ...tx, $transaction: async callback => callback(tx) };
  const revocations = [];
  const service = loadTs('src/lib/mobile-api/event-admin-operations.ts', {
    '@/lib/prisma': prisma,
    '@/lib/mobile-api/team-game-points': {
      defaultTeamGamePointTables: count => Array.from({ length: count }, (_, i) => ({ gameNumber: i + 1, points: [{ rank: 1, points: 1 }] })),
      readTeamGamePointTables: () => [],
      parseTeamGamePointTables: value => value,
      serializeTeamGamePointTables: value => JSON.stringify(value),
    },
    '@/lib/mobile-api/unified-season': { revokeSeasonPointPublication: async (...args) => revocations.push(args) },
  });
  return { event, calls, revocations, service, get deleted() { return deleted; } };
}

test('admin state is owner/manager only and cross-team/member access is hidden', async () => {
  const h = harness(fixture());
  assert.equal((await h.service.getEventAdminOperationsState('owner', 'team-1', 'event-1')).title, '가을 정기전');
  assert.equal((await h.service.getEventAdminOperationsState('manager', 'team-1', 'event-1')).gameCount, 3);
  await assert.rejects(() => h.service.getEventAdminOperationsState('member', 'team-1', 'event-1'), error => error.code === 'FORBIDDEN');
  await assert.rejects(() => h.service.getEventAdminOperationsState('owner', 'other-team', 'event-1'), error => error.code === 'EVENT_NOT_FOUND');
});

test('individual groups rollback preserves manual groups and requires explicit score deletion', async () => {
  const h = harness(fixture({ _count: { scores: 4, charges: 0 } }));
  await assert.rejects(
    () => h.service.runEventAdminOperation('owner', 'team-1', 'event-1', { action: 'REOPEN_ATTENDANCE' }),
    error => error.code === 'SCORE_CLEAR_CONFIRMATION_REQUIRED' && error.message.includes('4건'),
  );
  const result = await h.service.runEventAdminOperation('owner', 'team-1', 'event-1', {
    action: 'REOPEN_ATTENDANCE', clearScores: true,
  });
  assert.equal(result.status, 'ATTENDANCE_OPEN');
  assert.equal(result.manualGroupsPreserved, true);
  assert.equal(h.calls.some(call => call[0] === 'attendance.updateMany'), false);
  assert.equal(h.calls.some(call => call[0] === 'scores.deleteMany'), true);
});

test('individual manual group clearing is explicit and does not reset attendance', async () => {
  const h = harness(fixture());
  const result = await h.service.runEventAdminOperation('manager', 'team-1', 'event-1', { action: 'CLEAR_INDIVIDUAL_GROUPS' });
  assert.equal(result.groupsCleared, true);
  assert.equal(h.calls.filter(call => call[0].endsWith('updateMany')).length, 2);
  assert.equal(h.event.competitionStatus, 'GROUPS_READY');
});

test('TEAM lane reset returns to finalized while preserving slot configuration', async () => {
  const h = harness(fixture({
    competitionType: 'TEAM', competitionStatus: 'LANES_ASSIGNED', laneDrawStatus: 'COMPLETED',
    laneAssignments: [{ id: 'lane-a' }], laneSlots: [{ laneNumber: 8, position: 1 }],
  }));
  const result = await h.service.runEventAdminOperation('owner', 'team-1', 'event-1', { action: 'RESET_LANES' });
  assert.deepEqual({ status: result.status, slotsPreserved: result.slotsPreserved }, { status: 'TEAMS_FINALIZED', slotsPreserved: true });
  assert.equal(h.event.laneSlots.length, 1);
  assert.equal(h.event.laneDrawStatus, 'NOT_STARTED');
});

test('TEAM draft reset increments generation and preserves historical draft rows', async () => {
  const oldParticipants = [{ id: 'p1', generation: 1 }];
  const oldTeams = [{ id: 't1', generation: 1 }];
  const h = harness(fixture({
    competitionType: 'TEAM', competitionStatus: 'DRAFT_IN_PROGRESS', draftGeneration: 1,
    competitionParticipants: oldParticipants, competitionTeams: oldTeams,
  }));
  const result = await h.service.runEventAdminOperation('owner', 'team-1', 'event-1', { action: 'RESET_TEAM_DRAFT' });
  assert.equal(result.generation, 2);
  assert.equal(h.event.currentPickNumber, 1);
  assert.equal(h.event.competitionParticipants, oldParticipants);
  assert.equal(h.event.competitionTeams, oldTeams);
});

test('TEAM full manual assignment marks overrides, permits imbalance and clears lanes', async () => {
  const participants = [
    { id: 'p1', generation: 1, memberId: 'm1', competitionTeamId: 't1' },
    { id: 'p2', generation: 1, memberId: 'm2', competitionTeamId: 't2' },
    { id: 'p3', generation: 1, memberId: null, competitionTeamId: 't2' },
  ];
  const teams = [
    { id: 't1', generation: 1, captainMemberId: 'm1', participants: [] },
    { id: 't2', generation: 1, captainMemberId: 'm2', participants: [] },
  ];
  const h = harness(fixture({
    competitionType: 'TEAM', competitionStatus: 'LANES_ASSIGNED', laneDrawStatus: 'COMPLETED',
    laneAssignments: [{ id: 'a1' }], competitionParticipants: participants, competitionTeams: teams,
  }));
  const result = await h.service.runEventAdminOperation('owner', 'team-1', 'event-1', {
    action: 'ADMIN_TEAM_OVERRIDE', assignments: [
      { participantId: 'p1', competitionTeamId: 't1' },
      { participantId: 'p2', competitionTeamId: 't2' },
      { participantId: 'p3', competitionTeamId: 't1' },
    ],
  });
  assert.equal(result.status, 'TEAMS_FINALIZED');
  assert.equal(result.unbalanced, true);
  assert.equal(participants.find(item => item.id === 'p3').assignmentType, 'ADMIN_OVERRIDE');
  assert.equal(h.event.laneDrawStatus, 'NOT_STARTED');
});

test('EVENT participant reset removes ballots/snapshot but preserves attendance', async () => {
  const h = harness(fixture({
    competitionType: 'EVENT', competitionStatus: 'FINAL_READY',
    eventCompetitionParticipants: [{ id: 'ep1' }], eventCompetitionBallots: [{ id: 'b1', voterParticipantId: 'ep1' }],
  }));
  const result = await h.service.runEventAdminOperation('owner', 'team-1', 'event-1', { action: 'RESET_EVENT_PARTICIPANTS' });
  assert.equal(result.status, 'ATTENDANCE_OPEN');
  assert.equal(result.attendancePreserved, true);
  assert.equal(h.event.eventCompetitionParticipants.length, 0);
});

test('EVENT reveal rollback can preserve ballots and receives a new independent deadline', async () => {
  const h = harness(fixture({
    competitionType: 'EVENT', competitionStatus: 'REVEALING',
    eventCompetitionParticipants: [{ id: 'ep1' }], eventCompetitionBallots: [{ id: 'b1', voterParticipantId: 'ep1' }],
  }));
  const now = new Date('2026-10-03T00:00:00Z');
  const result = await h.service.runEventAdminOperation('manager', 'team-1', 'event-1', {
    action: 'RESET_EVENT_VOTING', preserveBallots: true, durationMinutes: 30,
  }, now);
  assert.equal(result.status, 'EVENT_READY');
  assert.equal(result.ballotsPreserved, true);
  assert.equal(result.voteDeadline, '2026-10-03T00:30:00.000Z');
  assert.equal(h.calls.some(call => call[0] === 'ballots.deleteMany'), false);
  assert.equal(h.calls.some(call => call[0] === 'eventParticipants.updateMany'), true);
});

test('EVENT single ballot reset leaves other ballots untouched', async () => {
  const h = harness(fixture({
    competitionType: 'EVENT', competitionStatus: 'EVENT_READY',
    eventCompetitionParticipants: [{ id: 'ep1' }, { id: 'ep2' }],
    eventCompetitionBallots: [{ id: 'b1', voterParticipantId: 'ep1' }, { id: 'b2', voterParticipantId: 'ep2' }],
  }));
  await h.service.runEventAdminOperation('owner', 'team-1', 'event-1', {
    action: 'RESET_EVENT_BALLOT', voterParticipantId: 'ep1',
  });
  assert.deepEqual(h.event.eventCompetitionBallots.map(item => item.id), ['b2']);
});

test('published rollback revokes publication and returns each competition type to a safe state', async () => {
  for (const [type, expected] of [['INDIVIDUAL', 'GROUPS_READY'], ['TEAM', 'TEAMS_FINALIZED'], ['EVENT', 'FINAL_READY']]) {
    const h = harness(fixture({
      competitionType: type, competitionStatus: 'PUBLISHED',
      seasonPublications: [{ id: 'pub', resultSnapshot: '{}' }],
    }));
    const result = await h.service.runEventAdminOperation('owner', 'team-1', 'event-1', { action: 'REOPEN_PUBLICATION' });
    assert.equal(result.status, expected);
    assert.equal(h.revocations.length, 1);
  }
});

test('game count accepts 1/3/4/5/12, rejects null legacy score access policy, and clears scores only by consent', async () => {
  for (const count of [1, 3, 4, 5, 12]) {
    const h = harness(fixture({ competitionGameCount: null }));
    const result = await h.service.runEventAdminOperation('owner', 'team-1', 'event-1', { action: 'CHANGE_GAME_COUNT', gameCount: count });
    assert.equal(result.gameCount, count);
    assert.equal(h.event.competitionGameCount, count);
  }
  const h = harness(fixture({ _count: { scores: 2, charges: 0 } }));
  await assert.rejects(
    () => h.service.runEventAdminOperation('owner', 'team-1', 'event-1', { action: 'CHANGE_GAME_COUNT', gameCount: 5 }),
    error => error.code === 'SCORE_CLEAR_CONFIRMATION_REQUIRED',
  );
  await h.service.runEventAdminOperation('owner', 'team-1', 'event-1', {
    action: 'CHANGE_GAME_COUNT', gameCount: 5, clearScores: true,
  });
  assert.equal(h.event.competitionGameCount, 5);
});

test('game count changes apply to every competition type and TEAM point tables stay contiguous', async () => {
  for (const competitionType of ['INDIVIDUAL', 'TEAM', 'EVENT']) {
    const h = harness(fixture({ competitionType, competitionGameCount: 3 }));
    await h.service.runEventAdminOperation('owner', 'team-1', 'event-1', {
      action: 'CHANGE_GAME_COUNT', gameCount: 4,
    });
    assert.equal(h.event.competitionGameCount, 4);
  }

  const h = harness(fixture({ competitionType: 'TEAM', competitionGameCount: 2 }));
  await h.service.runEventAdminOperation('owner', 'team-1', 'event-1', {
    action: 'CHANGE_GAME_COUNT',
    gameCount: 5,
    teamGamePointTables: Array.from({ length: 5 }, (_, index) => ({
      gameNumber: index + 1,
      points: [{ rank: 1, points: 5 - index }],
    })),
  });
  assert.deepEqual(
    JSON.parse(h.event.rankPoints).map(item => item.gameNumber),
    [1, 2, 3, 4, 5],
  );
});

test('safe delete revokes publication, deletes linked scores, preserves finance through SetNull, and writes audit', async () => {
  const h = harness(fixture({
    competitionStatus: 'PUBLISHED', _count: { scores: 7, charges: 2 },
    seasonPublications: [{ id: 'pub', resultSnapshot: '{}' }],
  }));
  await assert.rejects(
    () => h.service.runEventAdminOperation('owner', 'team-1', 'event-1', { action: 'DELETE_EVENT', confirmTitle: '오입력' }),
    error => error.code === 'EVENT_TITLE_CONFIRMATION_REQUIRED',
  );
  const result = await h.service.runEventAdminOperation('owner', 'team-1', 'event-1', {
    action: 'DELETE_EVENT', confirmTitle: '가을 정기전', clearScores: true,
  });
  assert.equal(result.deleted, true);
  assert.equal(result.financeLinksPreserved, 2);
  assert.equal(h.revocations.length, 1);
  assert.equal(h.calls.find(call => call[0] === 'audit.create')[1].eventSnapshotId, 'event-1');
  assert.equal(h.deleted, true);
});

test('admin operation route requires authentication and passes semantic actions only', async () => {
  const calls = [];
  const route = loadTs('src/app/api/mobile/v1/teams/[teamId]/events/[eventId]/admin-operations/route.ts', {
    '@/lib/mobile-api/auth': { getMobileApiUserId: async request => request.headers.get('x-user') },
    '@/lib/mobile-api/event-admin-operations': {
      EventAdminOperationError: class EventAdminOperationError extends Error {},
      getEventAdminOperationsState: async (...args) => { calls.push(['GET', ...args]); return { scoreCount: 0 }; },
      runEventAdminOperation: async (...args) => { calls.push(['POST', ...args]); return { status: 'ATTENDANCE_OPEN' }; },
    },
    '@/lib/mobile-api/unified-season': { UnifiedSeasonError: class UnifiedSeasonError extends Error {} },
  });
  const context = { params: Promise.resolve({ teamId: 'team-1', eventId: 'event-1' }) };
  assert.equal((await route.GET(new Request('https://example.test'), context)).status, 401);
  const response = await route.POST(new Request('https://example.test', {
    method: 'POST', headers: { 'x-user': 'owner', 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'RESET_LANES' }),
  }), context);
  assert.equal(response.status, 200);
  assert.deepEqual(calls[0].slice(0, 4), ['POST', 'owner', 'team-1', 'event-1']);
  assert.deepEqual(calls[0][4], { action: 'RESET_LANES' });
});

test('admin audit migration is additive and event deletion preserves audit, finance and publication history', () => {
  const migration = fs.readFileSync(path.resolve(
    __dirname, '..', 'prisma/migrations/20261003100000_add_event_admin_operations/migration.sql',
  ), 'utf8');
  const schema = fs.readFileSync(path.resolve(__dirname, '..', 'prisma/schema.prisma'), 'utf8');
  assert.match(migration, /ADD COLUMN "eventVotingDeadlineAt" DATETIME/);
  assert.match(migration, /CREATE TABLE "TeamEventAdminAudit"/);
  assert.match(migration, /'ADMIN_LANE_OVERRIDE'/);
  assert.match(migration, /TeamEventAdminAudit_eventId_fkey[\s\S]*ON DELETE SET NULL/);
  assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN/);
  assert.match(schema, /model TeamCharge[\s\S]*event\s+TeamEvent\?[\s\S]*onDelete: SetNull/);
  assert.match(schema, /model SeasonPointPublication[\s\S]*event\s+TeamEvent\?[\s\S]*onDelete: SetNull/);
});
