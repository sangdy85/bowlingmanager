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

function member(number) {
  return { id: `member-${number}`, userId: `user-${number}`, alias: null, user: { name: `회원${number}` } };
}

function eventFixture({ incomplete = false, pointTie = false } = {}) {
  const members = [1, 2, 3, 4, 5].map(member);
  const participant = (number, teamId, order) => ({
    id: `participant-${number}`, eventId: 'event-1', generation: 1,
    memberId: `member-${number}`, competitionTeamId: teamId,
    assignmentType: order === 0 ? 'CAPTAIN' : 'DRAFT', assignmentOrder: order,
    member: members[number - 1],
  });
  const participants = [
    participant(1, 'competition-team-1', 0), participant(2, 'competition-team-1', 1),
    participant(3, 'competition-team-1', 2), participant(4, 'competition-team-2', 0),
    participant(5, 'competition-team-2', 3),
  ];
  const teams = [
    {
      id: 'competition-team-1', generation: 1, name: 'TEAM 1', draftOrder: 1,
      lanePriority: null, teamHandicap: 0, captainMemberId: 'member-1',
      captain: members[0], participants: participants.slice(0, 3),
    },
    {
      id: 'competition-team-2', generation: 1, name: 'TEAM 2', draftOrder: 2,
      lanePriority: null, teamHandicap: 0, captainMemberId: 'member-4',
      captain: members[3], participants: participants.slice(3),
    },
  ];
  const scores = [
    [1, 220, 250], [2, 200, 240], [3, 100, 100],
    [4, 180, 190], [5, 170, 180],
  ].flatMap(([number, first, second]) => [
    { id: `score-${number}-1`, userId: `user-${number}`, score: first },
    ...((incomplete && number === 5) ? [] : [{ id: `score-${number}-2`, userId: `user-${number}`, score: pointTie ? second + 120 : second }]),
  ]);
  return {
    event: {
      id: 'event-1', teamId: 'team-1', eventDate: new Date('2026-09-22T00:00:00+09:00'),
      gameType: '정기전', competitionEnabled: true, competitionType: 'TEAM',
      competitionStatus: 'TEAMS_FINALIZED', draftGeneration: 1, currentPickNumber: 4,
      rankPoints: JSON.stringify({ 1: 5, 2: 3 }),
      team: { ownerId: 'user-1', bowlerHiddenEnabled: true, User: [], members },
      attendances: members.map(item => ({ status: 'ATTENDING', member: item })),
      competitionTeams: teams, competitionParticipants: participants,
      competitionDraftPicks: [], laneSlots: [], laneAssignments: [],
    },
    scores,
  };
}

test('snake draft is deterministic and the 19/4 plan reserves three random assignments', () => {
  const service = loadTs('src/lib/mobile-api/team-competition.ts', {
    '@/lib/prisma': {}, '@/lib/mobile-api/bowler-hidden': { readRankPoints: () => [] },
  });
  assert.deepEqual(
    Array.from({ length: 8 }, (_, index) => service.snakeDraftTurn(index + 1, 4).draftOrder),
    [1, 2, 3, 4, 4, 3, 2, 1],
  );
  assert.deepEqual(service.draftPlan(19, 4), {
    attendeeCount: 19, captainCount: 4, draftPerTeam: 3, draftTotal: 12, remainder: 3,
  });
});

test('official lane example allocates non-interleaved contiguous team blocks', () => {
  const service = loadTs('src/lib/mobile-api/team-competition.ts', {
    '@/lib/prisma': {}, '@/lib/mobile-api/bowler-hidden': { readRankPoints: () => [] },
  });
  const slots = [];
  for (let lane = 9; lane <= 14; lane += 1) {
    for (let position = 1; position <= 3; position += 1) slots.push({ id: `${lane}-${position}`, laneNumber: lane, position });
  }
  const teams = [4, 5, 4, 5].map((size, index) => ({
    id: `team-${index + 1}`, lanePriority: index + 1,
    memberIds: Array.from({ length: size }, (_, memberIndex) => `m-${index + 1}-${memberIndex + 1}`),
  }));
  const blocks = service.allocateTeamLaneBlocks(teams, slots);
  assert.deepEqual(blocks.map(block => block.assignments.map(item => item.slot.id)), [
    ['9-1', '9-2', '9-3', '10-1'],
    ['10-2', '10-3', '11-1', '11-2', '11-3'],
    ['12-1', '12-2', '12-3', '13-1'],
    ['13-2', '13-3', '14-1', '14-2', '14-3'],
  ]);
  assert.throws(
    () => service.allocateTeamLaneBlocks(teams, slots.slice(0, -1)),
    error => error.code === 'PARTICIPANT_SLOT_MISMATCH',
  );
});

