// Synthetic fixtures only. No database, network, or production access.
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
  const localRequire = id => Object.hasOwn(overrides, id) ? overrides[id]
    : id.startsWith('@/') ? loadTs(`src/${id.slice(2)}.ts`, overrides, cache) : nativeRequire(id);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  new Function('require', 'module', 'exports', compiled)(localRequire, module, module.exports);
  return module.exports;
}

const season = (overrides = {}) => ({
  id: 'season-a', teamId: 'team-a', name: '2026 시즌',
  startDate: new Date('2025-12-31T15:00:00.000Z'),
  endDate: new Date('2026-12-31T14:59:59.999Z'),
  enabled: true, status: 'ACTIVE', scoringMode: 'FULL_RANK', pointsConfig: '[5,3,1]',
  individualPointsConfig: '{"1":50}', teamPointsConfig: '{"1":30}', eventPointsConfig: '{"1":20}',
  rankingMode: 'DATA', createdAt: new Date(), updatedAt: new Date(), ...overrides,
});

test('season lifecycle distinguishes upcoming, active, ended and uses date overlap', () => {
  const api = loadTs('src/lib/mobile-api/season-lifecycle.ts');
  const now = new Date('2026-06-01T00:00:00.000Z');
  assert.equal(api.seasonLifecycleStatus(season(), now), 'ACTIVE');
  assert.equal(api.seasonLifecycleStatus(season({ startDate: new Date('2027-01-01'), endDate: new Date('2027-12-31'), status: 'DRAFT' }), now), 'UPCOMING');
  assert.equal(api.seasonLifecycleStatus(season({ endDate: new Date('2025-12-31') }), now), 'ENDED');
  assert.equal(api.seasonLifecycleStatus(season({ status: 'COMPLETED' }), now), 'ENDED');
  assert.equal(api.seasonOverlapsYear(season({ startDate: new Date('2026-09-30T15:00:00Z'), endDate: new Date('2027-03-31T14:59:59Z') }), 2027), true);
});

test('inclusive year overlap includes every boundary-spanning season and excludes adjacent years', () => {
  const api = loadTs('src/lib/mobile-api/season-lifecycle.ts');
  const date = value => new Date(`${value}T00:00:00+09:00`);
  const fixtures = [
    ['A', '2025-01-01', '2025-04-30', true],
    ['B', '2025-05-01', '2025-08-31', true],
    ['C', '2025-09-01', '2025-12-31', true],
    ['D', '2024-09-01', '2025-08-31', true],
    ['E', '2024-01-01', '2024-12-31', false],
    ['F', '2026-01-01', '2026-12-31', false],
    ['G', '2025-12-31', '2026-06-30', true],
    ['H', '2024-06-01', '2025-01-01', true],
  ];
  assert.deepEqual(
    fixtures.filter(([, start, end]) => api.seasonOverlapsYear({ startDate: date(start), endDate: date(end) }, 2025)).map(([id]) => id),
    ['A', 'B', 'C', 'D', 'G', 'H'],
  );
});

test('season history applies the shared inclusive year filter to Prisma', async () => {
  let receivedWhere = null;
  const fake = {
    team: { findFirst: async () => ({ id: 'team-a', ownerId: 'owner', bowlerHiddenEnabled: true, seasonRankingEnabled: true, User: [] }) },
    teamSeason: { findMany: async args => { receivedWhere = args.where; return []; } },
  };
  const api = loadTs('src/lib/mobile-api/season-history.ts', {
    '@/lib/prisma': fake,
    '@/lib/mobile-api/club-expansion': { getMobileSeasonRanking: async () => ({ rankings: [] }) },
    '@/lib/mobile-api/unified-season': { serializeSeasonPointTable: () => '{}', serializeSeasonSummary: value => value },
  });
  await api.listTeamSeasons('owner', 'team-a', new Date(), 2025);
  assert.equal(receivedWhere.teamId, 'team-a');
  assert.equal(receivedWhere.startDate.lte.toISOString(), '2025-12-31T14:59:59.999Z');
  assert.equal(receivedWhere.endDate.gte.toISOString(), '2024-12-31T15:00:00.000Z');
});

test('final ranking migration is additive and preserves snapshot identity', () => {
  const sql = fs.readFileSync(path.resolve(__dirname, '../prisma/migrations/20260928120000_add_multi_season_final_rankings/migration.sql'), 'utf8');
  assert.match(sql, /CREATE TABLE "SeasonFinalRanking"/);
  assert.match(sql, /CREATE TABLE "SeasonFinalRankingEntry"/);
  assert.match(sql, /"displayName" TEXT NOT NULL/);
  assert.match(sql, /ON DELETE SET NULL/);
  assert.match(sql, /SeasonFinalRanking_seasonId_revision_key/);
  assert.doesNotMatch(sql, /^\s*(DROP TABLE|DELETE FROM|UPDATE )/im);
});

