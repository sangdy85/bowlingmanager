// Synthetic fixtures only. No Firebase, database, or production calls.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { createRequire } = require('node:module');

function loadService(prisma) {
  const filename = path.resolve(__dirname, '../src/lib/mobile-api/notifications.ts');
  const module = { exports: {} };
  const nativeRequire = createRequire(filename);
  const localRequire = id => id === '@/lib/prisma' ? { default: prisma, __esModule: true } : nativeRequire(id);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  new Function('require', 'module', 'exports', compiled)(localRequire, module, module.exports);
  return module.exports;
}

test('device registration is scoped to the authenticated user and token refresh re-enables its device', async () => {
  const updates = [];
  const prisma = { mobilePushDevice: {
    findUnique: async ({ where }) => where.token === 'existing-token-1234567890' ? { userId: 'user-1' } : null,
    upsert: async input => { updates.push(input); return { id: 'device-1', platform: 'ANDROID', enabled: true, lastSeenAt: new Date() }; },
  } };
  const service = loadService(prisma);
  await service.registerMobilePushDevice('user-1', { token: 'existing-token-1234567890', platform: 'ANDROID' });
  assert.equal(updates.length, 1);
  assert.equal(updates[0].update.enabled, true);
  await assert.rejects(
    () => service.registerMobilePushDevice('user-2', { token: 'existing-token-1234567890', platform: 'ANDROID' }),
    error => error.code === 'DEVICE_TOKEN_CONFLICT' && error.status === 409,
  );
});

test('device revocation and notification reads always include authenticated user scope', async () => {
  const seen = [];
  const prisma = {
    mobilePushDevice: { updateMany: async input => { seen.push(['device', input.where]); return { count: 0 }; } },
    mobileNotification: { updateMany: async input => { seen.push(['notification', input.where]); return { count: 1 }; } },
  };
  const service = loadService(prisma);
  assert.deepEqual(await service.revokeMobilePushDevice('user-1', { token: 'token-owned-by-user-2' }), { revoked: false });
  assert.deepEqual(await service.markMobileNotificationRead('user-1', 'notification-1'), { read: true });
  assert.deepEqual(seen, [
    ['device', { userId: 'user-1', token: 'token-owned-by-user-2', enabled: true }],
    ['notification', { id: 'notification-1', userId: 'user-1' }],
  ]);
});

test('outbox uses stable notification/device keys and supports multiple devices', async () => {
  const notifications = new Map();
  const deliveries = new Map();
  const tx = {
    mobileNotification: { upsert: async ({ where, create }) => {
      const existing = notifications.get(where.dedupeKey);
      if (existing) return existing;
      const row = { id: `n-${notifications.size + 1}`, userId: create.userId };
      notifications.set(where.dedupeKey, row); return row;
    } },
    mobilePushDevice: { findMany: async () => [{ id: 'd1' }, { id: 'd2' }] },
    mobileNotificationDelivery: { upsert: async ({ where, create }) => {
      const key = `${where.notificationId_deviceId.notificationId}:${where.notificationId_deviceId.deviceId}`;
      deliveries.set(key, create);
    } },
  };
  const service = loadService({});
  const input = {
    userId: 'u1', dedupeKey: 'TEAM_DRAFT_TURN:e1:1:4:m1', type: 'TEAM_DRAFT_TURN',
    title: '선수 선택 차례입니다', body: '선수를 선택해 주세요.', teamId: 't1', eventId: 'e1', target: 'TEAM_DRAFT',
  };
  await service.enqueueMobileNotifications(tx, [input]);
  await service.enqueueMobileNotifications(tx, [input]);
  assert.equal(notifications.size, 1);
  assert.equal(deliveries.size, 2);
});

test('invalid FCM token disables only that device while other deliveries continue', async () => {
  const deliveryUpdates = [];
  const deviceUpdates = [];
  const rows = ['bad', 'good'].map((token, index) => ({
    id: `delivery-${index}`, deviceId: `device-${index}`, retryCount: 0,
    device: { id: `device-${index}`, token },
    notification: { title: 'title', body: 'body', data: '{"target":"EVENT_DETAIL","teamId":"t","eventId":"e"}' },
  }));
  const tx = {
    mobileNotificationDelivery: { update: async input => deliveryUpdates.push(input) },
    mobilePushDevice: { update: async input => deviceUpdates.push(input) },
  };
  const prisma = {
    mobileNotificationDelivery: {
      findMany: async () => rows,
      updateMany: async () => ({ count: 1 }),
      update: async input => deliveryUpdates.push(input),
    },
    $transaction: async callback => callback(tx),
  };
  const service = loadService(prisma);
  const result = await service.deliverPendingMobileNotifications(async ({ token }) => {
    if (token === 'bad') throw { code: 'messaging/registration-token-not-registered' };
  }, new Date('2026-09-26T00:00:00Z'));
  assert.deepEqual(result, { configured: true, attempted: 2, sent: 1, failed: 1, disabled: 1 });
  assert.equal(deviceUpdates.length, 1);
  assert.equal(deliveryUpdates.length, 2);
});

test('delivery worker atomically claims rows and skips a row claimed by another worker', async () => {
  let sends = 0;
  const row = {
    id: 'delivery-1', deviceId: 'device-1', status: 'PENDING', retryCount: 0,
    device: { id: 'device-1', token: 'token' },
    notification: { title: 'title', body: 'body', data: '{}' },
  };
  const prisma = {
    mobileNotificationDelivery: {
      findMany: async () => [row],
      updateMany: async input => {
        assert.equal(input.where.status, 'PENDING');
        assert.equal(input.data.status, 'PROCESSING');
        return { count: 0 };
      },
      update: async () => assert.fail('an unclaimed delivery must not be updated'),
    },
  };
  const service = loadService(prisma);
  const result = await service.deliverPendingMobileNotifications(async () => { sends += 1; });
  assert.equal(sends, 0);
  assert.deepEqual(result, { configured: true, attempted: 0, sent: 0, failed: 0, disabled: 0 });
});

test('notification source declares all required trigger types and transaction enqueue calls', () => {
  const notificationSource = fs.readFileSync(path.resolve(__dirname, '../src/lib/mobile-api/notifications.ts'), 'utf8');
  for (const type of [
    'LANE_DRAW_OPENED', 'LANE_ASSIGNED', 'INDIVIDUAL_GROUP_READY', 'TEAM_CAPTAIN_SELECTED',
    'TEAM_DRAFT_TURN', 'TEAM_MEMBER_SELECTED', 'EVENT_VOTING_OPENED',
  ]) assert.match(notificationSource, new RegExp(type));
  for (const file of ['team-events.ts', 'bowler-hidden.ts', 'team-competition.ts', 'event-competition.ts']) {
    const source = fs.readFileSync(path.resolve(__dirname, `../src/lib/mobile-api/${file}`), 'utf8');
    assert.match(source, /enqueueMobileNotifications\(tx,/);
    assert.doesNotMatch(source, /deliverPendingMobileNotifications|firebase-admin/);
  }
});
