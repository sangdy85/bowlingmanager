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
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  new Function('require', 'module', 'exports', compiled)(localRequire, module, module.exports);
  return module.exports;
}

function adjustmentPrisma({ role = 'OWNER', automatic = 50, memberExists = true, teamVisible = true } = {}) {
  const adjustments = [];
  const tx = {
    team: { findFirst: async () => teamVisible ? {
      ownerId: role === 'OWNER' ? 'actor' : 'owner', bowlerHiddenEnabled: true,
      User: role === 'MANAGER' ? [{ id: 'actor' }] : [],
      seasons: [{ id: 'season-a' }],
      members: memberExists ? [{ id: 'member-a', alias: '회원 A', user: { name: '비공개 이름' } }] : [],
    } : null },
    seasonPointEntry: { aggregate: async () => ({ _sum: { points: automatic } }) },
    seasonLegacyPointEntry: { aggregate: async () => ({ _sum: { points: 0 } }) },
    seasonPointAdjustment: {
      aggregate: async () => ({ _sum: { delta: adjustments.reduce((sum, row) => sum + row.delta, 0) } }),
      create: async ({ data }) => {
        const row = { id: `adjustment-${adjustments.length + 1}`, ...data, createdAt: new Date('2026-09-20T03:00:00.000Z') };
        adjustments.push(row);
        return row;
      },
    },
  };
  let tail = Promise.resolve();
  return {
    adjustments,
    $transaction: async callback => {
      const run = tail.then(() => callback(tx));
      tail = run.catch(() => undefined);
      return run;
    },
  };
}

function serviceFor(fakePrisma) {
  return loadTs('src/lib/mobile-api/unified-season.ts', { '@/lib/prisma': fakePrisma });
}

test('OWNER and MANAGER append signed audited adjustments without updating old rows', async () => {
  for (const [role, delta] of [['OWNER', 20], ['MANAGER', -10]]) {
    const fake = adjustmentPrisma({ role });
    const service = serviceFor(fake);
    const result = await service.createSeasonPointAdjustment('actor', 'team-a', 'season-a', {
      memberId: 'member-a', delta, reason: '  운영 보정  ',
    });
    assert.equal(result.previousTotal, 50);
    assert.equal(result.totalPoints, 50 + delta);
    assert.equal(fake.adjustments.length, 1);
    assert.equal(fake.adjustments[0].delta, delta);
    assert.equal(fake.adjustments[0].reason, '운영 보정');
    assert.equal(fake.adjustments[0].enteredByUserId, 'actor');
  }
});

test('member, outsider, other-team manager and non-member SUPER_ADMIN are rejected', async () => {
  for (const fixture of [
    adjustmentPrisma({ role: 'MEMBER' }),
    adjustmentPrisma({ teamVisible: false }),
    adjustmentPrisma({ teamVisible: false }),
    adjustmentPrisma({ teamVisible: false }),
  ]) {
    const service = serviceFor(fixture);
    await assert.rejects(
      service.createSeasonPointAdjustment('actor', 'team-a', 'season-a', {
        memberId: 'member-a', delta: 10, reason: '권한 검사',
      }),
      error => ['FORBIDDEN', 'TEAM_NOT_FOUND'].includes(error.code),
    );
    assert.equal(fixture.adjustments.length, 0);
  }
});

test('zero delta, blank reason, unknown member or guest-shaped id cannot create an adjustment', async () => {
  const fake = adjustmentPrisma();
  const service = serviceFor(fake);
  await assert.rejects(
    service.createSeasonPointAdjustment('actor', 'team-a', 'season-a', { memberId: 'member-a', delta: 0, reason: '보정' }),
    error => error.code === 'INVALID_ADJUSTMENT',
  );
  await assert.rejects(
    service.createSeasonPointAdjustment('actor', 'team-a', 'season-a', { memberId: 'member-a', delta: 10, reason: '   ' }),
    error => error.code === 'INVALID_ADJUSTMENT_REASON',
  );
  const missing = adjustmentPrisma({ memberExists: false });
  const missingService = serviceFor(missing);
  for (const memberId of ['member-other-team', 'guest:guest-a']) {
    await assert.rejects(
      missingService.createSeasonPointAdjustment('actor', 'team-a', 'season-a', { memberId, delta: 10, reason: '대상 검사' }),
      error => error.code === 'MEMBER_NOT_FOUND',
    );
  }
});

test('multiple adjustments accumulate and a negative total is rejected', async () => {
  const fake = adjustmentPrisma({ automatic: 25 });
  const service = serviceFor(fake);
  await service.createSeasonPointAdjustment('actor', 'team-a', 'season-a', { memberId: 'member-a', delta: 20, reason: '추가' });
  const second = await service.createSeasonPointAdjustment('actor', 'team-a', 'season-a', { memberId: 'member-a', delta: -10, reason: '수정' });
  assert.equal(second.totalPoints, 35);
  await assert.rejects(
    service.createSeasonPointAdjustment('actor', 'team-a', 'season-a', { memberId: 'member-a', delta: -36, reason: '과도한 차감' }),
    error => error.code === 'NEGATIVE_SEASON_TOTAL',
  );
  assert.deepEqual(fake.adjustments.map(row => row.delta), [20, -10]);
});

test('serialized concurrent deductions cannot make the season total negative', async () => {
  const fake = adjustmentPrisma({ automatic: 10 });
  const service = serviceFor(fake);
  const results = await Promise.allSettled([
    service.createSeasonPointAdjustment('actor', 'team-a', 'season-a', { memberId: 'member-a', delta: -7, reason: '차감 A' }),
    service.createSeasonPointAdjustment('actor', 'team-a', 'season-a', { memberId: 'member-a', delta: -7, reason: '차감 B' }),
  ]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter(result => result.status === 'rejected' && result.reason.code === 'NEGATIVE_SEASON_TOTAL').length, 1);
  assert.equal(fake.adjustments.reduce((sum, row) => sum + row.delta, 0), -7);
});

test('migration is additive, constrained and append-only API exposes no mutation endpoint', () => {
  const migration = fs.readFileSync(path.resolve(
    __dirname, '../prisma/migrations/20260926120000_add_season_point_adjustments/migration.sql',
  ), 'utf8');
  const route = fs.readFileSync(path.resolve(
    __dirname, '../src/app/api/mobile/v1/teams/[teamId]/seasons/[seasonId]/point-adjustments/route.ts',
  ), 'utf8');
  assert.match(migration, /CREATE TABLE "SeasonPointAdjustment"/);
  assert.match(migration, /CHECK \("delta" <> 0\)/);
  assert.match(migration, /length\(trim\("reason"\)\) BETWEEN 1 AND 500/);
  assert.doesNotMatch(migration, /^(DROP\s+TABLE|DELETE\s+FROM|UPDATE\s+)/im);
  assert.match(route, /export async function POST/);
  assert.doesNotMatch(route, /export async function (PATCH|PUT|DELETE)/);
});
