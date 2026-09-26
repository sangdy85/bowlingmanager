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
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  new Function('require', 'module', 'exports', compiled)(localRequire, module, module.exports);
  return module.exports;
}

function contextTeam(actor = 'owner') {
  return {
    ownerId: actor, bowlerHiddenEnabled: true, User: [],
    seasons: [{ id: 'season-2026', startDate: new Date('2025-12-31T15:00:00.000Z'), endDate: new Date('2026-12-31T14:59:59.999Z') }],
    members: [
      { id: 'member-a', alias: '회원 A', user: { name: 'Account A' } },
      { id: 'member-b', alias: null, user: { name: '회원 B' } },
    ],
  };
}

function fakePrisma(options = {}) {
  let created = null;
  const db = {
    team: { findFirst: async () => Object.hasOwn(options, 'team') ? options.team : contextTeam() },
    seasonPointEntry: { groupBy: async () => options.automatic ?? [] },
    seasonPointAdjustment: { groupBy: async () => options.adjustments ?? [] },
    seasonLegacyPointEntry: {
      findFirst: async () => options.conflict ? { id: 'conflict' } : null,
      groupBy: async () => options.legacy ?? [],
    },
    seasonLegacyImportBatch: {
      findUnique: async () => options.duplicate ? { id: 'existing', reversedAt: null } : null,
      create: async args => {
        created = args.data;
        return { id: 'batch-1', mode: args.data.mode, createdAt: new Date('2026-09-26T00:00:00.000Z'), _count: { entries: args.data.entries.create.length } };
      },
      findMany: async () => [],
      updateMany: async () => ({ count: options.missingBatch ? 0 : 1 }),
    },
  };
  db.$transaction = async callback => callback(db);
  return { db, created: () => created };
}

const detailed = {
  mode: 'DETAILED',
  rows: [
    { memberId: 'member-a', month: '2026-01', competitionType: 'TEAM', placement: 3, points: 10 },
    { memberId: 'member-a', month: '2026-02', competitionType: 'INDIVIDUAL', placement: 3, points: 30 },
    { memberId: 'member-a', month: '2026-03', competitionType: 'INDIVIDUAL', placement: 1, points: 50 },
  ],
};

test('detailed preview is read-only, resolves members and reports exact expected totals', async () => {
  const fake = fakePrisma({ automatic: [{ memberId: 'member-a', _sum: { points: 40 } }] });
  const service = loadTs('src/lib/mobile-api/season-legacy-import.ts', { '@/lib/prisma': fake.db });
  const preview = await service.previewSeasonLegacyImport('owner', 'team-a', 'season-2026', detailed);
  assert.equal(preview.summary.totalRows, 3);
  assert.equal(preview.summary.totalPoints, 90);
  assert.equal(preview.memberChanges[0].previousPoints, 40);
  assert.equal(preview.memberChanges[0].totalPoints, 130);
  assert.equal(preview.importHash.length, 64);
  assert.equal(fake.created(), null);
});

test('commit requires unchanged preview hash and persists one audited append-only batch', async () => {
  const fake = fakePrisma();
  const service = loadTs('src/lib/mobile-api/season-legacy-import.ts', { '@/lib/prisma': fake.db });
  const preview = await service.previewSeasonLegacyImport('owner', 'team-a', 'season-2026', detailed);
  await assert.rejects(
    service.createSeasonLegacyImport('owner', 'team-a', 'season-2026', { ...detailed, importHash: 'changed' }),
    error => error.code === 'IMPORT_PREVIEW_REQUIRED',
  );
  const result = await service.createSeasonLegacyImport('owner', 'team-a', 'season-2026', { ...detailed, importHash: preview.importHash });
  assert.equal(result.rowCount, 3);
  assert.equal(result.totalPoints, 90);
  assert.equal(fake.created().enteredByUserId, 'owner');
  assert.equal(fake.created().entries.create[0].memberId, 'member-a');
});

test('same import and mixed opening/detail sources are rejected', async () => {
  const duplicate = fakePrisma({ duplicate: true });
  const duplicateService = loadTs('src/lib/mobile-api/season-legacy-import.ts', { '@/lib/prisma': duplicate.db });
  await assert.rejects(
    duplicateService.previewSeasonLegacyImport('owner', 'team-a', 'season-2026', detailed),
    error => error.code === 'IMPORT_ALREADY_EXISTS',
  );
  const conflict = fakePrisma({ conflict: true });
  const conflictService = loadTs('src/lib/mobile-api/season-legacy-import.ts', { '@/lib/prisma': conflict.db });
  await assert.rejects(
    conflictService.previewSeasonLegacyImport('owner', 'team-a', 'season-2026', {
      mode: 'OPENING_BALANCE', rows: [{ memberId: 'member-a', points: 90 }],
    }),
    error => error.code === 'LEGACY_SOURCE_CONFLICT',
  );
});

test('member/outsider cannot import and guest-shaped member IDs are rejected', async () => {
  for (const team of [
    { ...contextTeam('someone-else'), User: [] },
    null,
  ]) {
    const fake = fakePrisma({ team });
    const service = loadTs('src/lib/mobile-api/season-legacy-import.ts', { '@/lib/prisma': fake.db });
    await assert.rejects(
      service.previewSeasonLegacyImport('actor', 'team-a', 'season-2026', detailed),
      error => ['FORBIDDEN', 'TEAM_NOT_FOUND'].includes(error.code),
    );
  }
  const fake = fakePrisma({ team: { ...contextTeam(), members: [] } });
  const service = loadTs('src/lib/mobile-api/season-legacy-import.ts', { '@/lib/prisma': fake.db });
  await assert.rejects(
    service.previewSeasonLegacyImport('owner', 'team-a', 'season-2026', {
      mode: 'OPENING_BALANCE', rows: [{ memberId: 'guest:1', points: 10 }],
    }),
    error => error.code === 'MEMBER_NOT_FOUND',
  );
});

test('reversal records audit state without deleting batch or entries', async () => {
  const fake = fakePrisma();
  let deleteCalls = 0;
  fake.db.seasonLegacyImportBatch.delete = async () => { deleteCalls += 1; };
  fake.db.seasonLegacyPointEntry.deleteMany = async () => { deleteCalls += 1; };
  const service = loadTs('src/lib/mobile-api/season-legacy-import.ts', { '@/lib/prisma': fake.db });
  const result = await service.reverseSeasonLegacyImport('owner', 'team-a', 'season-2026', 'batch-1', { reason: '잘못된 Excel 선택' });
  assert.deepEqual(result, { batchId: 'batch-1', reversed: true });
  assert.equal(deleteCalls, 0);
});

test('migration is additive and constrains mode, entry shape, points and audit reversal', () => {
  const sql = fs.readFileSync(path.resolve(__dirname, '../prisma/migrations/20260926150000_add_season_legacy_imports/migration.sql'), 'utf8');
  assert.match(sql, /CREATE TABLE "SeasonLegacyImportBatch"/);
  assert.match(sql, /CREATE TABLE "SeasonLegacyPointEntry"/);
  assert.match(sql, /UNIQUE INDEX "SeasonLegacyImportBatch_seasonId_importHash_key"/);
  assert.match(sql, /OPENING_BALANCE/);
  assert.doesNotMatch(sql, /^\s*(DROP TABLE|DELETE FROM|UPDATE )/im);
});
