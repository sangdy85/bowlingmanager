// Synthetic fixtures only. No production database or payment processor calls.
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

const service = loadTs('src/lib/mobile-api/team-finance.ts', { '@/lib/prisma': {} });
const now = new Date('2026-10-02T05:00:00.000Z');

function audit(id, changes = {}) {
  return {
    id, action: 'MARK_PAID', previousStatus: 'UNPAID', nextStatus: 'PAID',
    actorDisplayNameSnapshot: '운영자', createdAt: now, ...changes,
  };
}

function target(id, changes = {}) {
  return {
    id, targetType: 'MEMBER', memberId: `member-${id}`, guestId: null,
    displayNameSnapshot: `회원 ${id}`, amount: 30000, paymentStatus: 'UNPAID', paidAt: null,
    createdAt: now, updatedAt: now, audits: [], ...changes,
  };
}

function charge(changes = {}) {
  return {
    id: 'charge-1', teamId: 'team-1', eventId: null, type: 'MONTHLY_DUES',
    title: '2026년 10월 회비', defaultAmount: 30000, dueDate: new Date('2026-10-10T00:00:00.000Z'),
    status: 'DRAFT', memo: null, createdAt: now, updatedAt: now,
    targets: [
      target('owner', { memberId: 'membership-owner', displayNameSnapshot: '팀장' }),
      target('member', { memberId: 'membership-member', displayNameSnapshot: '일반 회원' }),
    ],
    ...changes,
  };
}

function fixture(initialCharges = [charge()]) {
  const state = { charges: structuredClone(initialCharges), createInputs: [], updateInputs: [], paymentInputs: [] };
  const roles = { owner: 'OWNER', manager: 'MANAGER', member: 'MEMBER' };
  const memberIds = { owner: 'membership-owner', manager: 'membership-manager', member: 'membership-member' };
  const dependencies = {
    findAccess: async (actor, teamId) => teamId === 'team-1' && roles[actor]
      ? { role: roles[actor], memberId: memberIds[actor] }
      : null,
    listCharges: async teamId => state.charges.filter(item => item.teamId === teamId),
    findCharge: async (teamId, chargeId) => state.charges.find(item => item.teamId === teamId && item.id === chargeId) ?? null,
    createCharge: async input => {
      state.createInputs.push(input);
      const created = charge({
        id: `charge-${state.charges.length + 1}`,
        teamId: input.teamId,
        eventId: input.eventId,
        type: input.type,
        title: input.title,
        defaultAmount: input.amount,
        dueDate: input.dueDate,
        memo: input.memo,
        status: 'DRAFT',
        targets: input.type === 'EVENT_FEE'
          ? [
              target('event-member', { memberId: 'membership-member', amount: input.amount }),
              target('guest', { targetType: 'GUEST', memberId: null, guestId: 'guest-1', amount: input.amount }),
            ]
          : input.targetMemberIds.map(memberId => target(memberId, { memberId, amount: input.amount })),
      });
      state.charges.push(created);
      return created;
    },
    updateCharge: async input => {
      state.updateInputs.push(input);
      const current = state.charges.find(item => item.teamId === input.teamId && item.id === input.chargeId);
      if (!current) throw new service.TeamFinanceError('CHARGE_NOT_FOUND', 'not found', 404);
      if (input.title !== undefined) current.title = input.title;
      if (input.amount !== undefined) {
        current.defaultAmount = input.amount;
        current.targets.forEach(item => { item.amount = input.amount; });
      }
      if (input.dueDate !== undefined) current.dueDate = input.dueDate;
      if (input.memo !== undefined) current.memo = input.memo;
      if (input.status !== undefined) current.status = input.status;
      return current;
    },
    updatePayment: async input => {
      state.paymentInputs.push(input);
      const current = state.charges.find(item => item.teamId === input.teamId && item.id === input.chargeId);
      const item = current?.targets.find(row => row.id === input.targetId);
      if (!current || !item) throw new service.TeamFinanceError('TARGET_NOT_FOUND', 'not found', 404);
      const next = service.nextPaymentStatus(item.paymentStatus, input.action);
      if (next !== item.paymentStatus) {
        const previous = item.paymentStatus;
        item.paymentStatus = next;
        item.paidAt = next === 'PAID' ? input.now : null;
        item.updatedAt = input.now;
        item.audits.push(audit(`audit-${item.audits.length + 1}`, {
          action: input.action, previousStatus: previous, nextStatus: next,
          actorDisplayNameSnapshot: input.actorUserId,
        }));
      }
      return current;
    },
  };
  return { state, dependencies };
}

