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
  const module = { exports: {} };
  cache.set(filename, module);
  const nativeRequire = createRequire(filename);
  const localRequire = id => Object.hasOwn(overrides, id) ? overrides[id]
    : id.startsWith('@/') ? loadTs(`src/${id.slice(2)}.ts`, overrides, cache) : nativeRequire(id);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  new Function('require', 'module', 'exports', compiled)(localRequire, module, module.exports);
  return module.exports;
}

function accessTeam({ actor = 'owner', owner = 'owner', mode = 'DATA', hidden = true } = {}) {
  return {
    id: 'team-a', ownerId: owner, bowlerHiddenEnabled: hidden,
    User: actor === 'manager' ? [{ id: actor }] : [],
    members: [
      { id: 'member-a', alias: '회원 A', user: { name: 'Account A' } },
      { id: 'member-b', alias: null, user: { name: '회원 B' } },
    ],
    seasons: [{
      id: 'season-a', name: '2026 시즌', rankingMode: mode,
      startDate: new Date('2025-12-31T15:00:00.000Z'),
      endDate: new Date('2026-12-31T14:59:59.999Z'),
    }],
  };
}

const storage = {
  PostImageStorageError: class PostImageStorageError extends Error {},
  storePostImages: async () => [{ url: '/api/images/random.webp', size: 100, path: 'safe' }],
  removeStoredPostImages: async () => {},
  removeStoredPostImagesStrict: async () => {},
  storedPostImagePath: () => 'safe',
  readStoredPostImage: async () => ({ bytes: Buffer.from([1]), contentType: 'image/webp' }),
};

function service(fakePrisma) {
  return loadTs('src/lib/mobile-api/season-ranking-management.ts', {
    '@/lib/prisma': fakePrisma,
    '@/lib/post-image-storage': storage,
  });
}

test('migration is additive, defaults existing seasons to DATA and constrains new records', () => {
  const sql = fs.readFileSync(path.resolve(
    __dirname, '../prisma/migrations/20260927120000_add_season_ranking_management/migration.sql',
  ), 'utf8');
  assert.match(sql, /ADD COLUMN "rankingMode" TEXT NOT NULL DEFAULT 'DATA'/);
  assert.match(sql, /CHECK \("rankingMode" IN \('DATA', 'IMAGE'\)\)/);
  assert.match(sql, /CREATE TABLE "SeasonManualCompetition"/);
  assert.match(sql, /CREATE TABLE "SeasonManualCompetitionRevision"/);
  assert.match(sql, /CREATE TABLE "SeasonRankingImage"/);
  assert.match(sql, /SeasonManualCompetition_seasonId_eventDate_competitionType_name_key/);
  const revisionSql = sql.match(/CREATE TABLE "SeasonManualCompetitionRevision"[\s\S]*?\n\);/)?.[0] ?? '';
  const imageSql = sql.match(/CREATE TABLE "SeasonRankingImage"[\s\S]*?\n\);/)?.[0] ?? '';
  assert.doesNotMatch(revisionSql, /CHECK \("size"|CHECK \("displayOrder"/);
  assert.match(imageSql, /CHECK \("size" BETWEEN 1 AND 5242880\)/);
  assert.match(imageSql, /CHECK \("displayOrder" >= 0\)/);
  assert.doesNotMatch(sql, /^\s*(DROP TABLE|DELETE FROM|UPDATE )/im);
});