test('season creation rejects overlap and preserves previous seasons', async () => {
  let created = null;
  const teamSeason = {
    findFirst: async args => args.where?.startDate ? { id: 'old', name: '기존 시즌' } : season(),
    create: async args => { created = args.data; return season({ id: 'new', ...args.data }); },
  };
  const fake = {
    team: { findFirst: async () => ({ id: 'team-a', ownerId: 'owner', bowlerHiddenEnabled: true, seasonRankingEnabled: true, User: [] }) },
    $transaction: async callback => callback({ teamSeason }),
  };
  const api = loadTs('src/lib/mobile-api/season-history.ts', {
    '@/lib/prisma': fake,
    '@/lib/mobile-api/club-expansion': { getMobileSeasonRanking: async () => ({ rankings: [] }) },
    '@/lib/mobile-api/unified-season': {
      serializeSeasonPointTable: rows => JSON.stringify(Object.fromEntries(rows.map(row => [row.rank, row.points]))),
      serializeSeasonSummary: value => ({ id: value.id, name: value.name, startDate: '2026-01-01', endDate: '2026-12-31', status: value.status, rankingMode: value.rankingMode }),
    },
  });
  await assert.rejects(
    api.createTeamSeason('owner', 'team-a', { name: '겹침', startDate: '2026-06-01', endDate: '2027-01-01', rankingMode: 'DATA' }),
    error => error.code === 'SEASON_DATE_OVERLAP' && error.status === 409,
  );
  assert.equal(created, null);
});

test('season creation validates calendar dates and creates an independent upcoming season atomically', async () => {
  const createdRows = [];
  const teamSeason = {
    findFirst: async args => args.where?.startDate ? null : season({ name: '2026 시즌' }),
    create: async args => {
      createdRows.push(args.data);
      return season({ id: 'season-2027', ...args.data });
    },
  };
  const fake = {
    team: { findFirst: async () => ({ id: 'team-a', ownerId: 'owner', bowlerHiddenEnabled: true, seasonRankingEnabled: true, User: [] }) },
    $transaction: async callback => callback({ teamSeason }),
  };
  const api = loadTs('src/lib/mobile-api/season-history.ts', {
    '@/lib/prisma': fake,
    '@/lib/mobile-api/club-expansion': { getMobileSeasonRanking: async () => ({ rankings: [] }) },
    '@/lib/mobile-api/unified-season': {
      serializeSeasonPointTable: rows => JSON.stringify(Object.fromEntries(rows.map(row => [row.rank, row.points]))),
      serializeSeasonSummary: value => ({ id: value.id, name: value.name, status: value.status, rankingMode: value.rankingMode }),
    },
  });
  await assert.rejects(
    api.createTeamSeason('owner', 'team-a', { name: '잘못된 날짜', startDate: '2027-02-30', endDate: '2027-12-31' }),
    error => error.code === 'INVALID_SEASON',
  );
  const result = await api.createTeamSeason(
    'owner', 'team-a',
    { name: '2027 시즌', startDate: '2027-01-01', endDate: '2027-12-31', rankingMode: 'DATA' },
    new Date('2026-09-28T00:00:00Z'),
  );
  assert.equal(result.id, 'season-2027');
  assert.equal(result.lifecycleStatus, 'UPCOMING');
  assert.equal(createdRows.length, 1);
  assert.equal(createdRows[0].status, 'DRAFT');
  assert.equal(createdRows[0].teamId, 'team-a');
});

test('DATA finalization supports rank override, immutable points and revision history', async () => {
  let revision = 0;
  const snapshots = [];
  const fake = {
    team: { findFirst: async () => ({ id: 'team-a', ownerId: 'owner', bowlerHiddenEnabled: true, seasonRankingEnabled: true, User: [] }) },
    teamSeason: { findFirst: async () => season() },
    $transaction: async callback => callback({
      seasonFinalRanking: {
        findFirst: async () => revision === 0 ? null : { revision },
        create: async args => {
          revision = args.data.revision;
          snapshots.push(args.data.entries.create);
          return {
            id: `final-${revision}`, revision, rankingMode: 'DATA', finalizedAt: new Date('2027-01-02T00:00:00Z'),
            finalizedBy: { id: 'owner', name: '관리자' },
            entries: args.data.entries.create.map((entry, index) => ({ id: `entry-${revision}-${index}`, ...entry })),
          };
        },
      },
      teamSeason: { update: async () => ({}) },
    }),
  };
  const api = loadTs('src/lib/mobile-api/season-history.ts', {
    '@/lib/prisma': fake,
    '@/lib/mobile-api/club-expansion': { getMobileSeasonRanking: async () => ({ rankings: [
      { id: 'member-a', name: 'A', points: 100 }, { id: 'member-b', name: 'B', points: 80 },
    ] }) },
    '@/lib/mobile-api/unified-season': { serializeSeasonPointTable: () => '{}', serializeSeasonSummary: value => value },
  });
  const first = await api.finalizeTeamSeason('owner', 'team-a', 'season-a', { orderedMemberIds: ['member-b', 'member-a'] });
  const second = await api.finalizeTeamSeason('owner', 'team-a', 'season-a', { orderedMemberIds: ['member-a', 'member-b'] });
  assert.equal(first.revision, 1); assert.equal(second.revision, 2);
  assert.deepEqual(snapshots[0].map(row => [row.memberId, row.rank, row.totalPoints]), [
    ['member-b', 1, 80], ['member-a', 2, 100],
  ]);
  assert.deepEqual(snapshots[1].map(row => row.memberId), ['member-a', 'member-b']);
});

