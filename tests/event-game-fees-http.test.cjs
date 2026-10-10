// Runs the real route/auth/Prisma stack on loopback against a freshly migrated temporary DB.
// Never accepts a remote URL, user credentials, or an external database.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn, execFileSync } = require('node:child_process');
const { once } = require('node:events');
const { PrismaClient } = require('@prisma/client');
const root = path.resolve(__dirname, '..');

async function reservePort() {
  const server = net.createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

test('real HTTP game fee lifecycle, authentication, privacy and conflicts', { timeout: 180000 }, async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'game-fees-http-'));
  const databaseUrl = `file:${path.join(dir, 'fixture.db').replace(/\\/g, '/')}`;
  const secret = 'game-fee-http-test-only-secret-not-used-in-production';
  const env = { ...process.env, DATABASE_URL: databaseUrl, MOBILE_API_JWT_SECRET: secret,
    AUTH_SECRET: 'game-fee-http-independent-auth-test-only-secret', AUTH_TRUST_HOST: 'true',
    NEXT_TELEMETRY_DISABLED: '1', CHECKPOINT_DISABLE: '1' };
  let db, server;
  let logs = '';
  try {
    // Initialize only this freshly allocated local file before schema-engine migration.
    db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await db.$queryRawUnsafe('SELECT 1');
    await db.$disconnect();
    execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { cwd: root, env, stdio: 'pipe' });
    db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    const actors = ['owner', 'manager', 'member', 'cash', 'outsider'];
    for (const id of actors) await db.user.create({ data: { id, name: id, email: `${id}@game-fees.invalid` } });
    await db.team.create({ data: { id: 'team', name: '검증 전용 동호회', code: 'HTTP-FEES', ownerId: 'owner',
      User: { connect: { id: 'manager' } }, members: { create: actors.filter(id => id !== 'outsider').map(id => ({ id: `m-${id}`, userId: id })) } } });
    await db.team.create({ data: { id: 'foreign', name: '다른 동호회', code: 'HTTP-OTHER', ownerId: 'outsider', members: { create: { userId: 'outsider' } } } });
    await db.teamEvent.create({ data: { id: 'event', teamId: 'team', createdById: 'owner', title: 'HTTP 검증 일정',
      eventDate: new Date('2026-10-15'), eventTime: '19:00', location: '테스트' } });
    const { SignJWT } = await import('jose');
    const tokens = {};
    for (const id of actors) tokens[id] = await new SignJWT({ tokenType: 'access', tokenVersion: 1 })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' }).setSubject(id)
      .setIssuer('bowlingmanager-mobile-api').setAudience('bowlingmanager-flutter')
      .setIssuedAt().setExpirationTime('10m').sign(new TextEncoder().encode(secret));
    const port = await reservePort();
    const origin = `http://127.0.0.1:${port}`;
    // Isolate Next's cache/output so this test neither consumes a stale build nor changes a development server.
    const appDir = path.join(dir, 'app');
    fs.mkdirSync(appDir);
    for (const item of ['src', 'public']) fs.cpSync(path.join(root, item), path.join(appDir, item), { recursive: true, filter: source => !path.relative(root, source).split(path.sep).includes('uploads') });
    for (const item of ['package.json', 'tsconfig.json', 'next.config.mjs', 'next-env.d.ts']) fs.copyFileSync(path.join(root, item), path.join(appDir, item));
    fs.symlinkSync(path.join(root, 'node_modules'), path.join(appDir, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
    server = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'dev', '--hostname', '127.0.0.1', '--port', String(port)],
      { cwd: appDir, env, stdio: ['ignore', 'pipe', 'pipe'] });
    server.stdout.on('data', data => { logs = (logs + data).slice(-16000); });
    server.stderr.on('data', data => { logs = (logs + data).slice(-16000); });
    const deadline = Date.now() + 90000;
    let ready = false;
    while (Date.now() < deadline) {
      if (server.exitCode !== null) throw new Error(`Test server exited: ${logs}`);
      try {
        const res = await fetch(`${origin}/api/mobile/v1/health`, { signal: AbortSignal.timeout(1500) });
        if (res.ok) { ready = true; break; }
      } catch { /* initial compilation */ }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    assert.ok(ready, `Test server did not start: ${logs}`);
    const request = async (suffix, actor, method = 'GET', body, expected = 200) => {
      const res = await fetch(`${origin}/api/mobile/v1/teams/${suffix}`, {
        method, signal: AbortSignal.timeout(30000),
        headers: { ...(actor ? { authorization: `Bearer ${tokens[actor] ?? actor}` } : {}),
          ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
        ...(body !== undefined ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}),
      });
      const json = await res.json();
      assert.equal(res.status, expected, `${method} ${suffix}: ${JSON.stringify(json)}`);
      assert.match(res.headers.get('cache-control'), /no-store/);
      return json;
    };
    const accountPath = 'team/payment-accounts';
    const eventPath = 'team/events/event';
    const feePath = `${eventPath}/game-fee`;
    const accountBody = { kind: 'GAME_FEE', bankName: '카카오뱅크', accountNumber: '3333121234567', holderName: '검증 예금주', revision: 0 };
    let account;
    await t.test('anonymous, invalid token, member and outsider cannot manage accounts', async () => {
      await request(accountPath, null, 'GET', undefined, 401);
      await request(accountPath, 'invalid-token', 'GET', undefined, 401);
      await request(accountPath, 'member', 'PUT', accountBody, 403);
      await request(accountPath, 'outsider', 'GET', undefined, 404);
      await request(feePath, null, 'POST', { action: 'REQUEST_CASH', revision: 0 }, 401);
      await request(accountPath, 'owner', 'PUT', '{broken', 400);
      account = (await request(accountPath, 'owner', 'PUT', accountBody)).data.account;
      await request(accountPath, 'manager', 'PUT', { ...accountBody, kind: 'DUES', accountNumber: '888877776666' });
    });
    await t.test('attendance and two-step transfer report are reflected in both identities', async () => {
      await request(feePath, 'member', 'POST', { action: 'REQUEST_CASH', revision: 0 }, 409);
      await request(`${eventPath}/attendance`, 'member', 'PUT', { status: 'ATTENDING' });
      const initial = (await request(eventPath, 'member')).data.event;
      assert.equal(initial.myGameFee.status, 'UNPAID');
      assert.equal(initial.gameFeeAccount.accountNumber, accountBody.accountNumber);
      assert.ok(initial.attendance.filter(row => row.memberId !== 'm-member').every(row => row.gameFee === null));
      const body = { action: 'REQUEST_TRANSFER', revision: 0, accountId: account.id, accountRevision: account.revision };
      await request(feePath, 'member', 'POST', body);
      const manager = (await request(eventPath, 'manager')).data.event;
      assert.equal(manager.attendance.find(row => row.memberId === 'm-member').gameFee.status, 'TRANSFER_REQUESTED');
      await request(feePath, 'member', 'POST', body, 409);
      await request(feePath, 'member', 'POST', { action: 'CONFIRM_TRANSFER', revision: 1, memberId: 'm-member' }, 403);
      await request(feePath, 'manager', 'POST', { action: 'CONFIRM_CASH', revision: 1, memberId: 'm-member' }, 409);
      await request(feePath, 'manager', 'POST', { action: 'CONFIRM_TRANSFER', revision: 1, memberId: 'm-member' });
      assert.equal((await request(eventPath, 'member')).data.event.myGameFee.status, 'TRANSFER_CONFIRMED');
    });
    await t.test('cash reporting, stale approval and cross-team access are enforced at HTTP boundary', async () => {
      await request(`${eventPath}/attendance`, 'cash', 'PUT', { status: 'ATTENDING' });
      await request(feePath, 'cash', 'POST', { action: 'REQUEST_CASH', revision: 0 });
      await request(feePath, 'cash', 'POST', { action: 'CANCEL_REQUEST', revision: 1 });
      await request(feePath, 'owner', 'POST', { action: 'CONFIRM_CASH', revision: 1, memberId: 'm-cash' }, 409);
      await request(feePath, 'cash', 'POST', { action: 'REQUEST_CASH', revision: 2 });
      await request(feePath, 'owner', 'POST', { action: 'CONFIRM_CASH', revision: 3, memberId: 'm-cash' });
      assert.equal((await request(eventPath, 'cash')).data.event.myGameFee.status, 'CASH_CONFIRMED');
      await request('foreign/events/event/game-fee', 'outsider', 'POST', { action: 'REQUEST_CASH', revision: 0 }, 404);
      await request(feePath, 'cash', 'POST', { action: 'REQUEST_CASH', revision: 4, memberId: 'm-member' }, 403);
      assert.equal(await db.teamGameFeeAudit.count(), 6);
    });
  } finally {
    if (server && server.exitCode === null) {
      const stopped = once(server, 'exit');
      if (process.platform === 'win32') {
        // Next's dev worker is a child process; stop only this test's process tree.
        execFileSync('taskkill', ['/PID', String(server.pid), '/T', '/F'], { stdio: 'ignore' });
      } else {
        server.kill('SIGTERM');
      }
      const force = setTimeout(() => server.kill('SIGKILL'), 5000);
      try { await stopped; } finally { clearTimeout(force); }
    }
    if (db) await db.$disconnect();
    assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(dir).startsWith('game-fees-http-'));
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
});
