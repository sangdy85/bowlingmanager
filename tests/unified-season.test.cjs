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

const season = {
  id: 'season-2026', teamId: 'team-a', name: '2026 시즌', enabled: true, status: 'ACTIVE',
  startDate: new Date('2025-12-31T15:00:00.000Z'), endDate: new Date('2026-12-31T14:59:59.999Z'),
  scoringMode: 'FULL_RANK', pointsConfig: '[50,40,30]',
  individualPointsConfig: '{"1":50,"2":40,"3":30}',
  teamPointsConfig: '{"1":35,"2":20,"3":10}',
  eventPointsConfig: '{"1":50,"2":40,"3":30}',
};

test('season point tables are independent, validated and preserve legacy arrays', () => {
  const service = loadTs('src/lib/mobile-api/unified-season.ts', { '@/lib/prisma': {} });
  assert.deepEqual(service.readSeasonPointTable('[5,3,1]'), [
    { rank: 1, points: 5 }, { rank: 2, points: 3 }, { rank: 3, points: 1 },
  ]);
  assert.deepEqual(service.readSeasonPointTable(season.teamPointsConfig), [
    { rank: 1, points: 35 }, { rank: 2, points: 20 }, { rank: 3, points: 10 },
  ]);
  assert.throws(
    () => service.serializeSeasonPointTable([{ rank: 1, points: 5 }, { rank: 1, points: 3 }]),
    error => error.code === 'INVALID_POINT_TABLE',
  );
});

test('member season awards exclude guests and recalculate member-only ranks', () => {
  const service = loadTs('src/lib/mobile-api/unified-season.ts', { '@/lib/prisma': {} });
  assert.deepEqual(service.memberSeasonAwards([
    { memberId: null, name: '게스트 1' },
    { memberId: 'member-a', name: '회원 A' },
    { memberId: null, name: '게스트 2' },
    { memberId: 'member-b', name: '회원 B' },
  ], [{ rank: 1, points: 50 }, { rank: 2, points: 30 }]), [
    { memberId: 'member-a', memberDisplayName: '회원 A', competitionTeamId: null, finalRank: 1, points: 50 },
    { memberId: 'member-b', memberDisplayName: '회원 B', competitionTeamId: null, finalRank: 2, points: 30 },
  ]);
});

test('MINI publish never creates a season publication or zero-point ledger', async () => {
  const service = loadTs('src/lib/mobile-api/unified-season.ts', { '@/lib/prisma': {} });
  let writes = 0;
  const db = {
    teamSeason: { findFirst: async () => { throw new Error('MINI must not resolve a season'); } },
    teamEvent: {},
    seasonPointPublication: { findFirst: async () => { writes += 1; }, create: async () => { writes += 1; } },
    seasonPointEntry: { createMany: async () => { writes += 1; } },
  };
  const result = await service.createSeasonPointPublication(db, {
    event: { id: 'mini-1', teamId: 'team-a', title: '미니 개인전', eventDate: new Date(), seasonId: null, competitionType: 'INDIVIDUAL', competitionMode: 'MINI', seasonPublicationRevision: 1 },
    pointTable: [], awards: [{ memberId: 'member-1', memberDisplayName: '회원', finalRank: 1, points: 0 }], resultSnapshot: {}, publishedAt: new Date(),
  });
  assert.equal(result.pointsAwarded, false);
  assert.equal(result.publicationId, null);
  assert.equal(writes, 0);
});

test('MINI preview has no season point table while competition result engines remain usable', async () => {
  const service = loadTs('src/lib/mobile-api/unified-season.ts', { '@/lib/prisma': {} });
  const points = await service.getSeasonPointPreview({
    teamSeason: { findFirst: async () => { throw new Error('MINI must not resolve a season'); } },
    teamEvent: {},
  }, {
    teamId: 'team-a', seasonId: null, competitionType: 'TEAM', competitionMode: 'MINI',
    eventDate: new Date('2026-06-10T03:00:00.000Z'),
  });
  assert.deepEqual(points, []);
  assert.equal(service.seasonPointsForRank(points, 1), 0);
});

test('missing competition mode cannot silently create official season points', async () => {
  const service = loadTs('src/lib/mobile-api/unified-season.ts', { '@/lib/prisma': {} });
  await assert.rejects(() => service.createSeasonPointPublication({}, {
    event: { id: 'legacy-1', teamId: 'team-a', title: '미지정', eventDate: new Date(), seasonId: null, competitionType: 'INDIVIDUAL', competitionMode: null, seasonPublicationRevision: 1 },
    pointTable: [], awards: [], resultSnapshot: {}, publishedAt: new Date(),
  }), error => error.code === 'COMPETITION_MODE_REQUIRED');
});