test('team results drop each larger team game lowest score and are recalculated from source rows', async () => {
  const fixture = eventFixture();
  let scoreQueries = 0;
  const prisma = {
    teamSeason: { findFirst: async () => ({
      status: 'ACTIVE', startDate: new Date('2026-01-01T00:00:00+09:00'),
      endDate: new Date('2026-12-31T23:59:59+09:00'),
      individualPointsConfig: '{}', teamPointsConfig: '{"1":35,"2":20}', eventPointsConfig: '{}',
    }) },
    teamEvent: { findFirst: async () => fixture.event },
    score: { findMany: async () => { scoreQueries += 1; return fixture.scores; } },
  };
  const service = loadTs('src/lib/mobile-api/team-competition.ts', {
    '@/lib/prisma': prisma,
    '@/lib/mobile-api/bowler-hidden': { readRankPoints: () => [{ rank: 1, points: 5 }, { rank: 2, points: 3 }] },
  });
  const result = await service.getTeamCompetitionState('user-1', 'team-1', 'event-1');
  assert.equal(scoreQueries, 1);
  assert.equal(result.results.effectivePlayerCount, 2);
  assert.deepEqual(result.results.games[0].teams.map(team => ({
    team: team.teamName, raw: team.rawTeamTotal, excluded: team.excludedScores,
    normalized: team.normalizedTeamTotal, rank: team.rank, points: team.points,
  })), [
    { team: 'TEAM 1', raw: 520, excluded: [100], normalized: 420, rank: 1, points: 5 },
    { team: 'TEAM 2', raw: 350, excluded: [], normalized: 350, rank: 2, points: 3 },
  ]);
  assert.equal(result.results.complete, true);
  assert.equal(result.results.teams[0].totalPoints, 10);
  assert.equal(result.policies.teamHandicapApplication, 'PENDING_PRODUCT_DECISION');
  assert.equal(JSON.stringify(result).includes('user-'), false);
});

test('missing score never becomes zero and prevents the affected game ranking', async () => {
  const fixture = eventFixture({ incomplete: true });
  const service = loadTs('src/lib/mobile-api/team-competition.ts', {
    '@/lib/prisma': {
      teamEvent: { findFirst: async () => fixture.event },
      score: { findMany: async () => fixture.scores },
    },
    '@/lib/mobile-api/bowler-hidden': { readRankPoints: () => [{ rank: 1, points: 5 }, { rank: 2, points: 3 }] },
  });
  const result = await service.getTeamCompetitionState('user-1', 'team-1', 'event-1');
  assert.equal(result.results.complete, false);
  assert.equal(result.results.games[1].complete, false);
  const missingTeam = result.results.games[1].teams.find(team => team.teamId === 'competition-team-2');
  assert.equal(missingTeam.rawTeamTotal, null);
  assert.equal(missingTeam.rank, null);
  assert.equal(result.results.teams.every(team => team.finalRank === null), true);
});

test('feature flag and manager permissions are rechecked by team competition actions', async () => {
  const fixture = eventFixture();
  fixture.event.competitionStatus = 'ATTENDANCE_OPEN';
  let updates = 0;
  const prisma = {
    teamEvent: {
      findFirst: async () => fixture.event,
      update: async () => { updates += 1; return {}; },
    },
  };
  let service = loadTs('src/lib/mobile-api/team-competition.ts', {
    '@/lib/prisma': prisma,
    '@/lib/mobile-api/bowler-hidden': { readRankPoints: () => [] },
  });
  await assert.rejects(
    () => service.updateTeamCompetition('user-4', 'team-1', 'event-1', { action: 'LOCK_ATTENDANCE' }),
    error => error.code === 'FORBIDDEN' && error.status === 403,
  );
  assert.equal(updates, 0);

  fixture.event.team.bowlerHiddenEnabled = false;
  service = loadTs('src/lib/mobile-api/team-competition.ts', {
    '@/lib/prisma': prisma,
    '@/lib/mobile-api/bowler-hidden': { readRankPoints: () => [] },
  });
  await assert.rejects(
    () => service.getTeamCompetitionState('user-1', 'team-1', 'event-1'),
    error => error.code === 'FEATURE_DISABLED' && error.status === 404,
  );
});

test('migration keeps reset generations and conflict-prevention uniqueness', () => {
  const sql = fs.readFileSync(path.resolve(__dirname,
    '../prisma/migrations/20260922210000_add_bowler_hidden_competitions/migration.sql'), 'utf8');
  assert.match(sql, /draftGeneration[^\n]*DEFAULT 1/i);
  assert.match(sql, /TeamCompetitionDraftPick_event_generation_pick_key/);
  assert.match(sql, /TeamCompetitionParticipant_event_generation_member_key/);
  assert.match(sql, /TeamCompetitionTeam_event_generation_order_key/);
  assert.doesNotMatch(sql, /DROP TABLE|DELETE FROM/i);
});

test('team competition route authenticates and keeps actor/team/event scope', async () => {
  let getCall = null;
  let postCall = null;
  class FakeError extends Error {}
  const route = loadTs('src/app/api/mobile/v1/teams/[teamId]/events/[eventId]/competition/team/route.ts', {
    '@/lib/mobile-api/auth': { getMobileApiUserId: async request => request.headers.get('x-user') },
    '@/lib/mobile-api/team-competition': {
      TeamCompetitionError: FakeError,
      getTeamCompetitionState: async (userId, teamId, eventId) => {
        getCall = { userId, teamId, eventId }; return { status: 'ATTENDANCE_OPEN' };
      },
      updateTeamCompetition: async (userId, teamId, eventId, body) => {
        postCall = { userId, teamId, eventId, body }; return { status: 'ATTENDANCE_LOCKED' };
      },
    },
  });
  const context = { params: Promise.resolve({ teamId: 'team-1', eventId: 'event-1' }) };
  assert.equal((await route.GET(new Request('https://example.test'), context)).status, 401);
  const headers = { 'content-type': 'application/json', 'x-user': 'user-1' };
  assert.equal((await route.GET(new Request('https://example.test', { headers }), context)).status, 200);
  assert.deepEqual(getCall, { userId: 'user-1', teamId: 'team-1', eventId: 'event-1' });
  const response = await route.POST(new Request('https://example.test', {
    method: 'POST', headers, body: JSON.stringify({ action: 'LOCK_ATTENDANCE' }),
  }), context);
  assert.equal(response.status, 200);
  assert.deepEqual(postCall, {
    userId: 'user-1', teamId: 'team-1', eventId: 'event-1', body: { action: 'LOCK_ATTENDANCE' },
  });
});
