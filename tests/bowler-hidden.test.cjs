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

const hidden = loadTs('src/lib/mobile-api/bowler-hidden.ts', { '@/lib/prisma': {} });

test('rank point configuration rejects negative, duplicate and fractional entries', () => {
  assert.deepEqual(hidden.parseRankPoints([{ rank: 2, points: 17 }, { rank: 1, points: 20 }]), [
    { rank: 1, points: 20 }, { rank: 2, points: 17 },
  ]);
  for (const value of [
    [{ rank: 1, points: -1 }], [{ rank: 1, points: 1.5 }],
    [{ rank: 1, points: 10 }, { rank: 1, points: 8 }], [{ rank: 0, points: 10 }],
  ]) assert.throws(() => hidden.parseRankPoints(value), error => error.code === 'INVALID_RANK_POINTS');
});

test('standard skill boundaries are explicit and deterministic', () => {
  assert.deepEqual([200, 199.9, 190, 189.9, 180, 179.9, 170, 169.9].map(hidden.tierForGroupingScore),
    ['A', 'B', 'B', 'C', 'C', 'D', 'D', 'E']);
});

test('adjacent tier merge never crosses more than two source tiers', () => {
  assert.deepEqual(hidden.mergeAdjacentSkillTiers({ A: 5, B: 2, C: 3, D: 1, E: 4 }), [
    { displayGroup: 'A조', sourceTiers: ['A'], participantCount: 5, minimumRecommendedMet: true },
    { displayGroup: 'B조', sourceTiers: ['B', 'C'], participantCount: 5, minimumRecommendedMet: true },
    { displayGroup: 'C조', sourceTiers: ['D', 'E'], participantCount: 5, minimumRecommendedMet: true },
  ]);
  const impossible = hidden.mergeAdjacentSkillTiers({ A: 1, B: 1, C: 1, D: 5, E: 5 });
  assert.deepEqual(impossible[0].sourceTiers, ['A', 'B']);
  assert.equal(impossible[0].minimumRecommendedMet, false);
  assert.equal(impossible.some(group => group.sourceTiers.length > 2), false);
  assert.deepEqual(hidden.mergeAdjacentSkillTiers({ A: 5, B: 5, C: 5, D: 5, E: 1 }).at(-1).sourceTiers, ['D', 'E']);
});

test('recent averages use game scores rather than session averages', () => {
  const scores = Array.from({ length: 60 }, (_, index) => 100 + index);
  assert.equal(hidden.recentAverage([], 50), null);
  assert.equal(hidden.recentAverage([200, 100, 300], 12), 200);
  assert.equal(hidden.recentAverage(scores, 50), 124.5);
});

test('grouping score keeps precision and applies the fixed 30/40/30 weights', () => {
  assert.equal(hidden.calculateGroupingScore({ recent50Average: 180, recent12Average: 210, regularExpectedScore: 190 }), 195);
  assert.equal(hidden.calculateGroupingScore({ recent50Average: 199.99, recent12Average: 199.99, regularExpectedScore: 199.99 }), 199.99);
  assert.equal(hidden.calculateGroupingScore({ recent50Average: null, recent12Average: 200, regularExpectedScore: 200 }), null);
  assert.deepEqual([199.99, 200, 189.99, 190, 179.99, 180, 169.99, 170].map(hidden.tierForGroupingScore),
    ['B', 'A', 'C', 'B', 'D', 'C', 'E', 'D']);
});

test('grouping preview requires every automatic component and distinguishes manual overrides', () => {
  const missing = hidden.createGroupingPreview({
    recent50Average: 200, recent12Average: 200, regularExpectedScore: null, manualGroupingScore: null,
  });
  assert.equal(missing.groupingSource, 'MANUAL_REQUIRED'); assert.equal(missing.effectiveGroup, null);
  const legacy = hidden.createGroupingPreview({
    recent50Average: null, recent12Average: null, regularExpectedScore: null, manualGroupingScore: 190,
  });
  assert.equal(legacy.groupingSource, 'LEGACY_MANUAL_SCORE'); assert.equal(legacy.effectiveGroup, 'B');
  const auto = hidden.createGroupingPreview({
    recent50Average: 200, recent12Average: 190, regularExpectedScore: 180, manualGroupingScore: null,
  });
  assert.equal(auto.autoGroupingScore, 190); assert.equal(auto.autoGroup, 'B'); assert.equal(auto.effectiveGroup, 'B');
  const override = hidden.createGroupingPreview({
    recent50Average: 200, recent12Average: 190, regularExpectedScore: 180, manualGroupingScore: null, manualGroup: 'C',
  });
  assert.equal(override.autoGroupingScore, 190); assert.equal(override.autoGroup, 'B');
  assert.equal(override.manualGroup, 'C'); assert.equal(override.effectiveGroup, 'C'); assert.equal(override.groupingSource, 'MANUAL_OVERRIDE');
});