test('monthly dues parser accepts KRW integers and trims safe fields', () => {
  const parsed = service.parseCreateTeamChargeInput({
    type: 'MONTHLY_DUES', title: '  2026년 10월 회비  ', amount: 30000,
    dueDate: '2026-10-10', memo: '  운영비  ', targetMemberIds: ['member-1', 'member-2'],
  });
  assert.equal(parsed.title, '2026년 10월 회비');
  assert.equal(parsed.amount, 30000);
  assert.equal(parsed.dueDate.toISOString(), '2026-10-10T00:00:00.000Z');
  assert.equal(parsed.memo, '운영비');
});

test('amount rejects zero, negatives, decimals and values over the constant maximum', () => {
  for (const amount of [0, -1, 1.5, 10000001, '30000']) {
    assert.throws(() => service.parseCreateTeamChargeInput({
      type: 'MONTHLY_DUES', title: '회비', amount, targetMemberIds: ['member-1'],
    }), error => error.code === 'INVALID_AMOUNT');
  }
  assert.equal(service.MAX_CHARGE_AMOUNT, 10000000);
});

test('title, memo and date-only validation reject malformed values', () => {
  const base = { type: 'MONTHLY_DUES', title: '회비', amount: 1, targetMemberIds: ['member-1'] };
  for (const title of ['', ' '.repeat(3), '가'.repeat(81)]) {
    assert.throws(() => service.parseCreateTeamChargeInput({ ...base, title }), error => error.code === 'INVALID_TITLE');
  }
  assert.throws(() => service.parseCreateTeamChargeInput({ ...base, memo: '가'.repeat(501) }), error => error.code === 'INVALID_MEMO');
  for (const dueDate of ['2026-02-30', '2026/10/02', '02-10-2026']) {
    assert.throws(() => service.parseCreateTeamChargeInput({ ...base, dueDate }), error => error.code === 'INVALID_DUE_DATE');
  }
});

test('duplicate monthly targets are rejected before persistence', () => {
  assert.throws(() => service.parseCreateTeamChargeInput({
    type: 'MONTHLY_DUES', title: '회비', amount: 30000,
    targetMemberIds: ['member-1', 'member-1'],
  }), error => error.code === 'DUPLICATE_TARGET');
});

test('event fee requires an event and forbids client-selected targets', () => {
  assert.throws(() => service.parseCreateTeamChargeInput({
    type: 'EVENT_FEE', title: '게임비', amount: 25000,
  }), error => error.code === 'EVENT_NOT_FOUND');
  assert.throws(() => service.parseCreateTeamChargeInput({
    type: 'EVENT_FEE', title: '게임비', amount: 25000, eventId: 'event-1', targetMemberIds: ['member-1'],
  }), error => error.code === 'INVALID_TARGET');
});

test('monthly target snapshot preserves aliases and rejects a wrong-team member id', () => {
  const snapshots = service.buildMemberChargeTargets(
    ['member-1'],
    [{ id: 'member-1', alias: '당시 별명', user: { name: '현재 이름' } }],
    30000,
  );
  assert.deepEqual(snapshots[0], {
    targetType: 'MEMBER', memberId: 'member-1', guestId: null,
    displayNameSnapshot: '당시 별명', amount: 30000,
  });
  assert.throws(
    () => service.buildMemberChargeTargets(['member-1', 'other-team-member'], [{ id: 'member-1', alias: null, user: { name: '회원' } }], 30000),
    error => error.code === 'INVALID_TARGET',
  );
});