test('unpublished preview selects the active season type table without mutating the event', async () => {
  let eventWrites = 0;
  const service = loadTs('src/lib/mobile-api/unified-season.ts', { '@/lib/prisma': {} });
  const points = await service.getSeasonPointPreview({
    teamSeason: { findFirst: async args => {
      assert.equal(args.where.teamId, 'team-a');
      return season;
    } },
    teamEvent: { update: async () => { eventWrites += 1; } },
  }, {
    teamId: 'team-a', seasonId: null, competitionType: 'TEAM',
    eventDate: new Date('2026-06-10T03:00:00.000Z'),
  });
  assert.deepEqual(points, [
    { rank: 1, points: 35 }, { rank: 2, points: 20 }, { rank: 3, points: 10 },
  ]);
  assert.equal(eventWrites, 0);
});

test('season total ranking uses competition joint ranks 1, 1, 3', () => {
  const service = loadTs('src/lib/mobile-api/unified-season.ts', { '@/lib/prisma': {} });
  const ranked = service.jointCompetitionRanks([
    { id: 'a', totalPoints: 105 },
    { id: 'b', totalPoints: 105 },
    { id: 'c', totalPoints: 90 },
  ]);
  assert.deepEqual(ranked.map(row => row.rank), [1, 1, 3]);
});

test('ranking batches mixed ledgers, multiple monthly events and zero points without private identities', async () => {
  let entryCalls = 0;
  const entries = [
    entry('i-1', 'member-a', 'INDIVIDUAL', '2026-02-05T03:00:00.000Z', 3, 30),
    entry('t-1', 'member-a', 'TEAM', '2026-01-10T03:00:00.000Z', 3, 10),
    entry('i-2', 'member-a', 'INDIVIDUAL', '2026-03-03T03:00:00.000Z', 1, 50),
    entry('t-2', 'member-a', 'TEAM', '2026-04-10T03:00:00.000Z', 2, 15),
    entry('e-1', 'member-b', 'EVENT', '2026-03-12T03:00:00.000Z', 1, 50),
    entry('e-2', 'member-b', 'EVENT', '2026-03-20T03:00:00.000Z', 4, 0),
  ];
  const fakePrisma = {
    team: { findFirst: async args => {
      assert.equal(args.where.members.some.userId, 'viewer');
      return {
        id: 'team-a', bowlerHiddenEnabled: true, seasonRankingEnabled: true,
        members: [member('member-a', 'A'), member('member-b', 'B'), member('member-c', 'C')],
      };
    } },
    teamSeason: { findMany: async args => {
      assert.equal(args.where.teamId, 'team-a');
      return [season, { ...season, id: 'season-2025', name: '2025 시즌', status: 'COMPLETED' }];
    } },
    seasonPointEntry: { findMany: async args => {
      entryCalls += 1;
      assert.equal(args.where.seasonId, season.id);
      assert.deepEqual(args.where.publication, { revokedAt: null });
      return entries;
    } },
    seasonPointAdjustment: { findMany: async args => {
      assert.equal(args.where.seasonId, season.id);
      return [{
        id: 'adjustment-1', memberId: 'member-b', delta: 70,
        reason: '운영 보정', createdAt: new Date('2026-03-25T03:00:00.000Z'),
      }];
    } },
  };
  const service = loadTs('src/lib/mobile-api/unified-season.ts', { '@/lib/prisma': fakePrisma });
  const result = await service.getUnifiedSeasonRanking('viewer', 'team-a');
  const a = result.rankings.find(row => row.id === 'member-a');
  const b = result.rankings.find(row => row.id === 'member-b');
  const c = result.rankings.find(row => row.id === 'member-c');
  assert.equal(entryCalls, 1);
  assert.deepEqual(
    { total: a.totalPoints, individual: a.individualPoints, team: a.teamPoints, event: a.eventPoints },
    { total: 105, individual: 80, team: 25, event: 0 },
  );
  assert.equal(b.totalPoints, 120);
  assert.equal(b.adjustmentPoints, 70);
  assert.equal(b.monthlyHistory[2].length, 3);
  assert.equal(b.entries.at(-1).sourceType, 'MANUAL_ADJUSTMENT');
  assert.equal(b.entries.at(-1).reason, '운영 보정');
  assert.equal(c.totalPoints, 0);
  assert.deepEqual(result.rankings.map(row => [row.id, row.rank]), [
    ['member-b', 1], ['member-a', 2], ['member-c', 3],
  ]);
  for (const row of result.rankings) {
    assert.equal(Object.hasOwn(row, 'userId'), false);
    assert.equal(Object.hasOwn(row, 'email'), false);
  }
});