test('regular expected average uses the latest thirty and requires twelve regular games', () => {
  assert.equal(hidden.regularExpectedAverage(Array.from({ length: 35 }, (_, index) => 135 - index)), 120.5);
  assert.equal(hidden.regularExpectedAverage(Array.from({ length: 29 }, () => 190)), 190);
  assert.equal(hidden.regularExpectedAverage(Array.from({ length: 12 }, () => 180)), 180);
  assert.equal(hidden.regularExpectedAverage(Array.from({ length: 11 }, () => 200)), null);
});

test('group assignment completes only when every attending member and guest has an effective group', () => {
  assert.deepEqual(hidden.groupAssignmentState([
    { effectiveGroup: 'A' }, { effectiveGroup: 'C' }, { effectiveGroup: 'E' },
  ]), { missingGroupCount: 0, groupAssignmentComplete: true });
  assert.deepEqual(hidden.groupAssignmentState([
    { effectiveGroup: 'A' }, { effectiveGroup: null }, { effectiveGroup: 'E' },
  ]), { missingGroupCount: 1, groupAssignmentComplete: false });
});

test('completed groups are public while temporary grouping remains manager-only', () => {
  const previews = [
    { participantKind: 'MEMBER', participantId: 'm1', memberId: 'm1', guestId: null, name: '회원', effectiveGroup: 'A' },
    { participantKind: 'GUEST', participantId: 'g1', memberId: null, guestId: 'g1', name: '게스트', effectiveGroup: 'E' },
  ];
  assert.equal(hidden.visibleGroupAssignments(previews, 'ATTENDANCE_OPEN', false), null);
  assert.equal(hidden.visibleGroupAssignments(previews, 'ATTENDANCE_OPEN', true).length, 2);
  assert.deepEqual(hidden.visibleGroupAssignments(previews, 'GROUPS_READY', false).map(item => item.effectiveGroup), ['A', 'E']);
});

