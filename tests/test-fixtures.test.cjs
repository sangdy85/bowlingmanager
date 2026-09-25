// Guard and migration tests only. The seed is never run against a repository or production database here.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const fixture = require('../scripts/seed-test-fixtures.cjs');

test('local fixture requires an explicit safe SQLite database and blocks production', () => {
  assert.throws(() => fixture.assertTestFixtureEnvironment(
    { NODE_ENV: 'production', DATABASE_URL: 'file:./dev.db' },
    [fixture.CONFIRMATION],
  ), /disabled in production/);
  assert.throws(() => fixture.assertTestFixtureEnvironment(
    { APP_ENV: 'production', DATABASE_URL: 'file:./test.db' },
    [fixture.CONFIRMATION],
  ), /disabled in production/);
  assert.throws(() => fixture.assertTestFixtureEnvironment(
    { NODE_ENV: 'test', DATABASE_URL: 'file:./test.db' },
    [],
  ), /Explicit confirmation/);
  assert.throws(() => fixture.assertTestFixtureEnvironment(
    { NODE_ENV: 'test', DATABASE_URL: 'postgresql://example.invalid/prod' },
    [fixture.CONFIRMATION],
  ), /local SQLite/);
  assert.doesNotThrow(() => fixture.assertTestFixtureEnvironment(
    { NODE_ENV: 'test', DATABASE_URL: 'file:./local-fixture-test.db' },
    [fixture.CONFIRMATION],
  ));
});

test('manual grouping migration is additive', () => {
  const sql = fs.readFileSync(path.resolve(__dirname,
    '../prisma/migrations/20260925120000_add_manual_grouping_scores/migration.sql'), 'utf8');
  assert.match(sql, /ALTER TABLE "TeamEventAttendance" ADD COLUMN "manualGroupingScore" INTEGER/);
  assert.match(sql, /ALTER TABLE "TeamEventGuest" ADD COLUMN "manualGroupingScore" INTEGER/);
  assert.doesNotMatch(sql, /DROP\s+TABLE|DELETE\s+FROM|UPDATE\s+/i);
});

test('fixture identifiers are deterministic and clearly test-only', () => {
  assert.equal(fixture.TEAM_ID, 'local-fixture-team-bowler-hidden');
  assert.equal(fixture.TEAM_CODE, 'TEST_TEAM');
});