test('mode switch requires confirmation when hidden data exists and preserves every row', async () => {
  let update = null;
  let destructiveCalls = 0;
  const fake = {
    team: { findFirst: async () => accessTeam() },
    seasonPointEntry: { count: async () => 2, deleteMany: async () => { destructiveCalls += 1; } },
    seasonPointAdjustment: { count: async () => 1, deleteMany: async () => { destructiveCalls += 1; } },
    seasonLegacyPointEntry: { count: async () => 1, deleteMany: async () => { destructiveCalls += 1; } },
    seasonManualCompetition: { count: async () => 1, deleteMany: async () => { destructiveCalls += 1; } },
    seasonRankingImage: { count: async () => 0, deleteMany: async () => { destructiveCalls += 1; } },
    teamSeason: { update: async args => { update = args.data; return { ...accessTeam().seasons[0], ...args.data }; } },
  };
  const api = service(fake);
  await assert.rejects(
    api.updateSeasonRankingMode('owner', 'team-a', 'season-a', { rankingMode: 'IMAGE' }),
    error => error.code === 'MODE_CHANGE_CONFIRMATION_REQUIRED' && error.status === 409,
  );
  const result = await api.updateSeasonRankingMode('owner', 'team-a', 'season-a', {
    rankingMode: 'IMAGE', confirmed: true,
  });
  assert.deepEqual(update, { rankingMode: 'IMAGE' });
  assert.equal(result.hiddenDataPreserved, true);
  assert.equal(destructiveCalls, 0);
});

test('OWNER and MANAGER can create one scoped DATA competition while members and IMAGE mode are denied', async () => {
  for (const actor of ['owner', 'manager']) {
    let create = null;
    const fake = {
      team: { findFirst: async () => accessTeam({ actor }) },
      seasonLegacyPointEntry: { findMany: async () => [] },
      seasonManualCompetition: { create: async args => {
        create = args.data;
        return {
          id: 'manual-a', ...args.data, createdAt: new Date('2026-01-10T00:00:00Z'),
          updatedAt: new Date('2026-01-10T00:00:00Z'),
          results: args.data.results.create.map((row, index) => ({ id: `r-${index}`, ...row })),
        };
      } },
    };
    const result = await service(fake).createSeasonManualCompetition(actor, 'team-a', 'season-a', {
      name: '1월 팀전', eventDate: '2026-01-10', competitionType: 'TEAM',
      results: [{ memberId: 'member-a', finalRank: 1, points: 30 }],
    });
    assert.equal(create.createdByUserId, actor);
    assert.equal(create.results.create[0].memberDisplayName, '회원 A');
    assert.equal(result.competition.source, 'MANUAL');
  }

  for (const fixture of [
    accessTeam({ actor: 'member', owner: 'someone-else' }),
    accessTeam({ mode: 'IMAGE' }),
  ]) {
    const api = service({
      team: { findFirst: async () => fixture },
      seasonManualCompetition: { create: async () => assert.fail('must not write') },
    });
    await assert.rejects(
      api.createSeasonManualCompetition(fixture.ownerId === 'owner' ? 'owner' : 'member', 'team-a', 'season-a', {
        name: '대회', eventDate: '2026-01-10', competitionType: 'TEAM',
        results: [{ memberId: 'member-a', finalRank: 1, points: 30 }],
      }),
      error => ['FORBIDDEN', 'SEASON_RANKING_MODE_MISMATCH'].includes(error.code),
    );
  }
});

test('manual competition edit snapshots the prior values before replacing results', async () => {
  const calls = [];
  const tx = {
    seasonLegacyPointEntry: { findMany: async () => [] },
    seasonManualCompetition: {
      findFirst: async () => ({
        id: 'manual-a', name: '이전 대회', eventDate: new Date('2026-01-10T00:00:00Z'),
        competitionType: 'TEAM', results: [{ memberId: 'member-a', memberDisplayName: '회원 A', finalRank: 2, points: 10 }],
      }),
      update: async args => {
        calls.push('update');
        return {
          id: 'manual-a', ...args.data, createdAt: new Date('2026-01-01T00:00:00Z'),
          updatedAt: new Date('2026-02-01T00:00:00Z'), results: args.data.results.create,
        };
      },
    },
    seasonManualCompetitionRevision: { create: async args => { calls.push('revision'); return args.data; } },
    seasonManualCompetitionResult: { deleteMany: async () => { calls.push('delete-results'); } },
  };
  const fake = {
    team: { findFirst: async () => accessTeam() },
    $transaction: async callback => callback(tx),
  };
  await service(fake).updateSeasonManualCompetition('owner', 'team-a', 'season-a', 'manual-a', {
    name: '수정 대회', eventDate: '2026-02-10', competitionType: 'INDIVIDUAL',
    results: [{ memberId: 'member-b', finalRank: 1, points: 50 }],
  });
  assert.deepEqual(calls, ['revision', 'delete-results', 'update']);
});