test('automatic grouping fixtures enforce total fifty and regular twelve thresholds', async () => {
  const specifications = [
    { total: 60, regular: 35, score: index => 101 + index },
    { total: 50, regular: 12, score: () => 180 },
    { total: 50, regular: 29, score: () => 190 },
    { total: 50, regular: 11, score: () => 200 },
    { total: 49, regular: 20, score: () => 200 },
    { total: 50, regular: 12, score: () => 200 },
  ];
  const personalScores = specifications.flatMap((specification, userIndex) =>
    Array.from({ length: specification.total }, (_, index) => ({
      id: `u${userIndex + 1}-${String(index + 1).padStart(2, '0')}`,
      userId: `user-${userIndex + 1}`,
      score: specification.score(index),
      gameDate: new Date(Date.UTC(2026, 0, index + 1)),
      createdAt: new Date(Date.UTC(2026, 0, index + 1)),
      gameType: index < specification.regular ? '정기전' : '벙개',
      TeamEvent: null,
    })),
  );
  // These look like regular rows by label, but TEAM/EVENT competitions are explicitly excluded.
  personalScores.push({
    id: 'team-hidden', userId: 'user-2', score: 300,
    gameDate: new Date('2026-12-30'), createdAt: new Date('2026-12-30'),
    gameType: '정기전', TeamEvent: { competitionType: 'TEAM' },
  });
  personalScores.push({
    id: 'event-hidden', userId: 'user-3', score: 300,
    gameDate: new Date('2026-12-31'), createdAt: new Date('2026-12-31'),
    gameType: '정기전', TeamEvent: { competitionType: 'EVENT' },
  });
  const prisma = {
    teamSeason: { findFirst: async () => ({
      status: 'ACTIVE', individualPointsConfig: '{}', teamPointsConfig: '{}', eventPointsConfig: '{}',
    }) },
    teamEvent: { findFirst: async () => ({
      id: 'event-auto', eventDate: new Date('2026-09-22T00:00:00+09:00'), gameType: '정기전',
      competitionEnabled: true, competitionType: 'INDIVIDUAL', competitionMode: 'MINI',
      competitionStatus: 'DRAFT', rankPoints: '{}', guests: [], seasonPublications: [],
      team: { id: 'team-1', ownerId: 'owner', bowlerHiddenEnabled: true, User: [] },
      attendances: specifications.map((_, index) => ({
        memberId: `member-${index + 1}`, memberDisplayName: `회원${index + 1}`,
        manualGroupingScore: null, member: { userId: `user-${index + 1}` },
      })),
    }) },
    score: { findMany: async args => args.where.teamId ? [] : personalScores },
    leagueMatchupIndividualScore: { findMany: async () => [] },
    tournamentScore: { findMany: async () => [] },
  };
  const service = loadTs('src/lib/mobile-api/bowler-hidden.ts', { '@/lib/prisma': prisma });
  const result = await service.getBowlerHiddenCompetition('owner', 'team-1', 'event-auto');
  const [a, b, c, d, e, f] = result.participantPreview;
  assert.deepEqual(
    [a.recent50Average, a.recent12Average, a.regularExpectedScore, a.groupingScore],
    [135.5, 154.5, 120.5, 138.6],
  );
  assert.deepEqual([a.groupingSource, b.groupingSource, c.groupingSource], ['AUTO', 'AUTO', 'AUTO']);
  assert.equal(b.regularExpectedScore, 180);
  assert.equal(c.regularExpectedScore, 190);
  assert.deepEqual([d.groupingSource, d.ratingStatus], ['MANUAL_REQUIRED', 'DATA_INSUFFICIENT']);
  assert.equal(d.regularExpectedScore, null);
  assert.equal(e.recent50Average, null);
  assert.equal(e.groupingSource, 'MANUAL_REQUIRED');
  assert.deepEqual([f.gameSampleCount, f.regularExpectedScore, f.groupingSource], [50, 200, 'AUTO']);
});

test('event parser gates competitions and accepts implemented individual/team/event types', () => {
  const events = loadTs('src/lib/mobile-api/team-events.ts', {
    '@/lib/prisma': {}, '@/lib/mobile-api/bowler-hidden': hidden,
  });
  const body = {
    title: '개인전', date: '2026-09-22', time: '19:00', location: '볼링장', gameType: '정기전',
    attendanceEnabled: true, laneDrawEnabled: false, laneDrawMode: 'BULK',
    competitionEnabled: true, competitionType: 'INDIVIDUAL', competitionMode: 'OFFICIAL',
    rankPoints: [{ rank: 1, points: 20 }, { rank: 2, points: 17 }],
  };
  assert.throws(() => events.parseTeamEventInput(body, false), error => error.code === 'FEATURE_DISABLED');
  assert.deepEqual(events.parseTeamEventInput(body, true).rankPoints, [
    { rank: 1, points: 20 }, { rank: 2, points: 17 },
  ]);
  assert.equal(events.parseTeamEventInput({ ...body, laneDrawEnabled: true, competitionType: 'TEAM' }, true).competitionType, 'TEAM');
  assert.throws(() => events.parseTeamEventInput({ ...body, competitionType: 'TEAM' }, true),
    error => error.code === 'LANE_CONFIG_REQUIRED');
  const event = events.parseTeamEventInput({ ...body, competitionType: 'EVENT', competitionGameCount: 4 }, true);
  assert.equal(event.competitionType, 'EVENT');
  assert.equal(event.competitionGameCount, 4);
  assert.throws(() => events.parseTeamEventInput({ ...body, competitionType: 'EVENT', competitionGameCount: 0 }, true),
    error => error.code === 'INVALID_GAME_COUNT');
});

