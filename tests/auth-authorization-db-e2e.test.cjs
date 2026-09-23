// Isolated integration fixtures only. Never points at a repository or production database.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { spawn, execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const repositoryRoot = path.resolve(__dirname, '..');
const prismaCli = path.join(repositoryRoot, 'node_modules', 'prisma', 'build', 'index.js');
const nextCli = path.join(repositoryRoot, 'node_modules', 'next', 'dist', 'bin', 'next');
const mobileSecret = 'phase3-mobile-secret-32-bytes-minimum-value';
const authSecret = 'phase3-auth-secret-distinct-32-bytes-value';
const fixturePassword = 'phase3-fixture-password';

const ids = {
  superadmin: 'phase3-user-superadmin',
  owner: 'phase3-user-owner',
  manager: 'phase3-user-manager',
  member: 'phase3-user-member',
  outsider: 'phase3-user-outsider',
  oauth: 'phase3-user-oauth',
  cascade: 'phase3-user-cascade',
  extraManager: 'phase3-user-extra-manager',
  removable: 'phase3-user-removable',
  normalTeam: 'phase3-team-normal',
  hiddenTeam: 'phase3-team-hidden',
  inactiveTeam: 'phase3-team-inactive',
};

test.todo('migration history reconstructs the current Prisma schema without drift');