test('event fee snapshots attending members and current guests but excludes non-attending members', () => {
  const snapshots = service.buildEventFeeTargets('team-1', [
    { status: 'ATTENDING', memberId: 'member-1', memberDisplayName: '참석 당시', member: { teamId: 'team-1', alias: '참석 별명', user: { name: '참석자' } } },
    { status: 'NOT_ATTENDING', memberId: 'member-2', memberDisplayName: '불참자', member: { teamId: 'team-1', alias: null, user: { name: '불참자' } } },
    { status: 'ATTENDING', memberId: 'foreign', memberDisplayName: '타팀', member: { teamId: 'team-2', alias: null, user: { name: '타팀' } } },
  ], [{ id: 'guest-1', name: '초대 손님' }], 25000);
  assert.deepEqual(snapshots.map(item => [item.targetType, item.memberId ?? item.guestId, item.displayNameSnapshot]), [
    ['MEMBER', 'member-1', '참석 별명'],
    ['GUEST', 'guest-1', '초대 손님'],
  ]);
});

test('owner and manager can create DRAFT charges while a normal member cannot', async () => {
  for (const actor of ['owner', 'manager']) {
    const { state, dependencies } = fixture([]);
    const result = await service.createTeamCharge(actor, 'team-1', {
      type: 'MONTHLY_DUES', title: '회비', amount: 30000, targetMemberIds: ['membership-member'],
    }, dependencies);
    assert.equal(result.charge.status, 'DRAFT');
    assert.equal(state.createInputs[0].actorUserId, actor);
  }
  await assert.rejects(
    () => service.createTeamCharge('member', 'team-1', {
      type: 'MONTHLY_DUES', title: '회비', amount: 30000, targetMemberIds: ['membership-member'],
    }, fixture([]).dependencies),
    error => error.code === 'FINANCE_FORBIDDEN' && error.status === 403,
  );
});

test('member list exposes only myPayment and never another payer name or target list', async () => {
  const { dependencies } = fixture([charge({ status: 'OPEN' })]);
  const result = await service.listTeamCharges('member', 'team-1', dependencies);
  const json = JSON.stringify(result);
  assert.equal(result.role, 'MEMBER');
  assert.deepEqual(result.charges[0].myPayment, { amount: 30000, status: 'UNPAID', paidAt: null });
  assert.equal(Object.hasOwn(result.charges[0], 'targets'), false);
  assert.equal(json.includes('팀장'), false);
  assert.equal(json.includes('membership-owner'), false);
});

test('member cannot see DRAFT or CANCELLED charges before or after publication', async () => {
  const rows = [
    charge({ id: 'draft', status: 'DRAFT' }),
    charge({ id: 'open', status: 'OPEN' }),
    charge({ id: 'closed', status: 'CLOSED' }),
    charge({ id: 'cancelled', status: 'CANCELLED' }),
  ];
  const { dependencies } = fixture(rows);
  const result = await service.listTeamCharges('member', 'team-1', dependencies);
  assert.deepEqual(result.charges.map(item => item.charge.id), ['open', 'closed']);
  await assert.rejects(
    () => service.getTeamCharge('member', 'team-1', 'draft', dependencies),
    error => error.code === 'CHARGE_NOT_FOUND',
  );
});

test('manager list exposes all targets and integer aggregates with waived excluded from expected', async () => {
  const rows = [charge({ status: 'OPEN', targets: [
    target('paid', { paymentStatus: 'PAID', paidAt: now, amount: 30000 }),
    target('unpaid', { paymentStatus: 'UNPAID', amount: 20000 }),
    target('waived', { paymentStatus: 'WAIVED', amount: 10000 }),
  ] })];
  const result = await service.listTeamCharges('manager', 'team-1', fixture(rows).dependencies);
  assert.equal(result.charges[0].targets.length, 3);
  assert.deepEqual(result.charges[0].summary, {
    targetCount: 3, paidCount: 1, unpaidCount: 1, waivedCount: 1,
    expectedAmount: 50000, paidAmount: 30000, unpaidAmount: 20000, waivedAmount: 10000,
  });
});