test('competition service derives totals and points with constant-batch record queries', async () => {
  const calls = { event: 0, eventScores: 0, personal: 0, league: 0, tournament: 0 };
  const prisma = {
    teamSeason: { findFirst: async () => ({
      status: 'ACTIVE', startDate: new Date('2026-01-01T00:00:00+09:00'),
      endDate: new Date('2026-12-31T23:59:59+09:00'),
      individualPointsConfig: '{"1":20,"2":17}', teamPointsConfig: '{}', eventPointsConfig: '{}',
    }) },
    teamEvent: { findFirst: async () => {
      calls.event += 1;
      return {
        id: 'event-1', eventDate: new Date('2026-09-22T00:00:00+09:00'), gameType: '정기전',
        competitionEnabled: true, competitionType: 'INDIVIDUAL', competitionMode: 'OFFICIAL', competitionStatus: 'DRAFT',
        rankPoints: '{"1":20,"2":17}',
        team: { id: 'team-1', ownerId: 'owner-1', bowlerHiddenEnabled: true, User: [] },
        attendances: [
          { memberId: 'member-a', memberDisplayName: '가', member: { userId: 'user-a' } },
          { memberId: 'member-b', memberDisplayName: '나', member: { userId: 'user-b' } },
        ],
        guests: [],
      };
    } },
    score: { findMany: async args => {
      if (args.where.teamId) {
        calls.eventScores += 1;
        return [
          { id: 'a1', userId: 'user-a', score: 200 }, { id: 'a2', userId: 'user-a', score: 210 },
          { id: 'b1', userId: 'user-b', score: 190 }, { id: 'b2', userId: 'user-b', score: 180 },
        ];
      }
      calls.personal += 1;
      return [
        { id: 'pa', userId: 'user-a', score: 200, gameDate: new Date('2026-09-21'), createdAt: new Date('2026-09-21') },
      ];
    } },
    leagueMatchupIndividualScore: { findMany: async () => { calls.league += 1; return []; } },
    tournamentScore: { findMany: async () => { calls.tournament += 1; return []; } },
  };
  const service = loadTs('src/lib/mobile-api/bowler-hidden.ts', { '@/lib/prisma': prisma });
  const result = await service.getBowlerHiddenCompetition('owner-1', 'team-1', 'event-1');
  assert.deepEqual(result.overall.map(row => [row.rank, row.name, row.total, row.points]), [
    [1, '가', 410, 20], [2, '나', 370, 17],
  ]);
  assert.equal(result.participantPreview.length, 2);
  assert.equal(result.participantPreview[0].expectedScore, null);
  assert.deepEqual(calls, { event: 1, eventScores: 1, personal: 1, league: 1, tournament: 1 });
});

