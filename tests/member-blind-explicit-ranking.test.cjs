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

const member = (id, name, blindAt = null) => ({ id, alias: null, blindAt, user: { name } });
const season = (overrides = {}) => ({
  id: 'season-a', teamId: 'team-a', name: '2026 시즌', rankingMode: 'IMAGE',
  startDate: new Date('2026-01-01T00:00:00Z'), endDate: new Date('2026-12-31T00:00:00Z'),
  status: 'ACTIVE', enabled: true, ...overrides,
});

test('18th migration is additive and stores effective blind time plus independent ranking snapshots', () => {
  const sql = fs.readFileSync(
    path.resolve(__dirname, '../prisma/migrations/20260929120000_add_member_blind_explicit_rankings/migration.sql'),
    'utf8',
  );
  assert.match(sql, /ADD COLUMN "blindAt" DATETIME/);
  assert.match(sql, /CREATE TABLE "SeasonRankingSnapshot"/);
  assert.match(sql, /CREATE TABLE "SeasonRankingSnapshotEntry"/);
  assert.match(sql, /CREATE TABLE "SeasonFinalRankingParticipant"/);
  assert.match(sql, /"totalPoints" INTEGER,/);
  assert.match(sql, /ON DELETE SET NULL/);
  assert.doesNotMatch(sql, /^\s*(DROP TABLE|DELETE FROM|UPDATE )/im);
});

test('historical ranking parser enforces continuous ranks, mixed participants and duplicate-member safety', () => {
  const api = loadTs('src/lib/mobile-api/explicit-season-rankings.ts', { '@/lib/prisma': {} });
  assert.deepEqual(api.parseHistoricalRankingEntries([
    { rank: 1, participantType: 'MEMBER', memberId: 'member-a' },
    { rank: 2, participantType: 'MANUAL', memberId: null, displayName: 'Guest A' },
  ]), [
    { rank: 1, participantType: 'MEMBER', memberId: 'member-a', displayName: null },
    { rank: 2, participantType: 'MANUAL', memberId: null, displayName: 'Guest A' },
  ]);
  assert.throws(() => api.parseHistoricalRankingEntries([
    { rank: 1, participantType: 'MEMBER', memberId: 'member-a' },
    { rank: 2, participantType: 'MEMBER', memberId: 'member-a' },
  ]), error => error.code === 'DUPLICATE_OR_INVALID_MEMBER');
  assert.throws(() => api.parseHistoricalRankingEntries([
    { rank: 2, participantType: 'MANUAL', displayName: 'Guest' },
  ]), error => error.code === 'INVALID_RANK_CONTINUITY');
  assert.throws(() => api.parseHistoricalRankingEntries([
    { rank: 1, participantType: 'MANUAL', displayName: '   ' },
  ]), error => error.code === 'INVALID_MANUAL_NAME');
});

test('IMAGE explicit ranking saves atomically, snapshots names and reloads the latest revision', async () => {
  let stored = null;
  const members = [member('member-a', '회원 A')];
  const fake = {
    team: { findFirst: async () => ({ id: 'team-a', ownerId: 'owner', User: [] }) },
    teamSeason: { findFirst: async () => season() },
    seasonRankingSnapshot: { findFirst: async () => stored },
    $transaction: async callback => callback({
      teamMember: { findMany: async () => members },
      seasonRankingSnapshot: {
        findFirst: async () => stored && ({ revision: stored.revision }),
        create: async args => {
          stored = {
            id: 'ranking-1', revision: args.data.revision, savedAt: new Date('2026-09-29T00:00:00Z'),
            savedBy: { id: 'owner', name: '관리자' },
            entries: args.data.entries.create.map((entry, index) => ({
              id: `entry-${index}`, ...entry, member: entry.memberId ? { blindAt: null } : null,
            })),
          };
          return stored;
        },
      },
    }),
  };
  const api = loadTs('src/lib/mobile-api/explicit-season-rankings.ts', { '@/lib/prisma': fake });
  const saved = await api.saveExplicitSeasonRanking('owner', 'team-a', 'season-a', { entries: [
    { rank: 1, participantType: 'MEMBER', memberId: 'member-a' },
    { rank: 2, participantType: 'MANUAL', memberId: null, displayName: 'Guest A' },
  ] });
  assert.equal(saved.revision, 1);
  assert.deepEqual(saved.entries.map(row => [row.rank, row.memberId, row.displayName]), [
    [1, 'member-a', '회원 A'], [2, null, 'Guest A'],
  ]);
  const reloaded = await api.getExplicitSeasonRanking('owner', 'team-a', 'season-a');
  assert.deepEqual(reloaded.entries.map(row => row.displayName), ['회원 A', 'Guest A']);
});