test('finance summary is manager-only and excludes cancelled charge amounts', async () => {
  const rows = [
    charge({ id: 'open', status: 'OPEN', targets: [target('one', { amount: 20000 })] }),
    charge({ id: 'cancelled', status: 'CANCELLED', targets: [target('two', { amount: 90000 })] }),
  ];
  const result = await service.getTeamFinanceSummary('owner', 'team-1', fixture(rows).dependencies);
  assert.equal(result.charges.total, 2);
  assert.equal(result.charges.cancelled, 1);
  assert.equal(result.totals.expectedAmount, 20000);
  await assert.rejects(
    () => service.getTeamFinanceSummary('member', 'team-1', fixture(rows).dependencies),
    error => error.code === 'FINANCE_FORBIDDEN',
  );
});

test('cross-team finance and charge access are rejected without leaking existence', async () => {
  const { dependencies } = fixture();
  await assert.rejects(() => service.listTeamCharges('member', 'team-2', dependencies), error => error.code === 'TEAM_NOT_FOUND');
  await assert.rejects(() => service.getTeamCharge('member', 'team-1', 'other-team-charge', dependencies), error => error.code === 'CHARGE_NOT_FOUND');
});

test('cross-team or cross-charge target mutation is rejected', async () => {
  const { dependencies } = fixture([charge({ status: 'OPEN' })]);
  await assert.rejects(
    () => service.updateTeamChargePayment('manager', 'team-1', 'charge-1', 'other-target', { action: 'MARK_PAID' }, dependencies, now),
    error => error.code === 'TARGET_NOT_FOUND',
  );
});

test('payment actions generate server timestamps and actor audit snapshots', async () => {
  const { state, dependencies } = fixture([charge({ status: 'OPEN' })]);
  let result = await service.updateTeamChargePayment(
    'manager', 'team-1', 'charge-1', 'owner', { action: 'MARK_PAID' }, dependencies, now,
  );
  assert.equal(result.targets[0].status, 'PAID');
  assert.equal(result.targets[0].paidAt, now.toISOString());
  assert.equal(result.targets[0].audits[0].actorDisplayName, 'manager');
  assert.equal(state.paymentInputs[0].now, now);

  result = await service.updateTeamChargePayment(
    'manager', 'team-1', 'charge-1', 'owner', { action: 'MARK_UNPAID' }, dependencies, now,
  );
  assert.equal(result.targets[0].status, 'UNPAID');
  assert.equal(result.targets[0].paidAt, null);
  result = await service.updateTeamChargePayment(
    'owner', 'team-1', 'charge-1', 'owner', { action: 'WAIVE' }, dependencies, now,
  );
  assert.equal(result.targets[0].status, 'WAIVED');
  result = await service.updateTeamChargePayment(
    'owner', 'team-1', 'charge-1', 'owner', { action: 'UNWAIVE' }, dependencies, now,
  );
  assert.equal(result.targets[0].status, 'UNPAID');
});

test('repeated payment action is idempotent and does not duplicate audit', async () => {
  const { state, dependencies } = fixture([charge({ status: 'OPEN' })]);
  await service.updateTeamChargePayment('manager', 'team-1', 'charge-1', 'owner', { action: 'MARK_PAID' }, dependencies, now);
  await service.updateTeamChargePayment('manager', 'team-1', 'charge-1', 'owner', { action: 'MARK_PAID' }, dependencies, now);
  assert.equal(state.charges[0].targets[0].audits.length, 1);
});

