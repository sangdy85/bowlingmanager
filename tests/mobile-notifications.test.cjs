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

function createDeviceStore() {
  const state = { device: null, notifications: new Map(), deliveries: new Map() };
  const matchesDevice = where => {
    const device = state.device;
    if (!device) return false;
    if (where.id !== undefined && where.id !== device.id) return false;
    if (where.token !== undefined && where.token !== device.token) return false;
    if (where.userId !== undefined && where.userId !== device.userId) return false;
    if (where.enabled !== undefined && where.enabled !== device.enabled) return false;
    if (where.revokedAt?.not === null && device.revokedAt === null) return false;
    return true;
  };
  const mobilePushDevice = {
    findUnique: async ({ where }) => where.token === state.device?.token ? { ...state.device } : null,
    create: async ({ data }) => {
      if (state.device?.token === data.token) throw { code: 'P2002' };
      state.device = {
        id: 'device-1', userId: data.userId, token: data.token, platform: data.platform,
        enabled: true, revokedAt: null, lastSeenAt: data.lastSeenAt,
      };
      return { id: state.device.id, platform: state.device.platform, enabled: true, lastSeenAt: state.device.lastSeenAt };
    },
    updateMany: async ({ where, data }) => {
      if (!matchesDevice(where)) return { count: 0 };
      Object.assign(state.device, data);
      return { count: 1 };
    },
    findMany: async ({ where }) =>
      state.device && state.device.userId === where.userId && state.device.enabled === where.enabled
        ? [{ id: state.device.id }]
        : [],
  };
  const mobileNotification = {
    upsert: async ({ where, create }) => {
      const existing = state.notifications.get(where.dedupeKey);
      if (existing) return existing;
      const row = { id: `notification-${state.notifications.size + 1}`, userId: create.userId };
      state.notifications.set(where.dedupeKey, row);
      return row;
    },
  };
  const mobileNotificationDelivery = {
    upsert: async ({ where, create }) => {
      const key = `${where.notificationId_deviceId.notificationId}:${where.notificationId_deviceId.deviceId}`;
      if (!state.deliveries.has(key)) state.deliveries.set(key, { ...create, status: 'PENDING' });
    },
    updateMany: async ({ where, data }) => {
      let count = 0;
      for (const row of state.deliveries.values()) {
        if (row.deviceId === where.deviceId && where.status.in.includes(row.status)) {
          Object.assign(row, data); count += 1;
        }
      }
      return { count };
    },
  };
  const tx = { mobilePushDevice, mobileNotification, mobileNotificationDelivery };
  return { state, prisma: { ...tx, $transaction: async callback => callback(tx) }, tx };
}

test('new device registration trusts only the authenticated user', async () => {
  const store = createDeviceStore();
  const service = loadService(store.prisma);
  await service.registerMobilePushDevice('user-1', {
    token: 'new-token-123456789012345', platform: 'ANDROID', userId: 'injected-user',
  });
  assert.equal(store.state.device.userId, 'user-1');
  assert.equal(store.state.device.enabled, true);
  assert.equal(store.state.device.revokedAt, null);
});

test('same user registration re-enables its revoked device', async () => {
  const store = createDeviceStore();
  const service = loadService(store.prisma);
  const input = { token: 'same-user-token-1234567890', platform: 'ANDROID' };
  await service.registerMobilePushDevice('user-1', input);
  await service.revokeMobilePushDevice('user-1', input);
  assert.equal(store.state.device.enabled, false);
  assert.ok(store.state.device.revokedAt instanceof Date);
  await service.registerMobilePushDevice('user-1', input);
  assert.equal(store.state.device.userId, 'user-1');
  assert.equal(store.state.device.enabled, true);
  assert.equal(store.state.device.revokedAt, null);
});

test('an active token owned by another user cannot be reassigned', async () => {
  const store = createDeviceStore();
  const service = loadService(store.prisma);
  const input = { token: 'active-token-12345678901234', platform: 'ANDROID' };
  await service.registerMobilePushDevice('user-1', input);
  await assert.rejects(
    () => service.registerMobilePushDevice('user-2', input),
    error => error.code === 'DEVICE_TOKEN_CONFLICT' && error.status === 409,
  );
  assert.equal(store.state.device.userId, 'user-1');
});

test('a revoked token moves between accounts without reusing prior deliveries', async () => {
  const store = createDeviceStore();
  const service = loadService(store.prisma);
  const input = { token: 'switch-token-12345678901234', platform: 'ANDROID' };
  await service.registerMobilePushDevice('user-a', input);
  store.state.notifications.set('old-a', { id: 'notification-a', userId: 'user-a' });
  store.state.deliveries.set('notification-a:device-1', {
    notificationId: 'notification-a', deviceId: 'device-1', status: 'PENDING',
  });
  await service.revokeMobilePushDevice('user-a', input);
  await service.registerMobilePushDevice('user-b', input);
  assert.equal(store.state.device.userId, 'user-b');
  assert.equal(store.state.device.enabled, true);
  assert.equal(store.state.device.revokedAt, null);
  assert.equal(store.state.notifications.get('old-a').userId, 'user-a');
  assert.deepEqual(store.state.deliveries.get('notification-a:device-1'), {
    notificationId: 'notification-a', deviceId: 'device-1', status: 'FAILED',
    lastErrorCode: 'device/reassigned', nextAttemptAt: new Date('9999-12-31T00:00:00.000Z'),
  });

  await service.enqueueMobileNotifications(store.tx, [{
    userId: 'user-b', dedupeKey: 'new-b', type: 'LANE_ASSIGNED', title: 'title', body: 'body',
    teamId: 'team-1', eventId: 'event-1', target: 'LANE_DRAW',
  }]);
  assert.equal(store.state.notifications.get('new-b').userId, 'user-b');
  assert.equal(store.state.deliveries.get('notification-2:device-1').status, 'PENDING');

  await service.revokeMobilePushDevice('user-b', input);
  await service.registerMobilePushDevice('user-a', input);
  assert.equal(store.state.device.userId, 'user-a');
  assert.equal(store.state.device.enabled, true);
  assert.equal(store.state.device.revokedAt, null);
});

test('concurrent reassignment of one revoked token has only one winner', async () => {
  const store = createDeviceStore();
  const service = loadService(store.prisma);
  const input = { token: 'race-token-1234567890123456', platform: 'ANDROID' };
  await service.registerMobilePushDevice('user-a', input);
  await service.revokeMobilePushDevice('user-a', input);
  const results = await Promise.allSettled([
    service.registerMobilePushDevice('user-b', input),
    service.registerMobilePushDevice('user-c', input),
  ]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  const rejected = results.find(result => result.status === 'rejected');
  assert.equal(rejected.reason.code, 'DEVICE_TOKEN_CONFLICT');
  assert.ok(['user-b', 'user-c'].includes(store.state.device.userId));
  assert.equal(store.state.device.enabled, true);
  assert.equal(store.state.device.revokedAt, null);
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
