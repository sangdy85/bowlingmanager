const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const fixture = require('../scripts/production-qa-fixture.cjs');
const imageStorage = require('../src/lib/post-image-storage-path.cjs');

const repositoryRoot = path.resolve(__dirname, '..');
const prismaCli = path.join(repositoryRoot, 'node_modules', 'prisma', 'build', 'index.js');

function initializeTestDatabase(databasePath, databaseUrl, childEnv) {
  if (Number(process.versions.node.split('.')[0]) >= 22) {
    const { DatabaseSync } = require('node:sqlite');
    const database = new DatabaseSync(databasePath);
    try {
      const migrations = fs.readdirSync(path.join(repositoryRoot, 'prisma', 'migrations'), { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();
      for (const migration of migrations) {
        database.exec(fs.readFileSync(path.join(repositoryRoot, 'prisma', 'migrations', migration, 'migration.sql'), 'utf8'));
      }
    } finally {
      database.close();
    }
    return;
  }
  execFileSync(process.execPath, [prismaCli, 'db', 'push', '--skip-generate'], {
    cwd: repositoryRoot,
    env: { ...childEnv, DATABASE_URL: databaseUrl },
    stdio: 'pipe',
  });
}

test('production QA fixture guard requires explicit confirmation for every mutation', () => {
  assert.deepEqual(fixture.parseArguments(['create', '--dry-run']), { action: 'create', dryRun: true });
  assert.deepEqual(fixture.parseArguments(['remove', fixture.CONFIRMATION]), { action: 'remove', dryRun: false });
  assert.throws(() => fixture.parseArguments(['create']), /explicit confirmation/);
  assert.throws(() => fixture.parseArguments(['remove']), /explicit confirmation/);
  assert.throws(() => fixture.parseArguments(['unknown', '--dry-run']), /create or remove/);
  assert.throws(() => fixture.assertDatabaseConfiguration({ DATABASE_URL: 'postgresql://example.invalid/db' }), /SQLite/);
});

test('post image path guard accepts managed files and rejects traversal', () => {
  const root = path.join(os.tmpdir(), 'bowlingmanager-path-guard');
  assert.equal(
    imageStorage.storedPostImagePath('/api/images/example.webp', root),
    path.resolve(root, 'public', 'uploads', 'example.webp'),
  );
  for (const unsafe of [
    '/api/images/../outside.webp',
    '/api/images/%2e%2e%2foutside.webp',
    '/uploads/C:%5Coutside.webp',
    '/other/example.webp',
  ]) {
    assert.equal(imageStorage.storedPostImagePath(unsafe, root), null);
  }
});

test('QA fixture create, dry-run removal and removal stay inside the reserved namespace', { timeout: 180_000 }, async () => {
  const tempParent = path.join(repositoryRoot, '.tmp-tests');
  fs.mkdirSync(tempParent, { recursive: true });
  const tempRoot = fs.mkdtempSync(path.join(tempParent, 'production-qa-'));
  const databasePath = path.join(tempRoot, 'qa-fixture-test.db');
  const databaseUrl = `file:${databasePath.replace(/\\/g, '/')}`;
  const childEnv = { ...process.env, DATABASE_URL: databaseUrl };
  let prisma;

  try {
    initializeTestDatabase(databasePath, databaseUrl, childEnv);
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

    await prisma.user.create({
      data: {
        id: 'non-qa-user',
        email: 'real-user@example.invalid',
        name: 'non QA',
        password: await bcrypt.hash('unrelated-password', 10),
        emailVerified: new Date('2026-01-01T00:00:00.000Z'),
      },
    });
    await prisma.team.create({ data: { id: 'non-qa-team', code: 'REAL_TEAM', name: 'non QA team', ownerId: 'non-qa-user' } });
    await prisma.teamMember.create({ data: { id: 'non-qa-member', userId: 'non-qa-user', teamId: 'non-qa-team' } });

    const createDryRun = await fixture.createQaFixture(prisma, { dryRun: true });
    assert.equal(createDryRun.teams, 1);
    assert.equal(createDryRun.users, 10);
    assert.equal(await prisma.team.count(), 1);
    assert.equal(await prisma.user.count(), 1);

    const created = await fixture.createQaFixture(prisma);
    assert.equal(created.status, 'created');
    assert.equal(await prisma.team.count({ where: { code: fixture.TEAM_CODE } }), 1);
    assert.equal(await prisma.user.count({ where: { email: { in: fixture.emails } } }), 10);
    assert.equal(await prisma.teamMember.count({ where: { teamId: fixture.TEAM_ID } }), 10);
    assert.equal(await prisma.teamSeason.count({ where: { teamId: fixture.TEAM_ID, status: 'ACTIVE' } }), 1);
    const owner = await prisma.user.findUnique({ where: { id: fixture.users[0].id } });
    assert.equal(owner.role, 'USER');
    assert.equal(owner.password === '1234', false);
    assert.equal(await bcrypt.compare('1234', owner.password), true);
    const fixtureTeam = await prisma.team.findUnique({
      where: { id: fixture.TEAM_ID },
      include: { User: { select: { id: true } } },
    });
    assert.equal(fixtureTeam.ownerId, fixture.users[0].id);
    assert.equal(fixtureTeam.seasonRankingEnabled, true);
    assert.equal(fixtureTeam.bowlerHiddenEnabled, true);
    assert.deepEqual(fixtureTeam.User.map((user) => user.id), [fixture.users[1].id]);

    const duplicate = await fixture.createQaFixture(prisma);
    assert.equal(duplicate.status, 'already-present');
    assert.equal(await prisma.user.count({ where: { email: { in: fixture.emails } } }), 10);

    await prisma.teamMember.create({
      data: { id: 'qa-user-real-team-membership', userId: fixture.users[2].id, teamId: 'non-qa-team' },
    });
    await assert.rejects(() => fixture.removeQaFixture(prisma, { dryRun: true, rootDirectory: tempRoot }), /contaminated/);
    await prisma.teamMember.delete({ where: { id: 'qa-user-real-team-membership' } });
    await prisma.teamMember.create({
      data: { id: 'real-user-qa-team-membership', userId: 'non-qa-user', teamId: fixture.TEAM_ID },
    });
    await assert.rejects(
      () => fixture.removeQaFixture(prisma, { dryRun: true, rootDirectory: tempRoot }),
      /outside the QA namespace/,
    );
    await prisma.teamMember.delete({ where: { id: 'real-user-qa-team-membership' } });

    const uploads = path.join(tempRoot, 'public', 'uploads');
    fs.mkdirSync(uploads, { recursive: true });
    const fixtureImagePath = path.join(uploads, 'qa-image.webp');
    const unrelatedImagePath = path.join(uploads, 'real-image.webp');
    fs.writeFileSync(fixtureImagePath, 'qa image');
    fs.writeFileSync(unrelatedImagePath, 'real image');
    await prisma.post.create({
      data: {
        id: 'qa-post',
        teamId: fixture.TEAM_ID,
        authorId: fixture.users[0].id,
        title: 'QA post',
        content: 'QA fixture content',
        images: { create: { id: 'qa-post-image', url: '/api/images/qa-image.webp', size: 8 } },
      },
    });
    await prisma.mobileRefreshToken.create({
      data: {
        id: 'qa-refresh-token',
        tokenHash: randomUUID().replaceAll('-', '').padEnd(64, '0'),
        familyId: 'qa-refresh-family',
        userId: fixture.users[0].id,
        expiresAt: new Date('2027-01-01T00:00:00.000Z'),
      },
    });
    await prisma.score.create({
      data: {
        id: 'qa-score',
        score: 200,
        gameDate: new Date('2026-09-25T00:00:00.000Z'),
        gameType: '정기전',
        userId: fixture.users[0].id,
        teamId: fixture.TEAM_ID,
      },
    });

    const removalDryRun = await fixture.removeQaFixture(prisma, { dryRun: true, rootDirectory: tempRoot });
    assert.equal(removalDryRun.status, 'planned');
    assert.equal(removalDryRun.users, 10);
    assert.equal(removalDryRun.postImages, 1);
    assert.equal(removalDryRun.refreshTokens, 1);
    assert.equal(fs.existsSync(fixtureImagePath), true);
    assert.equal(await prisma.post.count({ where: { id: 'qa-post' } }), 1);

    const removed = await fixture.removeQaFixture(prisma, { rootDirectory: tempRoot });
    assert.equal(removed.status, 'removed');
    assert.equal(await prisma.team.count({ where: { code: fixture.TEAM_CODE } }), 0);
    assert.equal(await prisma.user.count({ where: { email: { in: fixture.emails } } }), 0);
    assert.equal(await prisma.mobileRefreshToken.count({ where: { id: 'qa-refresh-token' } }), 0);
    assert.equal(fs.existsSync(fixtureImagePath), false);
    assert.equal(fs.existsSync(unrelatedImagePath), true);
    assert.equal(await prisma.team.count({ where: { id: 'non-qa-team' } }), 1);
    assert.equal(await prisma.user.count({ where: { id: 'non-qa-user' } }), 1);
    assert.equal(await prisma.teamMember.count({ where: { id: 'non-qa-member' } }), 1);

    const secondRemoval = await fixture.removeQaFixture(prisma, { rootDirectory: tempRoot });
    assert.equal(secondRemoval.status, 'not-found');
  } finally {
    if (prisma) await prisma.$disconnect();
    fs.rmSync(tempRoot, { recursive: true, force: true });
    try { fs.rmdirSync(tempParent); } catch {}
  }
});