test('unsafe payment transitions require an explicit undo action', () => {
  assert.throws(() => service.nextPaymentStatus('PAID', 'WAIVE'), error => error.code === 'INVALID_PAYMENT_TRANSITION');
  assert.throws(() => service.nextPaymentStatus('WAIVED', 'MARK_PAID'), error => error.code === 'INVALID_PAYMENT_TRANSITION');
  assert.equal(service.nextPaymentStatus('PAID', 'MARK_UNPAID'), 'UNPAID');
  assert.equal(service.nextPaymentStatus('WAIVED', 'UNWAIVE'), 'UNPAID');
});

test('client cannot send paidAt or actor identifiers', () => {
  assert.throws(() => service.parsePaymentAction({ action: 'MARK_PAID', paidAt: now.toISOString() }), error => error.code === 'INVALID_FIELD');
  assert.throws(() => service.parsePaymentAction({ action: 'MARK_PAID', actorUserId: 'attacker' }), error => error.code === 'INVALID_FIELD');
});

test('payment mutation is blocked unless the charge is OPEN', async () => {
  for (const status of ['DRAFT', 'CLOSED', 'CANCELLED']) {
    await assert.rejects(
      () => service.updateTeamChargePayment('manager', 'team-1', 'charge-1', 'owner', { action: 'MARK_PAID' }, fixture([charge({ status })]).dependencies, now),
      error => error.code === 'CHARGE_NOT_OPEN',
    );
  }
});

test('paid or waived targets lock amount and target changes', async () => {
  for (const paymentStatus of ['PAID', 'WAIVED']) {
    const locked = charge({ status: 'DRAFT', targets: [target('owner', { paymentStatus })] });
    await assert.rejects(
      () => service.updateTeamCharge('manager', 'team-1', 'charge-1', { amount: 40000 }, fixture([locked]).dependencies),
      error => error.code === 'CHARGE_LOCKED',
    );
    await assert.rejects(
      () => service.updateTeamCharge('manager', 'team-1', 'charge-1', { targetMemberIds: ['membership-member'] }, fixture([locked]).dependencies),
      error => error.code === 'CHARGE_LOCKED',
    );
  }
});

test('DRAFT and OPEN status transitions follow the non-delete lifecycle', () => {
  assert.doesNotThrow(() => service.assertChargeStatusTransition('DRAFT', 'OPEN'));
  assert.doesNotThrow(() => service.assertChargeStatusTransition('DRAFT', 'CANCELLED'));
  assert.doesNotThrow(() => service.assertChargeStatusTransition('OPEN', 'CLOSED'));
  assert.doesNotThrow(() => service.assertChargeStatusTransition('OPEN', 'CANCELLED'));
  assert.throws(() => service.assertChargeStatusTransition('CLOSED', 'OPEN'), error => error.code === 'INVALID_CHARGE_TRANSITION');
  assert.throws(() => service.assertChargeStatusTransition('CANCELLED', 'DRAFT'), error => error.code === 'INVALID_CHARGE_TRANSITION');
});

test('OPEN permits safe metadata edits but not amount or targets', async () => {
  const open = charge({ status: 'OPEN' });
  const harness = fixture([open]);
  const result = await service.updateTeamCharge('manager', 'team-1', 'charge-1', {
    title: '수정 제목', dueDate: '2026-10-20', memo: '안내',
  }, harness.dependencies);
  assert.equal(result.charge.title, '수정 제목');
  await assert.rejects(
    () => service.updateTeamCharge('manager', 'team-1', 'charge-1', { amount: 50000 }, harness.dependencies),
    error => error.code === 'CHARGE_LOCKED',
  );
});

test('CLOSED and CANCELLED charges reject content mutation', async () => {
  for (const status of ['CLOSED', 'CANCELLED']) {
    await assert.rejects(
      () => service.updateTeamCharge('manager', 'team-1', 'charge-1', { title: '변경' }, fixture([charge({ status })]).dependencies),
      error => error.code === 'CHARGE_CLOSED',
    );
  }
});

