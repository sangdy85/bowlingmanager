// Every operation uses a disposable SQLite database. No live bank or production calls.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createRequire } = require('node:module');
const ts = require('typescript');
const { PrismaClient } = require('@prisma/client');
function loadTs(relative, overrides, cache = new Map()) {
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
const rejectsCode = (promise, code) => assert.rejects(promise, e => e.code === code);

test('game fee reports and account settings across a real migrated database', { timeout: 120000 }, async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'event-game-fees-'));
  const url = `file:${path.join(dir, 'test.db').replace(/\\/g, '/')}`;
  let db;
  try {
    // Prisma 5's Windows schema engine requires the isolated SQLite file to exist.
    db = new PrismaClient({ datasources: { db: { url } } });
    await db.$queryRawUnsafe('SELECT 1');
    await db.$disconnect();
    execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
      cwd: path.resolve(__dirname, '..'), env: { ...process.env, DATABASE_URL: url, CHECKPOINT_DISABLE: '1' }, stdio: 'pipe',
    });
    db = new PrismaClient({ datasources: { db: { url } } });
    const overrides = { '@/lib/prisma': { default: db, __esModule: true } };
    const cache = new Map();
    const service = loadTs('src/lib/mobile-api/event-game-fees.ts', overrides, cache);
    const events = loadTs('src/lib/mobile-api/team-events.ts', overrides, cache);
    const origin = loadTs('src/lib/mobile-api/payment-write-origin.ts', overrides, cache);
    for (const id of ['owner', 'manager', 'member', 'other', 'outsider']) {
      await db.user.create({ data: { id, name: id, email: `${id}@example.invalid` } });
    }
    await db.team.create({ data: { id: 'team', name: '팀', code: 'FEE-TEST', ownerId: 'owner',
      User: { connect: { id: 'manager' } },
      members: { create: ['owner', 'manager', 'member', 'other'].map(id => ({ id: `m-${id}`, userId: id })) },
    } });
    await db.team.create({ data: { id: 'foreign', name: '다른팀', code: 'FOREIGN', ownerId: 'outsider', members: { create: { userId: 'outsider' } } } });
    await db.teamEvent.create({ data: { id: 'event', teamId: 'team', createdById: 'owner', title: '정기전',
      eventDate: new Date('2026-10-15'), eventTime: '19:00', location: '볼링장' } });
    const accountBody = { kind: 'GAME_FEE', bankName: '카카오뱅크', accountNumber: '3333-12-1234567', holderName: '회장', revision: 0 };
    let account;
    await t.test('members cannot read or edit settings, including other and inactive teams', async () => {
      await rejectsCode(service.getPaymentAccounts('member', 'team'), 'FORBIDDEN');
      await rejectsCode(service.savePaymentAccount('member', 'team', accountBody), 'FORBIDDEN');
      await rejectsCode(service.savePaymentAccount('outsider', 'team', accountBody), 'TEAM_NOT_FOUND');
      await db.team.update({ where: { id: 'team' }, data: { isActive: false } });
      await rejectsCode(service.getPaymentAccounts('owner', 'team'), 'TEAM_NOT_FOUND');
      await db.team.update({ where: { id: 'team' }, data: { isActive: true } });
    });
    await t.test('separate dues/game accounts, format validation and stale configuration protection', async () => {
      for (const change of [{ accountNumber: 'abc123' }, { holderName: '' }, { kind: 'OTHER' }, { bankName: 'x\n' }]) {
        await rejectsCode(service.savePaymentAccount('owner', 'team', { ...accountBody, ...change }), 'INVALID_ACCOUNT');
      }
      account = (await service.savePaymentAccount('owner', 'team', accountBody)).account;
      assert.equal(account.accountNumber, '3333121234567');
      await service.savePaymentAccount('manager', 'team', { ...accountBody, kind: 'DUES', accountNumber: '999988887777' });
      const all = (await service.getPaymentAccounts('manager', 'team')).accounts;
      assert.equal(all.length, 2);
      await rejectsCode(service.savePaymentAccount('owner', 'team', accountBody), 'STALE_ACCOUNT');
    });
    await t.test('attendance is mandatory and selecting attendance keeps the fee unpaid', async () => {
      await rejectsCode(service.updateGameFee('member', 'team', 'event', { action: ['REQUEST_CASH'], revision: 0 }), 'INVALID_REQUEST');
      await rejectsCode(service.updateGameFee('member', 'team', 'event', { action: 'REQUEST_CASH', revision: 0 }), 'ATTENDANCE_REQUIRED');
      await events.updateMyAttendance('member', 'team', 'event', { status: 'ATTENDING' });
      const event = await events.getTeamEvent('member', 'team', 'event');
      assert.equal(event.myGameFee.status, 'UNPAID');
      assert.equal(event.gameFeeAccount.id, account.id);
      assert.ok(event.attendance.filter(a => a.memberId !== 'm-member').every(a => a.gameFee === null));
      assert.equal(event.gameFeeAccount.kind, undefined); // dues account is not exposed here
    });
    await t.test('report then correct-method admin confirmation with saved account snapshot', async () => {
      const report = { action: 'REQUEST_TRANSFER', revision: 0, accountId: account.id, accountRevision: account.revision };
      await rejectsCode(service.updateGameFee('member', 'team', 'event', { ...report, accountRevision: 999 }), 'STALE_ACCOUNT');
      await rejectsCode(service.updateGameFee('member', 'team', 'event', { ...report, memberId: 'm-other' }), 'FORBIDDEN');
      await rejectsCode(service.updateGameFee('member', 'foreign', 'event', report), 'TEAM_NOT_FOUND');
      await rejectsCode(service.updateGameFee('outsider', 'foreign', 'event', report), 'EVENT_NOT_FOUND');
      assert.equal((await service.updateGameFee('member', 'team', 'event', report)).status, 'TRANSFER_REQUESTED');
      await rejectsCode(service.updateGameFee('member', 'team', 'event', report), 'STALE_PAYMENT');
      await rejectsCode(service.updateGameFee('member', 'team', 'event', { action: 'CONFIRM_TRANSFER', revision: 1, memberId: 'm-member' }), 'FORBIDDEN');
      await rejectsCode(service.updateGameFee('manager', 'team', 'event', { action: 'CONFIRM_CASH', revision: 1, memberId: 'm-member' }), 'INVALID_PAYMENT_STATE');
      await service.savePaymentAccount('owner', 'team', { ...accountBody, revision: 1, accountNumber: '111122223333' });
      const pending = await events.getTeamEvent('manager', 'team', 'event');
      assert.equal(pending.attendance.find(a => a.memberId === 'm-member').gameFee.account.accountNumber, '3333121234567');
      assert.equal(pending.gameFeeAccount.accountNumber, '111122223333');
      await service.updateGameFee('manager', 'team', 'event', { action: 'CONFIRM_TRANSFER', revision: 1, memberId: 'm-member' });
      const memberEvent = await events.getTeamEvent('member', 'team', 'event');
      assert.equal(memberEvent.myGameFee.status, 'TRANSFER_CONFIRMED');
      assert.ok(memberEvent.myGameFee.confirmedAt);
      await rejectsCode(service.updateGameFee('member', 'team', 'event', { action: 'CANCEL_REQUEST', revision: 2 }), 'INVALID_PAYMENT_STATE');
      await rejectsCode(service.updateGameFee('manager', 'team', 'event', { action: 'CONFIRM_TRANSFER', revision: 2, memberId: 'm-member' }), 'INVALID_PAYMENT_STATE');
    });
    await t.test('changing attendance preserves confirmed payments', async () => {
      await events.updateMyAttendance('member', 'team', 'event', { status: 'NOT_ATTENDING' });
      assert.equal((await events.getTeamEvent('member', 'team', 'event')).myGameFee.status, 'TRANSFER_CONFIRMED');
      await events.updateMemberAttendance('owner', 'team', 'event', 'm-member', { status: 'ATTENDING' });
      assert.equal((await events.getTeamEvent('member', 'team', 'event')).myGameFee.status, 'TRANSFER_CONFIRMED');
    });
    await t.test('cancel prevents stale confirmation and permits changing the reported method', async () => {
      await events.updateMyAttendance('other', 'team', 'event', { status: 'ATTENDING' });
      await service.updateGameFee('other', 'team', 'event', { action: 'REQUEST_TRANSFER', revision: 0, accountId: account.id, accountRevision: 2 });
      await service.updateGameFee('other', 'team', 'event', { action: 'CANCEL_REQUEST', revision: 1 });
      await rejectsCode(service.updateGameFee('owner', 'team', 'event', { action: 'CONFIRM_TRANSFER', revision: 1, memberId: 'm-other' }), 'STALE_PAYMENT');
      await service.updateGameFee('other', 'team', 'event', { action: 'REQUEST_CASH', revision: 2 });
      await service.updateGameFee('owner', 'team', 'event', { action: 'CONFIRM_CASH', revision: 3, memberId: 'm-other' });
      const row = await db.teamEventAttendance.findUnique({ where: { eventId_memberId: { eventId: 'event', memberId: 'm-other' } } });
      assert.equal(row.gameFeeStatus, 'CASH_CONFIRMED');
      assert.equal(row.gameFeeConfirmedBy, 'owner');
      assert.equal(row.gameFeeAccountJson, null);
      const audits = await db.teamGameFeeAudit.findMany({ orderBy: { createdAt: 'asc' } });
      assert.equal(audits.length, 6);
      assert.equal(audits[0].previousStatus, 'UNPAID');
      assert.equal(audits.at(-1).nextStatus, 'CASH_CONFIRMED');
    });
    await t.test('cash works without an account and after draw closes attendance changes', async () => {
      await db.teamPaymentAccount.deleteMany({ where: { kind: 'GAME_FEE' } });
      await events.updateMyAttendance('owner', 'team', 'event', { status: 'ATTENDING' });
      await db.teamEvent.update({ where: { id: 'event' }, data: { laneDrawStatus: 'COMPLETED' } });
      await rejectsCode(service.updateGameFee('owner', 'team', 'event', { action: 'REQUEST_TRANSFER', revision: 0 }), 'ACCOUNT_NOT_CONFIGURED');
      await service.updateGameFee('owner', 'team', 'event', { action: 'REQUEST_CASH', revision: 0 });
      await service.updateGameFee('manager', 'team', 'event', { action: 'CONFIRM_CASH', revision: 1, memberId: 'm-owner' });
      assert.equal((await events.getTeamEvent('owner', 'team', 'event')).myGameFee.status, 'CASH_CONFIRMED');
    });
    await t.test('audit failure rolls back the payment change', async () => {
      await db.teamEvent.update({ where: { id: 'event' }, data: { laneDrawStatus: 'NOT_STARTED' } });
      await events.updateMyAttendance('manager', 'team', 'event', { status: 'ATTENDING' });
      const brokenDb = { $transaction: (callback, options) => db.$transaction(tx => callback(new Proxy(tx, {
        get(target, key) {
          return key === 'teamGameFeeAudit' ? { create: async () => { throw new Error('Audit unavailable'); } } : target[key];
        },
      })), options) };
      const broken = loadTs('src/lib/mobile-api/event-game-fees.ts', { '@/lib/prisma': brokenDb });
      await assert.rejects(broken.updateGameFee('manager', 'team', 'event', { action: 'REQUEST_CASH', revision: 0 }), /Audit unavailable/);
      const current = await db.teamEventAttendance.findUnique({ where: { eventId_memberId: { eventId: 'event', memberId: 'm-manager' } } });
      assert.equal(current.gameFeeStatus, 'UNPAID');
      assert.equal(current.gameFeeRevision, 0);
    });
    await t.test('database rejects unknown fee state and cookie writes require same origin', async () => {
      await assert.rejects(db.teamEventAttendance.updateMany({ data: { gameFeeStatus: 'PAID' } }));
      const req = headers => new Request('https://club.example/api/payment', { method: 'POST', headers });
      assert.throws(() => origin.assertPaymentWriteOrigin(req({})), e => e.code === 'FORBIDDEN');
      assert.throws(() => origin.assertPaymentWriteOrigin(req({ origin: 'https://evil.example' })), e => e.code === 'FORBIDDEN');
      assert.doesNotThrow(() => origin.assertPaymentWriteOrigin(req({ origin: 'https://club.example' })));
      assert.doesNotThrow(() => origin.assertPaymentWriteOrigin(req({ authorization: 'Bearer token' })));
    });
    await t.test('event removal preserves financial history snapshots', async () => {
      await db.teamEvent.delete({ where: { id: 'event' } });
      const history = await db.teamGameFeeAudit.findMany({ where: { eventSnapshotId: 'event' } });
      assert.equal(history.length, 8);
      assert.ok(history.every(item => item.attendanceId === null && item.eventTitle === '정기전'));
      assert.ok(history.some(item => item.accountJson?.includes('3333121234567')));
    });
  } finally {
    if (db) await db.$disconnect();
    assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(dir).startsWith('event-game-fees-'));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