test('manual grouping permits managers and same-event captains while preserving event/team scope', async () => {
  const updates = [];
  const baseEvent = {
    draftGeneration: 1, competitionEnabled: true,
    team: {
      ownerId: 'owner', bowlerHiddenEnabled: true, User: [{ id: 'manager' }],
      members: [{ id: 'captain-member' }],
    },
    attendances: [{ memberId: 'target-member' }], guests: [{ id: 'guest-1' }],
    competitionTeams: [{
      generation: 1, captainMemberId: 'captain-member',
      participants: [{ memberId: 'target-member' }],
    }],
  };
  let actor = 'owner';
  const prisma = {
    teamEvent: { findFirst: async args => {
      assert.equal(args.where.id, 'event-1'); assert.equal(args.where.teamId, 'team-1');
      const event = structuredClone(baseEvent);
      event.team.members = actor === 'captain' ? [{ id: 'captain-member' }] : [{ id: `member-${actor}` }];
      return event;
    } },
    teamEventAttendance: { updateMany: async args => { updates.push(args); return { count: 1 }; } },
    teamEventGuest: { updateMany: async args => { updates.push(args); return { count: 1 }; } },
  };
  const service = loadTs('src/lib/mobile-api/bowler-hidden.ts', { '@/lib/prisma': prisma });
  await service.updateBowlerHiddenCompetition('owner', 'team-1', 'event-1', {
    action: 'SET_MANUAL_GROUP', participantKind: 'MEMBER', participantId: 'target-member', manualGroup: 'A',
  });
  actor = 'manager';
  await service.updateBowlerHiddenCompetition('manager', 'team-1', 'event-1', {
    action: 'SET_MANUAL_GROUP', participantKind: 'GUEST', participantId: 'guest-1', manualGroup: 'B',
  });
  actor = 'captain';
  await service.updateBowlerHiddenCompetition('captain', 'team-1', 'event-1', {
    action: 'SET_MANUAL_GROUP', participantKind: 'MEMBER', participantId: 'target-member', manualGroup: 'C',
  });
  assert.equal(updates.length, 3);
  assert.deepEqual(updates.map(item => item.data.manualGroup), ['A', 'B', 'C']);

  actor = 'ordinary';
  await assert.rejects(() => service.updateBowlerHiddenCompetition('ordinary', 'team-1', 'event-1', {
    action: 'SET_MANUAL_GROUP', participantKind: 'MEMBER', participantId: 'target-member', manualGroup: 'D',
  }), error => error.code === 'FORBIDDEN');
  actor = 'captain';
  await assert.rejects(() => service.updateBowlerHiddenCompetition('captain', 'team-1', 'event-1', {
    action: 'SET_MANUAL_GROUP', participantKind: 'GUEST', participantId: 'guest-1', manualGroup: 'D',
  }), error => error.code === 'FORBIDDEN');
  await assert.rejects(() => service.updateBowlerHiddenCompetition('owner', 'team-1', 'event-1', {
    action: 'SET_MANUAL_GROUP', participantKind: 'MEMBER', participantId: 'target-member', manualGroup: 'F',
  }), error => error.code === 'INVALID_MANUAL_GROUP');
});

test('group completion is independent from scores while publication requires exact event member and guest games', async () => {
  const event = {
    id: 'event-1', teamId: 'team-1', title: '개인전', eventDate: new Date('2026-09-26T00:00:00+09:00'),
    seasonId: null, seasonPublicationRevision: 1, gameType: '정기전', competitionEnabled: true,
    competitionType: 'INDIVIDUAL', competitionMode: 'MINI', competitionStatus: 'GROUPS_READY', competitionGameCount: 2,
    team: { ownerId: 'owner', bowlerHiddenEnabled: true, User: [] },
    attendances: [{ status: 'ATTENDING', memberDisplayName: '회원', manualGroup: 'A', member: {
      id: 'member-1', userId: 'user-1', alias: null, user: { name: '회원' },
    } }],
    guests: [{ id: 'guest-1', name: '게스트', manualGroup: 'E' }],
  };
  let scoreRows = [];
  const tx = {
    teamEvent: {
      findFirst: async args => {
        assert.equal(args.where.id, 'event-1');
        return event;
      },
      updateMany: async () => ({ count: 1 }),
    },
    score: { findMany: async args => {
      assert.equal(args.where.teamEventId, 'event-1');
      return scoreRows;
    } },
  };
  const prisma = {
    teamEvent: { findFirst: async () => event },
    $transaction: async callback => callback(tx),
  };
  const service = loadTs('src/lib/mobile-api/bowler-hidden.ts', {
    '@/lib/prisma': prisma,
    '@/lib/mobile-api/unified-season': {
      getPublicationPointTable: async () => [], getSeasonPointPreview: async () => [],
      createSeasonPointPublication: async () => ({ seasonId: null, publicationId: null }),
      revokeSeasonPointPublication: async () => {}, readSeasonPointTable: () => [], seasonPointsForRank: () => 0,
    },
  });
  await assert.rejects(
    () => service.updateBowlerHiddenCompetition('owner', 'team-1', 'event-1', { action: 'PUBLISH' }),
    error => error.code === 'SCORES_INCOMPLETE' && /경기 점수/.test(error.message),
  );
  scoreRows = [
    { userId: 'user-1', teamEventGuestId: null, score: 200 },
    { userId: 'user-1', teamEventGuestId: null, score: 210 },
    { userId: null, teamEventGuestId: 'guest-1', score: 180 },
    { userId: null, teamEventGuestId: 'guest-1', score: 190 },
  ];
  const result = await service.updateBowlerHiddenCompetition('owner', 'team-1', 'event-1', { action: 'PUBLISH' });
  assert.equal(result.status, 'PUBLISHED');
});