test('structured editor saves competitions and explicit total adjustments in one transaction', async () => {
  const calls = [];
  let adjustment = null;
  const tx = {
    seasonLegacyPointEntry: {
      findMany: async () => [],
      groupBy: async () => [],
    },
    seasonManualCompetition: {
      create: async args => { calls.push('competition'); return args.data; },
      findFirst: async () => null,
    },
    seasonManualCompetitionResult: {
      groupBy: async () => [{ memberId: 'member-a', _sum: { points: 30 } }],
    },
    seasonPointEntry: {
      groupBy: async () => [{ memberId: 'member-a', _sum: { points: 50 } }],
    },
    seasonPointAdjustment: {
      groupBy: async () => [{ memberId: 'member-a', _sum: { delta: 10 } }],
      create: async args => { calls.push('adjustment'); adjustment = args.data; return args.data; },
    },
  };
  const fake = {
    team: { findFirst: async () => accessTeam() },
    $transaction: async (callback, options) => {
      assert.equal(options.isolationLevel, 'Serializable');
      return callback(tx);
    },
  };
  const result = await service(fake).saveStructuredSeasonRanking('owner', 'team-a', 'season-a', {
    competitions: [{
      id: null, name: '1월 팀전', eventDate: '2026-01-10', competitionType: 'TEAM',
      results: [{ memberId: 'member-a', finalRank: 1, points: 30 }],
    }],
    targetTotals: [{ memberId: 'member-a', targetTotal: 100 }],
  });
  assert.deepEqual(calls, ['competition', 'adjustment']);
  assert.equal(adjustment.delta, 10);
  assert.match(adjustment.reason, /구조화 입력/);
  assert.equal(result.competitionCount, 1);
  assert.equal(result.adjustmentCount, 1);
  assert.equal(result.totals[0].totalPoints, 100);
});

test('structured editor rejects a Legacy and manual result overlap without writing', async () => {
  let writes = 0;
  const eventDate = new Date('2026-01-10T00:00:00+09:00');
  const tx = {
    seasonLegacyPointEntry: {
      findMany: async () => [{ memberId: 'member-a', eventDate, competitionType: 'TEAM' }],
    },
    seasonManualCompetition: { create: async () => { writes += 1; } },
  };
  const fake = {
    team: { findFirst: async () => accessTeam() },
    $transaction: async callback => callback(tx),
  };
  await assert.rejects(
    service(fake).saveStructuredSeasonRanking('owner', 'team-a', 'season-a', {
      competitions: [{
        name: '1월 팀전', eventDate: '2026-01-10', competitionType: 'TEAM',
        results: [{ memberId: 'member-a', finalRank: 1, points: 30 }],
      }],
      targetTotals: [],
    }),
    error => error.code === 'LEGACY_MANUAL_DUPLICATE' && error.status === 409,
  );
  assert.equal(writes, 0);
});

test('structured editor enforces manager, DATA mode and team scope before writing', async () => {
  const payload = {
    competitions: [{
      name: '1월 팀전', eventDate: '2026-01-10', competitionType: 'TEAM',
      results: [{ memberId: 'member-a', finalRank: 1, points: 30 }],
    }],
    targetTotals: [],
  };
  for (const [team, actor, expectedCode] of [
    [accessTeam({ actor: 'member', owner: 'someone-else' }), 'member', 'FORBIDDEN'],
    [accessTeam({ mode: 'IMAGE' }), 'owner', 'SEASON_RANKING_MODE_MISMATCH'],
    [null, 'outsider', 'TEAM_NOT_FOUND'],
  ]) {
    let transactionCalls = 0;
    const api = service({
      team: { findFirst: async () => team },
      $transaction: async () => { transactionCalls += 1; },
    });
    await assert.rejects(
      api.saveStructuredSeasonRanking(actor, 'team-a', 'season-a', payload),
      error => error.code === expectedCode,
    );
    assert.equal(transactionCalls, 0);
  }
});