test('mobile authentication and authorization hold at a real SQLite and HTTP boundary', { timeout: 180_000 }, async (t) => {
  const databasePath = path.join(os.tmpdir(), `bowlingmanager-phase3-e2e-${process.pid}-${Date.now()}.db`);
  const databaseUrl = `file:${databasePath.replace(/\\/g, '/')}`;
  const childEnv = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    MOBILE_API_JWT_SECRET: mobileSecret,
    AUTH_SECRET: authSecret,
    AUTH_TRUST_HOST: 'true',
    NEXT_TELEMETRY_DISABLED: '1',
    CHECKPOINT_DISABLE: '1',
  };
  let prisma;
  let server;
  let serverLogs = '';

  try {
    pushCurrentSchema(databasePath, childEnv);
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await createFixtures(prisma);

    const port = await reservePort();
    const baseUrl = `http://127.0.0.1:${port}`;
    server = spawn(process.execPath, [nextCli, 'dev', '--hostname', '127.0.0.1', '--port', String(port)], {
      cwd: repositoryRoot,
      env: childEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    const appendLog = chunk => {
      serverLogs = `${serverLogs}${chunk.toString('utf8')}`.slice(-20_000);
    };
    server.stdout.on('data', appendLog);
    server.stderr.on('data', appendLog);
    await waitForHealth(baseUrl, server, () => serverLogs);

    const request = async (route, { method = 'GET', body, token, headers = {} } = {}) => {
      const response = await fetch(`${baseUrl}/api/mobile/v1${route}`, {
        method,
        headers: {
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
          ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const json = await response.json();
      return { status: response.status, json };
    };
    const login = async (email, password = fixturePassword) => {
      const result = await request('/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      assert.equal(result.status, 200);
      assert.equal(result.json.success, true);
      return result.json.data;
    };

    const tokens = {};
    for (const role of ['owner', 'manager', 'member', 'outsider', 'superadmin']) {
      tokens[role] = await login(`${role}@phase3.invalid`);
    }

    await t.test('login uses one safe failure contract and returns tokens only', async () => {
      const valid = await login('owner@phase3.invalid');
      assert.deepEqual(Object.keys(valid).sort(), [
        'accessToken',
        'expiresIn',
        'refreshToken',
        'refreshTokenExpiresIn',
        'tokenType',
      ]);
      const failures = await Promise.all([
        request('/auth/login', { method: 'POST', body: { email: 'owner@phase3.invalid', password: 'wrong' } }),
        request('/auth/login', { method: 'POST', body: { email: 'missing@phase3.invalid', password: 'wrong' } }),
        request('/auth/login', { method: 'POST', body: { email: 'oauth@phase3.invalid', password: 'wrong' } }),
      ]);
      for (const result of failures) assert.equal(result.status, 401);
      assert.deepEqual(failures[0].json, failures[1].json);
      assert.deepEqual(failures[1].json, failures[2].json);
      const serialized = JSON.stringify(valid);
      for (const forbidden of ['password', 'provider', 'secret', 'email', 'name', 'role']) {
        assert.equal(serialized.toLowerCase().includes(forbidden.toLowerCase()), false);
      }
    });

    await t.test('access JWT accepts only the mobile issuer, audience, type, version and signature', async () => {
      const current = await request('/me', { token: tokens.owner.accessToken });
      assert.equal(current.status, 200);
      assert.equal(current.json.data.id, ids.owner);
      assert.equal((await request('/me')).status, 401);
      assert.equal((await request('/me', { headers: { authorization: 'Bearer INVALID' } })).status, 401);

      const { SignJWT } = await import('jose');
      const now = Math.floor(Date.now() / 1000);
      const sign = async ({ issuer = 'bowlingmanager-mobile-api', audience = 'bowlingmanager-flutter', tokenType = 'access', tokenVersion = 1, exp = now + 300, secret = mobileSecret } = {}) => new SignJWT({ tokenType, tokenVersion })
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .setSubject(ids.owner)
        .setIssuer(issuer)
        .setAudience(audience)
        .setIssuedAt(now)
        .setExpirationTime(exp)
        .sign(new TextEncoder().encode(secret));
      const rejected = [
        await sign({ audience: 'other-audience' }),
        await sign({ issuer: 'other-issuer' }),
        await sign({ tokenType: 'refresh' }),
        await sign({ tokenVersion: 2 }),
        await sign({ exp: now - 1 }),
        await sign({ secret: 'wrong-signing-secret-32-bytes-minimum-value' }),
      ];
      for (const token of rejected) assert.equal((await request('/me', { token })).status, 401);
    });

    await t.test('refresh rotation persists only SHA-256 hashes in one family', async () => {
      const initial = await login('member@phase3.invalid');
      const hash1 = hash(initial.refreshToken);
      const row1 = await prisma.mobileRefreshToken.findUnique({ where: { tokenHash: hash1 } });
      assert.ok(row1);
      assert.notEqual(row1.tokenHash, initial.refreshToken);
      assert.match(row1.tokenHash, /^[a-f0-9]{64}$/);
      assert.equal(row1.usedAt, null);
      assert.equal(row1.revokedAt, null);

      const second = await request('/auth/refresh', { method: 'POST', body: { refreshToken: initial.refreshToken } });
      assert.equal(second.status, 200);
      const row1After = await prisma.mobileRefreshToken.findUnique({ where: { tokenHash: hash1 } });
      const row2 = await prisma.mobileRefreshToken.findUnique({ where: { tokenHash: hash(second.json.data.refreshToken) } });
      assert.ok(row1After.usedAt);
      assert.ok(row2);
      assert.equal(row2.familyId, row1.familyId);
      assert.equal(row2.revokedAt, null);

      const third = await request('/auth/refresh', { method: 'POST', body: { refreshToken: second.json.data.refreshToken } });
      assert.equal(third.status, 200);
      assert.notEqual(third.json.data.refreshToken, second.json.data.refreshToken);
    });

    await t.test('reusing a rotated token revokes its complete family', async () => {
      const first = await login('outsider@phase3.invalid');
      const rotated = await request('/auth/refresh', { method: 'POST', body: { refreshToken: first.refreshToken } });
      assert.equal(rotated.status, 200);
      assert.equal((await request('/auth/refresh', { method: 'POST', body: { refreshToken: first.refreshToken } })).status, 401);
      assert.equal((await request('/auth/refresh', { method: 'POST', body: { refreshToken: rotated.json.data.refreshToken } })).status, 401);
      const original = await prisma.mobileRefreshToken.findUnique({ where: { tokenHash: hash(first.refreshToken) } });
      const family = await prisma.mobileRefreshToken.findMany({ where: { familyId: original.familyId } });
      assert.ok(family.length >= 2);
      assert.ok(family.every(row => row.revokedAt instanceof Date));
    });

    await t.test('expired and arbitrary refresh tokens are rejected without storing plaintext', async () => {
      const first = await login('member@phase3.invalid');
      await prisma.mobileRefreshToken.update({
        where: { tokenHash: hash(first.refreshToken) },
        data: { expiresAt: new Date(Date.now() - 1_000) },
      });
      assert.equal((await request('/auth/refresh', { method: 'POST', body: { refreshToken: first.refreshToken } })).status, 401);
      assert.equal((await request('/auth/refresh', { method: 'POST', body: { refreshToken: 'arbitrary-refresh-token' } })).status, 401);
      const expired = await prisma.mobileRefreshToken.findUnique({ where: { tokenHash: hash(first.refreshToken) } });
      assert.ok(expired.revokedAt instanceof Date);
    });

    await t.test('concurrent use of one refresh token cannot leave two live successors', async () => {
      const first = await login('manager@phase3.invalid');
      const results = await Promise.all([
        request('/auth/refresh', { method: 'POST', body: { refreshToken: first.refreshToken } }),
        request('/auth/refresh', { method: 'POST', body: { refreshToken: first.refreshToken } }),
      ]);
      assert.deepEqual(results.map(result => result.status).sort(), [200, 401]);
      const original = await prisma.mobileRefreshToken.findUnique({ where: { tokenHash: hash(first.refreshToken) } });
      const activeCount = await prisma.mobileRefreshToken.count({ where: { familyId: original.familyId, revokedAt: null, usedAt: null } });
      assert.ok(activeCount <= 1);
    });

    await t.test('logout is idempotent and revokes refresh state while access JWT stays stateless', async () => {
      const first = await login('owner@phase3.invalid');
      const rotated = await request('/auth/refresh', { method: 'POST', body: { refreshToken: first.refreshToken } });
      const currentRefresh = rotated.json.data.refreshToken;
      assert.equal((await request('/auth/logout', { method: 'POST', body: { refreshToken: currentRefresh } })).status, 200);
      assert.equal((await request('/auth/logout', { method: 'POST', body: { refreshToken: currentRefresh } })).status, 200);
      assert.equal((await request('/auth/refresh', { method: 'POST', body: { refreshToken: currentRefresh } })).status, 401);
      assert.equal((await request('/me', { token: rotated.json.data.accessToken })).status, 200);
    });

    await t.test('deleting a user cascades all stored refresh hashes', async () => {
      const issued = await login('cascade@phase3.invalid');
      assert.equal(await prisma.mobileRefreshToken.count({ where: { userId: ids.cascade } }), 1);
      await prisma.user.delete({ where: { id: ids.cascade } });
      assert.equal(await prisma.mobileRefreshToken.count({ where: { tokenHash: hash(issued.refreshToken) } }), 0);
    });

    await t.test('team reads require active membership even for SUPER_ADMIN', async () => {
      for (const role of ['owner', 'manager', 'member']) {
        const result = await request(`/teams/${ids.normalTeam}`, { token: tokens[role].accessToken });
        assert.equal(result.status, 200);
        assert.equal(result.json.data.team.myRole, role.toUpperCase());
        assertPublicTeamPayload(result.json);
      }
      assert.equal((await request(`/teams/${ids.normalTeam}`, { token: tokens.outsider.accessToken })).status, 404);
      assert.equal((await request(`/teams/${ids.normalTeam}`, { token: tokens.superadmin.accessToken })).status, 404);
      assert.equal((await request(`/teams/${ids.hiddenTeam}`, { token: tokens.outsider.accessToken })).status, 404);
    });

    await t.test('member management enforces owner, manager, self and cross-team boundaries', async () => {
      const owner = tokens.owner.accessToken;
      const manager = tokens.manager.accessToken;
      const member = tokens.member.accessToken;
      const ownerMember = await prisma.teamMember.findUnique({ where: { userId_teamId: { userId: ids.owner, teamId: ids.normalTeam } } });
      const extraManager = await prisma.teamMember.findUnique({ where: { userId_teamId: { userId: ids.extraManager, teamId: ids.normalTeam } } });
      const removable = await prisma.teamMember.findUnique({ where: { userId_teamId: { userId: ids.removable, teamId: ids.normalTeam } } });
      const hiddenMember = await prisma.teamMember.findUnique({ where: { userId_teamId: { userId: ids.member, teamId: ids.hiddenTeam } } });

      assert.equal((await request(`/teams/${ids.normalTeam}/members/${extraManager.id}`, { method: 'PATCH', token: owner, body: { role: 'MANAGER' } })).status, 200);
      assert.equal((await request(`/teams/${ids.normalTeam}/members/${removable.id}`, { method: 'PATCH', token: manager, body: { role: 'MANAGER' } })).status, 403);
      assert.equal((await request(`/teams/${ids.normalTeam}/members/${ownerMember.id}`, { method: 'DELETE', token: owner })).status, 400);
      assert.equal((await request(`/teams/${ids.normalTeam}/members/${extraManager.id}`, { method: 'DELETE', token: manager })).status, 403);
      assert.equal((await request(`/teams/${ids.normalTeam}/members/${removable.id}`, { method: 'DELETE', token: member })).status, 403);
      assert.equal((await request(`/teams/${ids.normalTeam}/members/${hiddenMember.id}`, { method: 'DELETE', token: owner })).status, 404);
      assert.equal((await request(`/teams/${ids.normalTeam}/members/${removable.id}`, { method: 'DELETE', token: manager })).status, 200);
    });

    await t.test('bulk score writes enforce manager privilege, active team and team-scoped member IDs', async () => {
      const normalMember = await prisma.teamMember.findUnique({ where: { userId_teamId: { userId: ids.member, teamId: ids.normalTeam } } });
      const hiddenMember = await prisma.teamMember.findUnique({ where: { userId_teamId: { userId: ids.member, teamId: ids.hiddenTeam } } });
      const body = memberId => ({
        teamId: ids.normalTeam,
        gameDate: '2026-09-23',
        gameType: '정기전',
        memo: null,
        players: [{ name: 'Fixture Member', memberId, scores: [123] }],
      });
      assert.equal((await request('/scores/bulk', { method: 'POST', token: tokens.owner.accessToken, body: body(normalMember.id) })).status, 201);
      assert.equal((await request('/scores/bulk', { method: 'POST', token: tokens.manager.accessToken, body: body(normalMember.id) })).status, 201);
      assert.equal((await request('/scores/bulk', { method: 'POST', token: tokens.member.accessToken, body: body(normalMember.id) })).status, 403);
      assert.equal((await request('/scores/bulk', { method: 'POST', token: tokens.outsider.accessToken, body: body(normalMember.id) })).status, 403);
      assert.equal((await request('/scores/bulk', { method: 'POST', token: tokens.owner.accessToken, body: body(hiddenMember.id) })).status, 400);
      const inactiveBody = { ...body(normalMember.id), teamId: ids.inactiveTeam };
      assert.equal((await request('/scores/bulk', { method: 'POST', token: tokens.owner.accessToken, body: inactiveBody })).status, 404);
    });

    await t.test('activity reads and mutations enforce role, revision and team boundaries', async () => {
      const activityId = '2026-09-23~REGULAR';
      const encodedActivityId = encodeURIComponent(activityId);
      const normalMember = await prisma.teamMember.findUnique({
        where: { userId_teamId: { userId: ids.member, teamId: ids.normalTeam } },
      });

      assert.equal((await request(`/teams/${ids.normalTeam}/activities/${encodedActivityId}`, {
        token: tokens.member.accessToken,
      })).status, 200);
      assert.equal((await request(`/teams/${ids.normalTeam}/activities/${encodedActivityId}/edit`, {
        token: tokens.member.accessToken,
      })).status, 403);
      assert.equal((await request(`/teams/${ids.hiddenTeam}/activities/${encodedActivityId}`, {
        token: tokens.owner.accessToken,
      })).status, 404);

      const editable = await request(`/teams/${ids.normalTeam}/activities/${encodedActivityId}/edit`, {
        token: tokens.owner.accessToken,
      });
      assert.equal(editable.status, 200);
      const revision = editable.json.data.activity.revision;
      const mutation = {
        revision,
        date: '2026-09-23',
        gameType: '정기전',
        memo: null,
        participants: [{ memberId: normalMember.id, name: 'Fixture Member', scores: [124, 125] }],
      };
      assert.equal((await request(`/teams/${ids.normalTeam}/activities/${encodedActivityId}/edit`, {
        method: 'PUT', token: tokens.owner.accessToken, body: { ...mutation, revision: 'stale' },
      })).status, 409);
      assert.equal((await request(`/teams/${ids.normalTeam}/activities/${encodedActivityId}/edit`, {
        method: 'PUT', token: tokens.manager.accessToken, body: mutation,
      })).status, 200);

      const updated = await request(`/teams/${ids.normalTeam}/activities/${encodedActivityId}/edit`, {
        token: tokens.manager.accessToken,
      });
      assert.equal(updated.status, 200);
      const updatedRevision = updated.json.data.activity.revision;
      assert.notEqual(updatedRevision, revision);
      assert.equal((await request(`/teams/${ids.normalTeam}/activities/${encodedActivityId}`, {
        method: 'DELETE', token: tokens.member.accessToken, body: { revision: updatedRevision },
      })).status, 403);
      assert.equal((await request(`/teams/${ids.normalTeam}/activities/${encodedActivityId}`, {
        method: 'DELETE', token: tokens.manager.accessToken, body: { revision: updatedRevision },
      })).status, 200);
    });

    await t.test('event and Bowler Hidden gates are enforced by the backend', async () => {
      const baseEvent = {
        title: 'Phase 3 Event', date: '2026-09-24', time: '19:00', location: 'Fixture Lanes',
        gameType: '정기전', attendanceEnabled: true, laneDrawEnabled: false, laneDrawMode: 'BULK',
        competitionEnabled: false,
      };
      assert.equal((await request(`/teams/${ids.normalTeam}/events`, { method: 'POST', token: tokens.member.accessToken, body: baseEvent })).status, 403);
      assert.equal((await request(`/teams/${ids.normalTeam}/events`, { method: 'POST', token: tokens.outsider.accessToken, body: baseEvent })).status, 404);
      const created = await request(`/teams/${ids.normalTeam}/events`, { method: 'POST', token: tokens.owner.accessToken, body: baseEvent });
      assert.equal(created.status, 201);
      const eventId = created.json.data.event.id;
      assert.equal((await request(`/teams/${ids.normalTeam}/events`, { token: tokens.member.accessToken })).status, 200);
      assert.equal((await request(`/teams/${ids.normalTeam}/events`, { token: tokens.outsider.accessToken })).status, 404);
      assert.equal((await request(`/teams/${ids.normalTeam}/events/${eventId}/attendance`, { method: 'PUT', token: tokens.member.accessToken, body: { status: 'ATTENDING' } })).status, 200);
      assert.equal((await request(`/teams/${ids.normalTeam}/events/${eventId}`, { method: 'PATCH', token: tokens.member.accessToken, body: baseEvent })).status, 403);
      assert.equal((await request(`/teams/${ids.normalTeam}/events/${eventId}`, { method: 'PATCH', token: tokens.manager.accessToken, body: { ...baseEvent, title: 'Manager Update' } })).status, 200);
      assert.equal((await request(`/teams/${ids.normalTeam}/events/${eventId}`, { method: 'DELETE', token: tokens.owner.accessToken })).status, 200);
      assert.equal((await request(`/teams/${ids.normalTeam}/events`, { method: 'POST', token: tokens.owner.accessToken, body: { ...baseEvent, competitionEnabled: true, competitionType: 'INDIVIDUAL', competitionMode: 'OFFICIAL', rankPoints: [] } })).status, 403);
      assert.equal((await request(`/teams/${ids.normalTeam}/season-ranking`, { token: tokens.owner.accessToken })).status, 404);
      assert.equal((await request(`/teams/${ids.normalTeam}/season-finals`, { token: tokens.owner.accessToken })).status, 404);

      for (const role of ['owner', 'manager', 'member']) {
        assert.equal((await request(`/teams/${ids.hiddenTeam}/season-ranking`, { token: tokens[role].accessToken })).status, 200);
      }
      assert.equal((await request(`/teams/${ids.hiddenTeam}/season-ranking`, { token: tokens.superadmin.accessToken })).status, 404);
    });

    await t.test('board reads require membership and only the author can mutate a post', async () => {
      const created = await request(`/teams/${ids.normalTeam}/posts`, {
        method: 'POST', token: tokens.member.accessToken,
        body: { title: 'Fixture Post', content: 'Fixture content' },
      });
      assert.equal(created.status, 201);
      const postId = created.json.data.postId;
      assert.equal((await request(`/teams/${ids.normalTeam}/posts`, { token: tokens.owner.accessToken })).status, 200);
      assert.equal((await request(`/teams/${ids.normalTeam}/posts/${postId}`, { token: tokens.manager.accessToken })).status, 200);
      assert.equal((await request(`/teams/${ids.normalTeam}/posts`, { token: tokens.outsider.accessToken })).status, 404);
      assert.equal((await request(`/teams/${ids.normalTeam}/posts/${postId}`, { method: 'PATCH', token: tokens.owner.accessToken, body: { title: 'Owner edit', content: 'Denied' } })).status, 403);
      assert.equal((await request(`/teams/${ids.normalTeam}/posts/${postId}`, { method: 'PATCH', token: tokens.member.accessToken, body: { title: 'Author edit', content: 'Allowed' } })).status, 200);
      assert.equal((await request(`/teams/${ids.normalTeam}/posts/${postId}`, { method: 'DELETE', token: tokens.manager.accessToken })).status, 403);
      assert.equal((await request(`/teams/${ids.normalTeam}/posts/${postId}`, { method: 'DELETE', token: tokens.member.accessToken })).status, 200);
    });
  } finally {
    if (server && !server.killed) {
      server.kill();
      await Promise.race([
        new Promise(resolve => server.once('exit', resolve)),
        new Promise(resolve => setTimeout(resolve, 5_000)),
      ]);
    }
    if (prisma) await prisma.$disconnect();
    for (let attempt = 0; attempt < 5 && fs.existsSync(databasePath); attempt += 1) {
      try { fs.rmSync(databasePath, { force: true }); } catch { await new Promise(resolve => setTimeout(resolve, 200)); }
    }
    assert.equal(fs.existsSync(databasePath), false, 'isolated SQLite fixture should be removed');
  }
});

function pushCurrentSchema(databasePath, env) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      execFileSync(process.execPath, [prismaCli, 'db', 'push', '--skip-generate'], {
        cwd: repositoryRoot,
        env: { ...env, DEBUG: 'prisma:*', RUST_BACKTRACE: '1', RUST_LOG: 'info' },
        stdio: 'pipe',
        timeout: 60_000,
        windowsHide: true,
      });
      return;
    } catch (error) {
      lastError = error;
      try { fs.rmSync(databasePath, { force: true }); } catch {}
    }
  }
  const safeMessage = lastError instanceof Error ? lastError.message : 'unknown Prisma setup failure';
  throw new Error(`Unable to create isolated Phase 3 schema: ${safeMessage}`);
}

async function createFixtures(prisma) {
  const password = await bcrypt.hash(fixturePassword, 10);
  const users = [
    [ids.superadmin, 'superadmin', 'SUPER_ADMIN', password],
    [ids.owner, 'owner', 'USER', password],
    [ids.manager, 'manager', 'USER', password],
    [ids.member, 'member', 'USER', password],
    [ids.outsider, 'outsider', 'USER', password],
    [ids.oauth, 'oauth', 'USER', null],
    [ids.cascade, 'cascade', 'USER', password],
    [ids.extraManager, 'extra-manager', 'USER', password],
    [ids.removable, 'removable', 'USER', password],
  ];
  for (const [id, local, role, userPassword] of users) {
    await prisma.user.create({
      data: {
        id,
        email: `${local}@phase3.invalid`,
        name: `Phase3 ${local}`,
        role,
        password: userPassword,
        emailVerified: new Date('2026-01-01T00:00:00.000Z'),
      },
    });
  }
  await prisma.team.create({
    data: {
      id: ids.normalTeam, name: 'NORMAL_TEAM', code: 'PHASE3-NORMAL', ownerId: ids.owner,
      bowlerHiddenEnabled: false, seasonRankingEnabled: false,
      User: { connect: { id: ids.manager } },
    },
  });
  await prisma.team.create({
    data: {
      id: ids.hiddenTeam, name: 'HIDDEN_TEAM', code: 'PHASE3-HIDDEN', ownerId: ids.owner,
      bowlerHiddenEnabled: true, seasonRankingEnabled: true,
      User: { connect: { id: ids.manager } },
    },
  });
  await prisma.team.create({
    data: {
      id: ids.inactiveTeam, name: 'INACTIVE_TEAM', code: 'PHASE3-INACTIVE', ownerId: ids.owner,
      isActive: false,
    },
  });
  const memberships = [
    ['normal-owner', ids.owner, ids.normalTeam],
    ['normal-manager', ids.manager, ids.normalTeam],
    ['normal-member', ids.member, ids.normalTeam],
    ['normal-extra-manager', ids.extraManager, ids.normalTeam],
    ['normal-removable', ids.removable, ids.normalTeam],
    ['hidden-owner', ids.owner, ids.hiddenTeam],
    ['hidden-manager', ids.manager, ids.hiddenTeam],
    ['hidden-member', ids.member, ids.hiddenTeam],
    ['inactive-owner', ids.owner, ids.inactiveTeam],
  ];
  for (const [id, userId, teamId] of memberships) {
    await prisma.teamMember.create({ data: { id, userId, teamId } });
  }
  await prisma.teamSeason.create({
    data: {
      id: 'phase3-hidden-season', teamId: ids.hiddenTeam, name: 'Phase 3 Season',
      startDate: new Date('2026-01-01T00:00:00.000Z'), endDate: new Date('2026-12-31T00:00:00.000Z'),
      enabled: true, status: 'ACTIVE',
    },
  });
}

async function reservePort() {
  const socket = net.createServer();
  await new Promise((resolve, reject) => socket.once('error', reject).listen(0, '127.0.0.1', resolve));
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  return port;
}

async function waitForHealth(baseUrl, server, logs) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Next test server exited early.\n${logs()}`);
    try {
      const response = await fetch(`${baseUrl}/api/mobile/v1/health`);
      if (response.status === 200) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`Next test server did not become ready.\n${logs()}`);
}

function hash(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function assertPublicTeamPayload(value) {
  const keys = new Set();
  const visit = item => {
    if (Array.isArray(item)) return item.forEach(visit);
    if (!item || typeof item !== 'object') return;
    for (const [key, child] of Object.entries(item)) {
      keys.add(key.toLowerCase());
      visit(child);
    }
  };
  visit(value);
  for (const forbidden of ['email', 'userid', 'password', 'provider', 'tokenhash', 'invitecode']) {
    assert.equal(keys.has(forbidden), false, `team response must not expose ${forbidden}`);
  }
}