test('exact unified season fixture totals 50 + 20 + 30 while MINI contributes no ledger or monthly points', async () => {
  const service = loadTs('src/lib/mobile-api/unified-season.ts', { '@/lib/prisma': {} });
  let miniWrites = 0;
  const miniResult = await service.createSeasonPointPublication({
    teamSeason: { findFirst: async () => { throw new Error('MINI must not resolve a season'); } },
    teamEvent: {},
    seasonPointPublication: { findFirst: async () => { miniWrites += 1; }, create: async () => { miniWrites += 1; } },
    seasonPointEntry: { createMany: async () => { miniWrites += 1; } },
  }, {
    event: {
      id: 'mini-individual', teamId: 'team-a', title: 'MINI 개인전',
      eventDate: new Date('2026-04-01T03:00:00.000Z'), seasonId: null,
      competitionType: 'INDIVIDUAL', competitionMode: 'MINI', seasonPublicationRevision: 1,
    },
    pointTable: [{ rank: 1, points: 999 }],
    awards: [{ memberId: 'member-a', memberDisplayName: 'A', finalRank: 1, points: 999 }],
    resultSnapshot: {}, publishedAt: new Date('2026-04-01T04:00:00.000Z'),
  });
  assert.equal(miniResult.pointsAwarded, false);
  assert.equal(miniWrites, 0);

  const officialEntries = [
    entry('individual-50', 'member-a', 'INDIVIDUAL', '2026-01-10T03:00:00.000Z', 1, 50),
    entry('team-20', 'member-a', 'TEAM', '2026-02-10T03:00:00.000Z', 2, 20),
    entry('event-30', 'member-a', 'EVENT', '2026-03-10T03:00:00.000Z', 3, 30),
  ];
  const rankingService = loadTs('src/lib/mobile-api/unified-season.ts', {
    '@/lib/prisma': {
      team: { findFirst: async () => ({
        id: 'team-a', bowlerHiddenEnabled: true, seasonRankingEnabled: true,
        members: [member('member-a', 'A')],
      }) },
      teamSeason: { findMany: async () => [season] },
      seasonPointEntry: { findMany: async () => officialEntries },
      seasonPointAdjustment: { findMany: async () => [] },
    },
  });
  const result = await rankingService.getUnifiedSeasonRanking('viewer', 'team-a');
  const memberA = result.rankings[0];
  assert.deepEqual({
    total: memberA.totalPoints,
    individual: memberA.individualPoints,
    team: memberA.teamPoints,
    event: memberA.eventPoints,
  }, { total: 100, individual: 50, team: 20, event: 30 });
  assert.equal(memberA.monthlyHistory.flat().reduce((sum, item) => sum + item.points, 0), 100);
  assert.equal(new Set(officialEntries.map(item => item.id)).size, officialEntries.length);
});

test('competition type and season filters remain isolated', async () => {
  let where = null;
  const fakePrisma = {
    team: { findFirst: async () => ({
      id: 'team-a', bowlerHiddenEnabled: true, seasonRankingEnabled: true,
      members: [member('member-a', 'A')],
    }) },
    teamSeason: { findMany: async () => [season] },
    seasonPointEntry: { findMany: async args => { where = args.where; return []; } },
    seasonPointAdjustment: { findMany: async () => [] },
  };
  const service = loadTs('src/lib/mobile-api/unified-season.ts', { '@/lib/prisma': fakePrisma });
  await service.getUnifiedSeasonRanking('viewer', 'team-a', {
    seasonId: season.id, competitionType: 'TEAM',
  });
  assert.equal(where.seasonId, season.id);
  assert.equal(where.competitionType, 'TEAM');
  await assert.rejects(
    service.getUnifiedSeasonRanking('viewer', 'team-a', { seasonId: 'another-team-season' }),
    error => error.code === 'SEASON_NOT_FOUND',
  );
});

