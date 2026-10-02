// Synthetic fixtures only. No Firebase, database, or production calls.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { createRequire } = require('node:module');

class TeamFinanceError extends Error {
  constructor(code, message, status) {
    super(message); this.code = code; this.status = status;
  }
}

function loadService() {
  const filename = path.resolve(__dirname, '../src/lib/mobile-api/team-finance-reminders.ts');
  const module = { exports: {} };
  const nativeRequire = createRequire(filename);
  const localRequire = id => {
    if (id === '@/lib/prisma') return { default: {}, __esModule: true };
    if (id === '@/lib/mobile-api/team-finance') return { TeamFinanceError };
    if (id === '@/lib/mobile-api/notifications') return {
      MOBILE_NOTIFICATION_TYPES: { financeDueReminder: 'FINANCE_DUE_REMINDER' },
      enqueueMobileNotifications: async () => {},
    };
    return nativeRequire(id);
  };
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  new Function('require', 'module', 'exports', compiled)(localRequire, module, module.exports);
  return module.exports;
}

function charge(overrides = {}) {
  return {
    id: 'charge-1', title: '10월 정기전 게임비', dueDate: new Date('2026-10-18T00:00:00.000Z'), status: 'OPEN',
    targets: [], ...overrides,
  };
}

function target(overrides = {}) {
  return { targetType: 'MEMBER', paymentStatus: 'UNPAID', amount: 25000, member: { userId: 'user-1' }, ...overrides };
}

function dependencies({ role = 'OWNER', value = charge() } = {}) {
  const enqueued = [];
  return {
    enqueued,
    value: {
      findManagerRole: async () => role,
      findCharge: async () => value,
      enqueueNotifications: async inputs => enqueued.push(...inputs),
    },
  };
}

test('owner and manager can request an OPEN reminder while a member is forbidden', async () => {
  const service = loadService();
  for (const role of ['OWNER', 'MANAGER']) {
    const deps = dependencies({ role, value: charge({ targets: [target()] }) });
    const result = await service.remindUnpaidTeamChargeMembers('actor', 'team-1', 'charge-1', deps.value);
    assert.equal(result.eligibleMemberCount, 1);
    assert.equal(deps.enqueued.length, 1);
  }
  await assert.rejects(
    service.remindUnpaidTeamChargeMembers('member', 'team-1', 'charge-1', dependencies({ role: 'MEMBER' }).value),
    error => error.code === 'FINANCE_FORBIDDEN' && error.status === 403,
  );
});

test('missing or cross-team charges are hidden and non-OPEN states are rejected', async () => {
  const service = loadService();
  await assert.rejects(
    service.remindUnpaidTeamChargeMembers('owner', 'team-a', 'charge-b', dependencies({ value: null }).value),
    error => error.code === 'CHARGE_NOT_FOUND' && error.status === 404,
  );
  for (const status of ['DRAFT', 'CLOSED', 'CANCELLED']) {
    await assert.rejects(
      service.remindUnpaidTeamChargeMembers('owner', 'team-1', 'charge-1', dependencies({ value: charge({ status }) }).value),
      error => error.code === 'CHARGE_NOT_OPEN' && error.status === 409,
    );
  }
});

test('only current UNPAID members are eligible; paid, waived, guests and deleted members are excluded', async () => {
  const service = loadService();
  const deps = dependencies({ value: charge({ targets: [
    target({ member: { userId: 'eligible' } }),
    target({ paymentStatus: 'PAID', member: { userId: 'paid' } }),
    target({ paymentStatus: 'WAIVED', member: { userId: 'waived' } }),
    target({ targetType: 'GUEST', member: null }),
    target({ member: null }),
  ] }) });
  const result = await service.remindUnpaidTeamChargeMembers('owner', 'team-1', 'charge-1', deps.value);
  assert.deepEqual(result, {
    eligibleMemberCount: 1, unpaidGuestCount: 1, skippedUnavailableMemberCount: 1, processed: true,
  });
  assert.deepEqual(deps.enqueued.map(input => input.userId), ['eligible']);
});

test('uses each target amount and preserves date-only due date without leaking recipient identifiers in payload', () => {
  const service = loadService();
  const plan = service.buildFinanceDueReminderPlan('team-1', charge({ targets: [
    target({ amount: 25000, member: { userId: 'private-user' } }),
    target({ amount: 31000, member: { userId: 'other-user' } }),
  ] }), new Date('2026-10-02T15:01:00.000Z'));
  assert.equal(plan.inputs[0].title, '10월 정기전 게임비');
  assert.equal(plan.inputs[0].body, '25,000원 · 10월 18일까지');
  assert.equal(plan.inputs[1].body, '31,000원 · 10월 18일까지');
  const publicPayload = {
    type: plan.inputs[0].type, teamId: plan.inputs[0].teamId,
    chargeId: plan.inputs[0].chargeId, target: plan.inputs[0].target,
  };
  assert.deepEqual(publicPayload, {
    type: 'FINANCE_DUE_REMINDER', teamId: 'team-1', chargeId: 'charge-1', target: 'FINANCE_CHARGE',
  });
  assert.doesNotMatch(JSON.stringify(publicPayload), /private-user|memberId|userId|targetId|guestId|email/i);
});

test('due date is optional and a missing date uses the safe reminder copy', () => {
  const service = loadService();
  assert.equal(service.financeDueReminderBody(25000, null), '25,000원 납부 확인이 필요합니다.');
});

test('dedupe key permits one notification per charge, user and KST date', () => {
  const service = loadService();
  const value = charge({ targets: [target()] });
  const beforeMidnight = service.buildFinanceDueReminderPlan('team-1', value, new Date('2026-10-02T14:59:59.000Z'));
  const sameDay = service.buildFinanceDueReminderPlan('team-1', value, new Date('2026-10-02T15:00:00.000Z'));
  const laterSameDay = service.buildFinanceDueReminderPlan('team-1', value, new Date('2026-10-03T14:59:59.000Z'));
  const nextDay = service.buildFinanceDueReminderPlan('team-1', value, new Date('2026-10-03T15:00:00.000Z'));
  assert.match(beforeMidnight.inputs[0].dedupeKey, /:2026-10-02$/);
  assert.equal(sameDay.inputs[0].dedupeKey, laterSameDay.inputs[0].dedupeKey);
  assert.notEqual(laterSameDay.inputs[0].dedupeKey, nextDay.inputs[0].dedupeKey);
  assert.match(nextDay.inputs[0].dedupeKey, /:2026-10-04$/);
});

test('reminder route is authenticated, bodyless and delegates server-side recipient selection', () => {
  const source = fs.readFileSync(path.resolve(
    __dirname,
    '../src/app/api/mobile/v1/teams/[teamId]/finance/charges/[chargeId]/reminders/unpaid/route.ts',
  ), 'utf8');
  assert.match(source, /getMobileApiUserId\(request\)/);
  assert.match(source, /remindUnpaidTeamChargeMembers\(userId, teamId, chargeId\)/);
  assert.doesNotMatch(source, /request\.json|recipient|userIds|memberIds/);
});

test('default reminder query scopes a charge by both chargeId and teamId', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/lib/mobile-api/team-finance-reminders.ts'), 'utf8');
  assert.match(source, /where: \{ id: chargeId, teamId \}/);
  assert.match(source, /member: \{ select: \{ userId: true \} \}/);
});