test('service persists charge+targets and payment+audit inside serializable transactions', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/lib/mobile-api/team-finance.ts'), 'utf8');
  assert.match(source, /createCharge\(input\)[\s\S]+prisma\.\$transaction/);
  assert.match(source, /updatePayment\(input\)[\s\S]+prisma\.\$transaction/);
  assert.match(source, /teamChargeTarget\.update[\s\S]+teamChargeTargetAudit\.create/);
  assert.match(source, /isolationLevel: "Serializable"/);
});

test('payment transaction rolls back the status when audit creation fails', async () => {
  const row = charge({ status: 'OPEN', targets: [target('owner', { memberId: 'membership-owner' })] });
  const prisma = {
    team: {
      findFirst: async () => ({ ownerId: 'owner', User: [], members: [{ id: 'membership-owner' }] }),
    },
    teamCharge: {
      findFirst: async ({ where }) => where.id === row.id && where.teamId === row.teamId ? row : null,
      findUnique: async () => row,
    },
    teamChargeTarget: {
      findFirst: async ({ where }) => where.id === row.targets[0].id
        ? { ...row.targets[0], charge: { id: row.id, status: row.status } }
        : null,
      update: async ({ data }) => {
        Object.assign(row.targets[0], {
          paymentStatus: data.paymentStatus,
          paidAt: data.paidAt,
        });
        return row.targets[0];
      },
    },
    teamChargeTargetAudit: {
      create: async () => { throw new Error('synthetic audit failure'); },
    },
    user: { findUnique: async () => ({ name: '팀장' }) },
  };
  prisma.$transaction = async callback => {
    const snapshot = structuredClone(row.targets[0]);
    try {
      return await callback(prisma);
    } catch (error) {
      Object.assign(row.targets[0], snapshot);
      throw error;
    }
  };
  const transactionalService = loadTs('src/lib/mobile-api/team-finance.ts', { '@/lib/prisma': prisma });
  await assert.rejects(
    () => transactionalService.updateTeamChargePayment(
      'owner', 'team-1', 'charge-1', 'owner', { action: 'MARK_PAID' }, undefined, now,
    ),
    /synthetic audit failure/,
  );
  assert.equal(row.targets[0].paymentStatus, 'UNPAID');
  assert.equal(row.targets[0].paidAt, null);
  assert.equal(row.targets[0].audits.length, 0);
});

test('finance migration preserves snapshots and enforces money and identity constraints', () => {
  const sql = fs.readFileSync(path.resolve(__dirname, '../prisma/migrations/20261002120000_add_team_finance/migration.sql'), 'utf8');
  assert.match(sql, /TeamCharge_amount_check/);
  assert.match(sql, /BETWEEN 1 AND 10000000/);
  assert.match(sql, /TeamChargeTarget_identity_check/);
  assert.match(sql, /TeamCharge_eventId_fkey[\s\S]+ON DELETE SET NULL/);
  assert.match(sql, /TeamChargeTarget_guestId_fkey[\s\S]+ON DELETE SET NULL/);
  assert.match(sql, /TeamChargeTargetAudit_actorUserId_fkey[\s\S]+ON DELETE SET NULL/);
  assert.match(sql, /TeamCharge_createdByUserId_fkey[\s\S]+ON DELETE SET NULL/);
  assert.match(sql, /createdByDisplayNameSnapshot/);
  assert.match(sql, /actorDisplayNameSnapshot/);
});

test('finance routes require mobile authentication and use the shared response envelope', () => {
  const routes = [
    '../src/app/api/mobile/v1/teams/[teamId]/finance/summary/route.ts',
    '../src/app/api/mobile/v1/teams/[teamId]/finance/charges/route.ts',
    '../src/app/api/mobile/v1/teams/[teamId]/finance/charges/[chargeId]/route.ts',
    '../src/app/api/mobile/v1/teams/[teamId]/finance/charges/[chargeId]/targets/[targetId]/route.ts',
  ];
  for (const relative of routes) {
    const source = fs.readFileSync(path.resolve(__dirname, relative), 'utf8');
    assert.match(source, /getMobileApiUserId/);
    assert.match(source, /unauthorizedResponse/);
    assert.match(source, /mobileApiSuccess/);
  }
});