test('image records are accepted only in IMAGE mode and never expose their storage URL', async () => {
  let created = null;
  const fake = {
    team: { findFirst: async () => accessTeam({ mode: 'IMAGE' }) },
    seasonRankingImage: {
      count: async () => 0,
      create: async args => {
        created = args.data;
        return { id: 'image-a', size: args.data.size, displayOrder: 0, createdAt: new Date('2026-01-01T00:00:00Z') };
      },
    },
  };
  const result = await service(fake).addSeasonRankingImage('owner', 'team-a', 'season-a', {
    name: '../unsafe.jpg', size: 100, type: 'image/jpeg', arrayBuffer: async () => new ArrayBuffer(0),
  });
  assert.equal(created.url, '/api/images/random.webp');
  assert.equal(Object.hasOwn(result.image, 'url'), false);
});

test('IMAGE mode rejects automatic publication, legacy import and point adjustment APIs', async () => {
  const unified = loadTs('src/lib/mobile-api/unified-season.ts', { '@/lib/prisma': {} });
  await assert.rejects(
    unified.getSeasonPointPreview({
      teamSeason: { findFirst: async () => ({
        ...accessTeam({ mode: 'IMAGE' }).seasons[0], status: 'ACTIVE',
        individualPointsConfig: '{"1":50}', teamPointsConfig: '{"1":35}', eventPointsConfig: '{"1":50}',
      }) },
    }, {
      teamId: 'team-a', eventDate: new Date('2026-01-10T03:00:00Z'), seasonId: 'season-a',
      competitionType: 'INDIVIDUAL', competitionMode: 'OFFICIAL',
    }),
    error => error.code === 'SEASON_RANKING_MODE_MISMATCH',
  );
  await assert.rejects(
    unified.getPublicationPointTable({
      teamSeason: { findFirst: async () => ({
        ...accessTeam({ mode: 'IMAGE' }).seasons[0], status: 'ACTIVE',
        individualPointsConfig: '{"1":50}', teamPointsConfig: '{"1":35}', eventPointsConfig: '{"1":50}',
      }) },
      teamEvent: {}, seasonPointPublication: {}, seasonPointEntry: {},
    }, {
      teamId: 'team-a', eventDate: new Date('2026-01-10T03:00:00Z'), seasonId: 'season-a',
      competitionType: 'INDIVIDUAL', competitionMode: 'OFFICIAL',
    }),
    error => error.code === 'SEASON_RANKING_MODE_MISMATCH',
  );

  const imageTeam = accessTeam({ mode: 'IMAGE' });
  const legacyDb = {
    team: { findFirst: async () => imageTeam },
    seasonLegacyImportBatch: { findUnique: async () => null },
  };
  const legacy = loadTs('src/lib/mobile-api/season-legacy-import.ts', { '@/lib/prisma': legacyDb });
  await assert.rejects(
    legacy.previewSeasonLegacyImport('owner', 'team-a', 'season-a', {
      mode: 'OPENING_BALANCE', rows: [{ memberId: 'member-a', points: 10 }],
    }),
    error => error.code === 'SEASON_RANKING_MODE_MISMATCH',
  );

  const adjustmentDb = {
    $transaction: async callback => callback({
      team: { findFirst: async () => imageTeam },
    }),
  };
  const adjustments = loadTs('src/lib/mobile-api/unified-season.ts', { '@/lib/prisma': adjustmentDb });
  await assert.rejects(
    adjustments.createSeasonPointAdjustment('owner', 'team-a', 'season-a', {
      memberId: 'member-a', delta: 10, reason: '보정',
    }),
    error => error.code === 'SEASON_RANKING_MODE_MISMATCH',
  );
});