test('publication is idempotent, snapshots rules and distributes one ledger row per member', async () => {
  let existing = null;
  let publicationCreates = 0;
  let entryPayload = null;
  const db = {
    teamSeason: { findFirst: async () => season },
    teamEvent: { update: async () => ({}) },
    seasonPointPublication: {
      findFirst: async () => existing,
      create: async args => { publicationCreates += 1; existing = { id: 'publication-1' }; return { id: 'publication-1', ...args.data }; },
      updateMany: async () => ({ count: 1 }),
    },
    seasonPointEntry: { createMany: async args => { entryPayload = args.data; return { count: args.data.length }; } },
  };
  const service = loadTs('src/lib/mobile-api/unified-season.ts', { '@/lib/prisma': {} });
  const input = {
    event: {
      id: 'event-1', teamId: 'team-a', title: '4월 TEAM',
      eventDate: new Date('2026-04-10T03:00:00.000Z'), seasonId: season.id,
      competitionType: 'TEAM', competitionMode: 'OFFICIAL', seasonPublicationRevision: 1,
    },
    pointTable: [{ rank: 1, points: 35 }, { rank: 2, points: 20 }],
    awards: [
      { memberId: 'member-a', memberDisplayName: 'A', competitionTeamId: 'red', finalRank: 2, points: 20 },
      { memberId: 'member-b', memberDisplayName: 'B', competitionTeamId: 'red', finalRank: 2, points: 20 },
    ],
    resultSnapshot: { version: 1, teams: [{ id: 'red', rank: 2 }] },
    publishedAt: new Date('2026-04-10T04:00:00.000Z'),
  };
  const first = await service.createSeasonPointPublication(db, input);
  const second = await service.createSeasonPointPublication(db, input);
  assert.equal(first.alreadyPublished, false);
  assert.equal(second.alreadyPublished, true);
  assert.equal(publicationCreates, 1);
  assert.equal(entryPayload.length, 2);
  assert.deepEqual(entryPayload.map(row => [row.memberId, row.points]), [
    ['member-a', 20], ['member-b', 20],
  ]);
});

test('reopen revokes active publication and source revisions preserve republish audit history', async () => {
  let args = null;
  const service = loadTs('src/lib/mobile-api/unified-season.ts', { '@/lib/prisma': {} });
  await service.revokeSeasonPointPublication({
    seasonPointPublication: { updateMany: async value => { args = value; return { count: 1 }; } },
  }, 'event-1', new Date('2026-05-01T00:00:00.000Z'));
  assert.deepEqual(args.where, { eventId: 'event-1', revokedAt: null });
  const schema = fs.readFileSync(path.resolve(__dirname, '../prisma/schema.prisma'), 'utf8');
  const migration = fs.readFileSync(
    path.resolve(__dirname, '../prisma/migrations/20260922230000_add_unified_season_ranking/migration.sql'),
    'utf8',
  );
  assert.match(schema, /@@unique\(\[seasonId, sourceKey, revision\]\)/);
  assert.match(schema, /@@unique\(\[publicationId, memberId\]\)/);
  assert.match(migration, /seasonPublicationRevision/);
  assert.match(migration, /revokedAt/);
  assert.match(migration, /SeasonPointPublication_active_source_key/);
  assert.doesNotMatch(migration, /DROP\s+TABLE|DELETE\s+FROM/i);
});

test('all three competition publish paths use the unified ledger lifecycle', () => {
  const individual = fs.readFileSync(path.resolve(__dirname, '../src/lib/mobile-api/bowler-hidden.ts'), 'utf8');
  const team = fs.readFileSync(path.resolve(__dirname, '../src/lib/mobile-api/team-competition.ts'), 'utf8');
  const event = fs.readFileSync(path.resolve(__dirname, '../src/lib/mobile-api/event-competition.ts'), 'utf8');
  for (const source of [individual, team, event]) {
    assert.match(source, /createSeasonPointPublication/);
    assert.match(source, /revokeSeasonPointPublication/);
    assert.match(source, /action === "PUBLISH"|case "PUBLISH"/);
    assert.match(source, /action === "REOPEN"|case "REOPEN"/);
  }
  assert.match(team, /competitionTeamId/);
  assert.match(event, /seasonPointsForRank/);
});

function member(id, name) {
  return { id, alias: name, user: { name: `private-${name}` } };
}

function entry(id, memberId, competitionType, date, finalRank, points) {
  return {
    id, publicationId: `publication-${id}`, eventId: `event-${id}`, memberId,
    memberDisplayName: memberId, competitionType, competitionDate: new Date(date),
    competitionTitle: `${competitionType}-${id}`, finalRank, points, createdAt: new Date(date),
  };
}