test('migration is additive and defaults all existing teams to off', () => {
  const sql = fs.readFileSync(path.resolve(__dirname,
    '../prisma/migrations/20260922210000_add_bowler_hidden_competitions/migration.sql'), 'utf8');
  assert.match(sql, /bowlerHiddenEnabled.*NOT NULL DEFAULT false/i);
  assert.doesNotMatch(sql, /DROP TABLE|DELETE FROM|\bUPDATE\s+"/i);
});

test('feature flag mutation requires both session and current database SUPER_ADMIN role', async () => {
  let updates = 0;
  const loadAdmin = (sessionRole, databaseRole) => loadTs('src/app/actions/admin.ts', {
    '@/auth': { auth: async () => ({ user: { id: 'stable-user-id', role: sessionRole } }) },
    '@/lib/prisma': {
      user: { findUnique: async args => {
        assert.deepEqual(args.where, { id: 'stable-user-id' });
        return { role: databaseRole };
      } },
      team: { update: async args => { updates += 1; return args; } },
    },
    'next/cache': { revalidatePath: () => {} },
  });
  await assert.rejects(() => loadAdmin('USER', 'SUPER_ADMIN').setTeamBowlerHiddenEnabled('team-1', true), /Unauthorized/);
  await assert.rejects(() => loadAdmin('SUPER_ADMIN', 'USER').setTeamBowlerHiddenEnabled('team-1', true), /Unauthorized/);
  await loadAdmin('SUPER_ADMIN', 'SUPER_ADMIN').setTeamBowlerHiddenEnabled('team-1', true);
  assert.equal(updates, 1);
});

test('user deletion protects database SUPER_ADMIN identities without email or display-name checks', async () => {
  const loadAdmin = target => {
    const deletedIds = [];
    const admin = loadTs('src/app/actions/admin.ts', {
      '@/auth': { auth: async () => ({ user: { id: 'stable-admin-id', role: 'SUPER_ADMIN' } }) },
      '@/lib/prisma': {
        user: {
          findUnique: async args => args.where.id === 'stable-admin-id' ? { role: 'SUPER_ADMIN' } : target,
          delete: async args => { deletedIds.push(args.where.id); },
        },
      },
      'next/cache': { revalidatePath: () => {} },
    });
    return { admin, deletedIds };
  };

  let current = loadAdmin({ id: 'protected-admin-id', email: 'admin@phase3.invalid', name: 'ordinary', role: 'SUPER_ADMIN' });
  await assert.rejects(() => current.admin.deleteUser('protected-admin-id'), /Cannot delete Super Admin/);
  assert.deepEqual(current.deletedIds, []);

  current = loadAdmin({ id: 'ordinary-user-id', email: 'sangdy85', name: 'SUPER_ADMIN', role: 'USER' });
  await current.admin.deleteUser('ordinary-user-id');
  assert.deepEqual(current.deletedIds, ['ordinary-user-id']);
});

test('competition route requires authentication and preserves actor path scope', async () => {
  let call = null;
  const route = loadTs('src/app/api/mobile/v1/teams/[teamId]/events/[eventId]/competition/route.ts', {
    '@/lib/mobile-api/auth': { getMobileApiUserId: async request => request.headers.get('x-user') },
    '@/lib/mobile-api/bowler-hidden': {
      BowlerHiddenError: hidden.BowlerHiddenError,
      getBowlerHiddenCompetition: async (userId, teamId, eventId) => {
        call = { userId, teamId, eventId }; return { enabled: true };
      },
    },
  });
  const context = { params: Promise.resolve({ teamId: 'team-1', eventId: 'event-1' }) };
  assert.equal((await route.GET(new Request('https://example.test'), context)).status, 401);
  assert.equal(call, null);
  const response = await route.GET(new Request('https://example.test', { headers: { 'x-user': 'user-1' } }), context);
  assert.equal(response.status, 200);
  assert.deepEqual(call, { userId: 'user-1', teamId: 'team-1', eventId: 'event-1' });
});