test('members cannot create or finalize seasons and IMAGE needs an official image', async () => {
  const fake = {
    team: { findFirst: async () => ({ id: 'team-a', ownerId: 'owner', bowlerHiddenEnabled: true, seasonRankingEnabled: true, User: [] }) },
    teamSeason: { findFirst: async () => season({ rankingMode: 'IMAGE' }) },
    seasonRankingImage: { count: async () => 0 },
  };
  const api = loadTs('src/lib/mobile-api/season-history.ts', {
    '@/lib/prisma': fake,
    '@/lib/mobile-api/club-expansion': { getMobileSeasonRanking: async () => ({ rankings: [] }) },
    '@/lib/mobile-api/unified-season': { serializeSeasonPointTable: () => '{}', serializeSeasonSummary: value => value },
  });
  await assert.rejects(api.createTeamSeason('member', 'team-a', {}), error => error.code === 'FORBIDDEN');
  await assert.rejects(api.finalizeTeamSeason('owner', 'team-a', 'season-a', {}), error => error.code === 'RANKING_IMAGE_REQUIRED');
});

test('season history returns one current season plus independent past seasons and preserved final names', async () => {
  const finalRanking = {
    id: 'final-2025', revision: 2, rankingMode: 'DATA', finalizedAt: new Date('2026-01-02T00:00:00Z'),
    finalizedBy: { id: 'owner', name: '관리자' },
    entries: [{ id: 'entry-1', memberId: null, displayName: '탈퇴 회원 당시 이름', rank: 1, totalPoints: 140 }],
  };
  const seasons = [
    season({ id: 'season-current', name: '2026 시즌', finalRankings: [] }),
    season({
      id: 'season-past', name: '2025 시즌', status: 'COMPLETED', enabled: false,
      startDate: new Date('2024-12-31T15:00:00Z'), endDate: new Date('2025-12-31T14:59:59.999Z'),
      finalRankings: [finalRanking],
    }),
  ];
  const fake = {
    team: { findFirst: async () => ({ id: 'team-a', ownerId: 'owner', bowlerHiddenEnabled: true, seasonRankingEnabled: true, User: [] }) },
    teamSeason: {
      findMany: async () => seasons,
      findFirst: async args => args.where.id === 'season-past' ? { id: 'season-past' } : null,
    },
    seasonFinalRanking: { findFirst: async () => finalRanking },
  };
  const api = loadTs('src/lib/mobile-api/season-history.ts', {
    '@/lib/prisma': fake,
    '@/lib/mobile-api/club-expansion': { getMobileSeasonRanking: async () => ({ rankings: [] }) },
    '@/lib/mobile-api/unified-season': {
      serializeSeasonPointTable: () => '{}',
      serializeSeasonSummary: value => ({ id: value.id, name: value.name, status: value.status, rankingMode: value.rankingMode }),
    },
  });
  const history = await api.listTeamSeasons('owner', 'team-a', new Date('2026-06-01T00:00:00Z'));
  assert.equal(history.currentSeason.id, 'season-current');
  assert.deepEqual(history.seasons.map(item => [item.id, item.lifecycleStatus]), [
    ['season-current', 'ACTIVE'], ['season-past', 'ENDED'],
  ]);
  assert.equal(history.seasons[1].finalRanking.entries[0].memberId, null);
  assert.equal(history.seasons[1].finalRanking.entries[0].displayName, '탈퇴 회원 당시 이름');
  const latest = await api.getLatestSeasonFinalRanking('owner', 'team-a', 'season-past');
  assert.equal(latest.entries[0].displayName, '탈퇴 회원 당시 이름');
});

test('cross-team callers cannot list, create, read or finalize seasons', async () => {
  const fake = { team: { findFirst: async () => null } };
  const api = loadTs('src/lib/mobile-api/season-history.ts', {
    '@/lib/prisma': fake,
    '@/lib/mobile-api/club-expansion': { getMobileSeasonRanking: async () => ({ rankings: [] }) },
    '@/lib/mobile-api/unified-season': { serializeSeasonPointTable: () => '{}', serializeSeasonSummary: value => value },
  });
  for (const operation of [
    () => api.listTeamSeasons('outsider', 'team-a'),
    () => api.createTeamSeason('outsider', 'team-a', {}),
    () => api.getTeamSeason('outsider', 'team-a', 'season-a'),
    () => api.finalizeTeamSeason('outsider', 'team-a', 'season-a', {}),
  ]) {
    await assert.rejects(operation(), error => error.code === 'TEAM_NOT_FOUND' && error.status === 404);
  }
});