test('explicit ranking rejects members, outsiders, DATA seasons and cross-team member injection', async () => {
  let teamAccess = { id: 'team-a', ownerId: 'owner', User: [] };
  let rankingMode = 'IMAGE';
  let members = [];
  const fake = {
    team: { findFirst: async () => teamAccess },
    teamSeason: { findFirst: async () => season({ rankingMode }) },
    $transaction: async callback => callback({
      teamMember: { findMany: async () => members },
      seasonRankingSnapshot: { findFirst: async () => null, create: async () => { throw new Error('must not create'); } },
    }),
  };
  const api = loadTs('src/lib/mobile-api/explicit-season-rankings.ts', { '@/lib/prisma': fake });
  const input = { entries: [{ rank: 1, participantType: 'MEMBER', memberId: 'other-team-member' }] };
  await assert.rejects(
    api.saveExplicitSeasonRanking('member', 'team-a', 'season-a', input),
    error => error.code === 'FORBIDDEN' && error.status === 403,
  );
  teamAccess = null;
  await assert.rejects(
    api.saveExplicitSeasonRanking('outsider', 'team-a', 'season-a', input),
    error => error.code === 'TEAM_NOT_FOUND' && error.status === 404,
  );
  teamAccess = { id: 'team-a', ownerId: 'owner', User: [] };
  rankingMode = 'DATA';
  await assert.rejects(
    api.saveExplicitSeasonRanking('owner', 'team-a', 'season-a', input),
    error => error.code === 'SEASON_RANKING_MODE_MISMATCH' && error.status === 409,
  );
  rankingMode = 'IMAGE';
  await assert.rejects(
    api.saveExplicitSeasonRanking('owner', 'team-a', 'season-a', input),
    error => error.code === 'INVALID_MEMBER' && error.status === 400,
  );
});

test('active explicit ranking hides blinded members while ended history remains immutable', async () => {
  let currentSeason = season();
  const stored = {
    id: 'ranking-1', revision: 1, savedAt: new Date(), savedBy: { id: 'owner', name: '관리자' },
    entries: [
      { id: 'a', participantType: 'MEMBER', memberId: 'member-a', displayName: 'A', rank: 1, member: { blindAt: new Date() } },
      { id: 'b', participantType: 'MANUAL', memberId: null, displayName: 'Guest', rank: 2, member: null },
    ],
  };
  const fake = {
    team: { findFirst: async () => ({ id: 'team-a', ownerId: 'owner', User: [] }) },
    teamSeason: { findFirst: async () => currentSeason },
    seasonRankingSnapshot: { findFirst: async () => stored },
  };
  const api = loadTs('src/lib/mobile-api/explicit-season-rankings.ts', { '@/lib/prisma': fake });
  let result = await api.getExplicitSeasonRanking('owner', 'team-a', 'season-a');
  assert.deepEqual(result.entries.map(row => row.displayName), ['Guest']);
  currentSeason = season({ status: 'COMPLETED', enabled: false, endDate: new Date('2025-12-31T00:00:00Z') });
  result = await api.getExplicitSeasonRanking('owner', 'team-a', 'season-a');
  assert.deepEqual(result.entries.map(row => row.displayName), ['A', 'Guest']);
});
