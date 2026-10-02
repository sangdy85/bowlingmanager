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
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  new Function('require', 'module', 'exports', compiled)(localRequire, module, module.exports);
  return module.exports;
}

const service = loadTs('src/lib/mobile-api/team-events.ts', { '@/lib/prisma': {} });

test('event parser accepts the documented schedule and draw settings', () => {
  assert.deepEqual(service.parseTeamEventInput({
    title: '9월 정기전', date: '2026-09-22', time: '19:30', location: '테스트 볼링장',
    gameType: '정기전', attendanceEnabled: true, laneDrawEnabled: true, laneDrawMode: 'INDIVIDUAL',
  }), {
    title: '9월 정기전', date: '2026-09-22', time: '19:30', location: '테스트 볼링장',
    gameType: '정기전', attendanceEnabled: true, laneDrawEnabled: true, laneDrawMode: 'INDIVIDUAL',
    competitionEnabled: false, competitionType: null, competitionMode: null, competitionGameCount: null,
    rankPoints: [], teamGamePointTables: [],
  });
  for (const date of ['2026-02-30', '2026/09/22']) {
    assert.throws(() => service.parseTeamEventInput({
      title: '일정', date, time: '19:00', location: '볼링장', gameType: null,
      attendanceEnabled: true, laneDrawEnabled: false, laneDrawMode: 'BULK',
    }), error => error.code === 'INVALID_DATE');
  }
});

test('competition mode is independent, required for Bowler Hidden and absent for normal events', () => {
  const base = {
    title: '미니 팀전', date: '2026-09-22', time: '19:30', location: '테스트 볼링장',
    gameType: '정기전', attendanceEnabled: true, laneDrawEnabled: true, laneDrawMode: 'BULK',
    competitionEnabled: true, competitionType: 'TEAM', competitionGameCount: 4,
    rankPoints: [{ rank: 1, points: 20 }],
  };
  assert.equal(service.parseTeamEventInput({ ...base, competitionMode: 'MINI' }, true).competitionMode, 'MINI');
  assert.equal(service.parseTeamEventInput({ ...base, competitionMode: 'OFFICIAL' }, true).competitionMode, 'OFFICIAL');
  assert.throws(() => service.parseTeamEventInput(base, true), error => error.code === 'INVALID_COMPETITION_MODE');
});

test('competition mode migration keeps unknown legacy events null and only backfills published evidence', () => {
  const sql = fs.readFileSync(path.resolve(__dirname, '../prisma/migrations/20260923130000_add_competition_mode/migration.sql'), 'utf8');
  assert.match(sql, /ADD COLUMN "competitionMode" TEXT/);
  assert.match(sql, /EXISTS[\s\S]+SeasonPointPublication/);
  assert.doesNotMatch(sql, /UPDATE "TeamEvent"[\s\S]+WHERE "competitionEnabled" = 1\s*;/);
});

test('event response exposes independent activity, competition type and competition mode fields', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/lib/mobile-api/team-events.ts'), 'utf8');
  assert.match(source, /gameType: event\.gameType/);
  assert.match(source, /competitionType: competitionVisible \? event\.competitionType : "NONE"/);
  assert.match(source, /competitionMode: competitionVisible \? event\.competitionMode : null/);
});

test('competition mode changes only before attendance, score or competition progress', () => {
  assert.doesNotThrow(() => service.assertCompetitionModeChangeAllowed({
    currentMode: 'OFFICIAL', nextMode: 'MINI', competitionStatus: 'ATTENDANCE_OPEN',
    attendanceStatuses: ['UNANSWERED'], hasScores: false,
  }));
  for (const input of [
    { competitionStatus: 'ATTENDANCE_OPEN', attendanceStatuses: ['ATTENDING'], hasScores: false },
    { competitionStatus: 'ATTENDANCE_OPEN', attendanceStatuses: ['UNANSWERED'], hasScores: true },
    { competitionStatus: 'DRAFT_IN_PROGRESS', attendanceStatuses: ['UNANSWERED'], hasScores: false },
    { competitionStatus: 'PUBLISHED', attendanceStatuses: [], hasScores: false },
  ]) {
    assert.throws(() => service.assertCompetitionModeChangeAllowed({
      currentMode: 'MINI', nextMode: 'OFFICIAL', ...input,
    }), error => error.code === 'COMPETITION_MODE_LOCKED');
  }
});

test('attendance parser only permits an explicit attending decision', () => {
  assert.equal(service.parseAttendanceStatus({ status: 'ATTENDING' }), 'ATTENDING');
  assert.equal(service.parseAttendanceStatus({ status: 'NOT_ATTENDING' }), 'NOT_ATTENDING');
  for (const status of ['UNANSWERED', 'MAYBE', null]) {
    assert.throws(() => service.parseAttendanceStatus({ status }), error => error.code === 'INVALID_ATTENDANCE');
  }
});

test('managed attendance parser also permits clearing a response', () => {
  for (const status of ['ATTENDING', 'NOT_ATTENDING', 'UNANSWERED']) {
    assert.equal(service.parseManagedAttendanceStatus({ status }), status);
  }
  assert.throws(() => service.parseManagedAttendanceStatus({ status: 'MAYBE' }), error => error.code === 'INVALID_ATTENDANCE');
});

test('event list scope accepts upcoming and past while preserving legacy all', () => {
  assert.equal(service.parseTeamEventListScope(null), 'ALL');
  assert.equal(service.parseTeamEventListScope('UPCOMING'), 'UPCOMING');
  assert.equal(service.parseTeamEventListScope('PAST'), 'PAST');
  assert.throws(() => service.parseTeamEventListScope('future'), error => error.code === 'INVALID_SCOPE');
  const now = new Date('2026-09-21T16:30:00.000Z'); // 2026-09-22 01:30 KST
  const upcoming = service.teamEventListQuery('UPCOMING', now);
  const past = service.teamEventListQuery('PAST', now);
  assert.equal(upcoming.date.gte.toISOString(), '2026-09-21T15:00:00.000Z');
  assert.equal(past.date.lt.toISOString(), '2026-09-21T15:00:00.000Z');
  assert.equal(upcoming.orderBy[0].eventDate, 'asc');
  assert.equal(past.orderBy[0].eventDate, 'desc');
});

test('lane slots enforce range and event-local uniqueness', () => {
  assert.deepEqual(service.parseLaneSlots({ slots: [
    { laneNumber: 1, position: 1 }, { laneNumber: 24, position: 6 },
  ] }), [{ laneNumber: 1, position: 1 }, { laneNumber: 24, position: 6 }]);
  assert.throws(() => service.parseLaneSlots({ slots: [{ laneNumber: 25, position: 1 }] }), error => error.code === 'INVALID_LANE_CONFIG');
  assert.throws(() => service.parseLaneSlots({ slots: [
    { laneNumber: 2, position: 3 }, { laneNumber: 2, position: 3 },
  ] }), error => error.code === 'DUPLICATE_LANE_SLOT');
});

test('Fisher-Yates uses injectable cryptographic index source', () => {
  const calls = [];
  const shuffled = service.fisherYatesShuffle(['a', 'b', 'c', 'd'], upper => {
    calls.push(upper);
    return 0;
  });
  assert.deepEqual(calls, [4, 3, 2]);
  assert.deepEqual(shuffled, ['b', 'c', 'd', 'a']);
});

test('migration has participant and slot uniqueness plus participant-kind check', () => {
  const sql = fs.readFileSync(path.resolve(__dirname, '../prisma/migrations/20260922000000_add_team_events/migration.sql'), 'utf8');
  assert.match(sql, /TeamEventLaneAssignment_slotId_key/);
  assert.match(sql, /TeamEventLaneAssignment_eventId_memberId_key/);
  assert.match(sql, /TeamEventLaneAssignment_guestId_key/);
  assert.match(sql, /TeamEventLaneAssignment_participant_check/);
  assert.match(sql, /ON DELETE SET NULL/);
});

test('BULK and INDIVIDUAL lane flows assign every attending member and guest exactly once', async () => {
  function harness(mode) {
    const members = [1, 2, 3, 4].map(number => ({
      id: `member-${number}`, userId: `user-${number}`, alias: null, user: { name: `회원${number}` },
    }));
    const event = {
      id: `event-${mode}`, teamId: 'team-1', eventDate: new Date('2026-09-21T15:00:00.000Z'),
      eventTime: '19:00', title: '레인 테스트', location: '테스트 볼링장', gameType: '정기전',
      attendanceEnabled: true, laneDrawEnabled: true, laneDrawMode: mode, laneDrawStatus: 'NOT_STARTED',
      competitionEnabled: false, competitionType: null, competitionStatus: 'DRAFT',
      attendances: [
        ...members.slice(0, 3).map(item => ({ memberId: item.id, memberDisplayName: item.user.name, status: 'ATTENDING' })),
        { memberId: members[3].id, memberDisplayName: members[3].user.name, status: 'NOT_ATTENDING' },
      ],
      guests: [{ id: 'guest-1', name: '게스트' }],
      laneSlots: Array.from({ length: 4 }, (_, index) => ({ id: `slot-${index + 1}`, laneNumber: 9 + index, position: 1 })),
      laneAssignments: [], team: { members }, createdAt: new Date(), updatedAt: new Date(),
    };
    let nextAssignment = 1;
    const prisma = {
      team: { findFirst: async args => {
        const member = members.find(item => item.userId === args.where.members.some.userId);
        return member ? { ownerId: 'user-1', bowlerHiddenEnabled: false, User: [], members: [member] } : null;
      } },
      teamEvent: {
        findFirst: async args => args.where.id === event.id && args.where.teamId === event.teamId
          ? { ...event, laneAssignments: [...event.laneAssignments] }
          : null,
        updateMany: async args => {
          if (event.laneDrawStatus !== args.where.laneDrawStatus) return { count: 0 };
          event.laneDrawStatus = args.data.laneDrawStatus;
          return { count: 1 };
        },
        update: async args => { event.laneDrawStatus = args.data.laneDrawStatus; return event; },
      },
      teamEventLaneAssignment: {
        create: async args => {
          assert.equal(event.laneAssignments.some(item => item.slotId === args.data.slotId), false, 'slot reuse');
          assert.equal(event.laneAssignments.some(item => item.memberId && item.memberId === args.data.memberId), false, 'member duplicate');
          assert.equal(event.laneAssignments.some(item => item.guestId && item.guestId === args.data.guestId), false, 'guest duplicate');
          const assignment = {
            id: `assignment-${nextAssignment++}`, ...args.data,
            slot: event.laneSlots.find(slot => slot.id === args.data.slotId),
          };
          event.laneAssignments.push(assignment);
          return assignment;
        },
      },
    };
    const notifications = [];
    prisma.mobileNotification = { upsert: async ({ where, create }) => {
      const existing = notifications.find(item => item.dedupeKey === where.dedupeKey);
      if (existing) return existing;
      const row = { id: `notification-${notifications.length + 1}`, ...create };
      notifications.push(row); return row;
    } };
    prisma.mobilePushDevice = { findMany: async () => [] };
    prisma.mobileNotificationDelivery = { upsert: async () => ({}) };
    prisma.$transaction = async callback => callback(prisma);
    return { event, prisma, notifications };
  }

  const bulk = harness('BULK');
  let service = loadTs('src/lib/mobile-api/team-events.ts', { '@/lib/prisma': bulk.prisma });
  assert.equal((await service.startEventDraw('user-1', 'team-1', bulk.event.id, new Date('2026-09-22T03:00:00.000Z'))).status, 'COMPLETED');
  assert.equal(bulk.event.laneAssignments.length, 4);
  assert.equal(new Set(bulk.event.laneAssignments.map(item => item.slotId)).size, 4);
  assert.deepEqual(new Set(bulk.event.laneAssignments.map(item => item.memberId ?? item.guestId)), new Set(['member-1', 'member-2', 'member-3', 'guest-1']));
  assert.deepEqual(bulk.notifications.map(item => item.type), ['LANE_ASSIGNED', 'LANE_ASSIGNED', 'LANE_ASSIGNED']);
  assert.equal(new Set(bulk.notifications.map(item => item.userId)).size, 3);

  const individual = harness('INDIVIDUAL');
  service = loadTs('src/lib/mobile-api/team-events.ts', { '@/lib/prisma': individual.prisma });
  assert.equal((await service.startEventDraw('user-1', 'team-1', individual.event.id, new Date('2026-09-22T03:00:00.000Z'))).status, 'OPEN');
  assert.deepEqual(individual.notifications.map(item => item.type), ['LANE_DRAW_OPENED', 'LANE_DRAW_OPENED', 'LANE_DRAW_OPENED']);
  const first = await service.drawMyEventLane('user-1', 'team-1', individual.event.id);
  const repeated = await service.drawMyEventLane('user-1', 'team-1', individual.event.id);
  assert.equal(repeated.id, first.id);
  assert.equal(individual.event.laneAssignments.length, 1);
  await service.drawMyEventLane('user-2', 'team-1', individual.event.id);
  await service.drawGuestEventLane('user-1', 'team-1', individual.event.id, 'guest-1');
  assert.equal(individual.event.laneAssignments.length, 3);
  assert.equal((await service.assignRemainingEventLanes('user-1', 'team-1', individual.event.id)).status, 'COMPLETED');
  assert.equal(individual.event.laneAssignments.length, 4);
  assert.equal(new Set(individual.event.laneAssignments.map(item => item.slotId)).size, 4);
  assert.equal(new Set(individual.event.laneAssignments.map(item => item.memberId ?? item.guestId)).size, 4);
  assert.equal(individual.event.laneAssignments.some(item => item.memberId === 'member-4'), false, 'non-attendee assigned');
});

test('active members can read attendance names and guests without private user fields', async () => {
  const members = [1, 2].map(number => ({
    id: `member-${number}`, userId: `user-${number}`, alias: null,
    user: { name: `회원${number}` },
  }));
  const event = {
    id: 'event-visible', teamId: 'team-1', title: '공개 참석 명단',
    eventDate: new Date('2026-09-21T15:00:00.000Z'), eventTime: '19:00',
    location: '볼링장', gameType: '정기전', attendanceEnabled: true,
    laneDrawEnabled: false, laneDrawMode: 'BULK', laneDrawStatus: 'NOT_STARTED',
    competitionEnabled: true, competitionType: 'TEAM', competitionMode: 'OFFICIAL',
    competitionStatus: 'PUBLISHED', competitionGameCount: 4, rankPoints: '{}',
    competitionStartAt: null, votingDurationMinutes: 30,
    attendances: [{ memberId: 'member-1', memberDisplayName: '별명1', status: 'ATTENDING' }],
    guests: [{ id: 'guest-1', name: '게스트1' }], laneSlots: [], laneAssignments: [],
    team: { name: '테스트팀', members }, createdAt: new Date(), updatedAt: new Date(),
  };
  const prisma = {
    team: { findFirst: async () => ({
      ownerId: 'user-1', bowlerHiddenEnabled: true, User: [], members: [members[1]],
    }) },
    teamEvent: { findFirst: async () => event },
  };
  const service = loadTs('src/lib/mobile-api/team-events.ts', { '@/lib/prisma': prisma });
  for (const type of ['INDIVIDUAL', 'TEAM', 'EVENT']) {
    event.competitionType = type;
    const response = await service.getTeamEvent('user-2', 'team-1', event.id);
    assert.deepEqual(response.attendance, [
      { memberId: 'member-1', name: '별명1', status: 'ATTENDING' },
      { memberId: 'member-2', name: '회원2', status: 'UNANSWERED' },
    ], type);
    assert.deepEqual(response.guests, [{ id: 'guest-1', name: '게스트1' }], type);
    assert.equal(response.myRole, 'MEMBER', type);
    for (const item of response.attendance) {
      assert.deepEqual(Object.keys(item).sort(), ['memberId', 'name', 'status']);
    }
    assert.equal(JSON.stringify(response).includes('user-1'), false, type);
  }
});

test('event routes require authentication and keep actor/team/event scope', async () => {
  let call = null;
  const fakes = {
    '@/lib/mobile-api/auth': { getMobileApiUserId: async request => request.headers.get('x-user') },
    '@/lib/mobile-api/team-events': {
      parseTeamEventListScope: value => value ?? 'ALL',
      listTeamEvents: async (userId, teamId, scope) => { call = { userId, teamId, scope }; return { role: 'MEMBER', events: [] }; },
      createTeamEvent: async () => ({ id: 'event-1' }),
      TeamEventError: service.TeamEventError,
    },
  };
  const route = loadTs('src/app/api/mobile/v1/teams/[teamId]/events/route.ts', fakes);
  let response = await route.GET(new Request('https://example.test/events'), { params: Promise.resolve({ teamId: 'team-1' }) });
  assert.equal(response.status, 401);
  assert.equal(call, null);

  response = await route.GET(new Request('https://example.test/events?scope=UPCOMING', { headers: { 'x-user': 'member-1' } }), { params: Promise.resolve({ teamId: 'team-1' }) });
  assert.equal(response.status, 200);
  assert.deepEqual(call, { userId: 'member-1', teamId: 'team-1', scope: 'UPCOMING' });
  assert.deepEqual(await response.json(), { success: true, data: { role: 'MEMBER', events: [] } });
});

test('attendance route passes only authenticated actor and path identities to service', async () => {
  let call = null;
  const route = loadTs('src/app/api/mobile/v1/teams/[teamId]/events/[eventId]/attendance/route.ts', {
    '@/lib/mobile-api/auth': { getMobileApiUserId: async () => 'member-1' },
    '@/lib/mobile-api/team-events': {
      updateMyAttendance: async (userId, teamId, eventId, payload) => {
        call = { userId, teamId, eventId, payload };
        return { status: payload.status };
      },
      TeamEventError: service.TeamEventError,
    },
  });
  const response = await route.PUT(new Request('https://example.test/attendance', {
    method: 'PUT', body: JSON.stringify({ status: 'ATTENDING', memberId: 'other-member' }),
    headers: { 'content-type': 'application/json' },
  }), { params: Promise.resolve({ teamId: 'team-1', eventId: 'event-1' }) });
  assert.equal(response.status, 200);
  assert.deepEqual(call, {
    userId: 'member-1', teamId: 'team-1', eventId: 'event-1',
    payload: { status: 'ATTENDING', memberId: 'other-member' },
  });
});

test('managed attendance route uses authenticated actor and path member identity', async () => {
  let call = null;
  const route = loadTs('src/app/api/mobile/v1/teams/[teamId]/events/[eventId]/attendance/[memberId]/route.ts', {
    '@/lib/mobile-api/auth': { getMobileApiUserId: async () => 'manager-user' },
    '@/lib/mobile-api/team-events': {
      updateMemberAttendance: async (userId, teamId, eventId, memberId, payload) => {
        call = { userId, teamId, eventId, memberId, payload };
        return { memberId, status: payload.status };
      },
      TeamEventError: service.TeamEventError,
    },
  });
  const response = await route.PUT(new Request('https://example.test/attendance/member-target', {
    method: 'PUT', body: JSON.stringify({ status: 'UNANSWERED', userId: 'payload-user' }),
    headers: { 'content-type': 'application/json' },
  }), { params: Promise.resolve({ teamId: 'team-1', eventId: 'event-1', memberId: 'member-target' }) });
  assert.equal(response.status, 200);
  assert.deepEqual(call, {
    userId: 'manager-user', teamId: 'team-1', eventId: 'event-1', memberId: 'member-target',
    payload: { status: 'UNANSWERED', userId: 'payload-user' },
  });
});

test('owner and manager can change a team member attendance while member and cross-team target are rejected', async () => {
  for (const role of ['OWNER', 'MANAGER']) {
    const calls = [];
    const actorId = `${role.toLowerCase()}-user`;
    const prisma = {
      team: { findFirst: async () => ({
        ownerId: role === 'OWNER' ? actorId : 'owner-user', bowlerHiddenEnabled: false,
        User: role === 'MANAGER' ? [{ id: actorId }] : [],
        members: [{ id: 'actor-member', alias: null, user: { name: '관리자' } }],
      }) },
      teamEvent: { findFirst: async () => ({
        id: 'event-1', teamId: 'team-1', attendanceEnabled: true,
        competitionEnabled: false, competitionType: null, competitionStatus: 'ATTENDANCE_OPEN', laneDrawStatus: 'NOT_STARTED',
        team: { members: [{ id: 'target-member', alias: '대상', user: { name: '대상 회원' } }] },
      }) },
      teamEventAttendance: { upsert: async input => { calls.push(input); return input; } },
    };
    const scoped = loadTs('src/lib/mobile-api/team-events.ts', { '@/lib/prisma': prisma }, new Map());
    assert.deepEqual(await scoped.updateMemberAttendance(actorId, 'team-1', 'event-1', 'target-member', { status: 'ATTENDING' }), {
      memberId: 'target-member', status: 'ATTENDING',
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].create.memberDisplayName, '대상');
  }

  const memberPrisma = {
    team: { findFirst: async () => ({
      ownerId: 'owner-user', bowlerHiddenEnabled: false, User: [],
      members: [{ id: 'actor-member', alias: null, user: { name: '회원' } }],
    }) },
  };
  const memberService = loadTs('src/lib/mobile-api/team-events.ts', { '@/lib/prisma': memberPrisma }, new Map());
  await assert.rejects(
    memberService.updateMemberAttendance('member-user', 'team-1', 'event-1', 'target-member', { status: 'ATTENDING' }),
    error => error.code === 'FORBIDDEN' && error.status === 403,
  );

  let writes = 0;
  const crossTeamPrisma = {
    team: { findFirst: async () => ({
      ownerId: 'owner-user', bowlerHiddenEnabled: false, User: [],
      members: [{ id: 'owner-member', alias: null, user: { name: '소유자' } }],
    }) },
    teamEvent: { findFirst: async () => ({
      id: 'event-1', teamId: 'team-1', attendanceEnabled: true,
      competitionEnabled: false, competitionType: null, competitionStatus: 'ATTENDANCE_OPEN', laneDrawStatus: 'NOT_STARTED',
      team: { members: [{ id: 'same-team-member', alias: null, user: { name: '같은 팀' } }] },
    }) },
    teamEventAttendance: { upsert: async () => { writes += 1; } },
  };
  const crossTeamService = loadTs('src/lib/mobile-api/team-events.ts', { '@/lib/prisma': crossTeamPrisma }, new Map());
  await assert.rejects(
    crossTeamService.updateMemberAttendance('owner-user', 'team-1', 'event-1', 'other-team-member', { status: 'ATTENDING' }),
    error => error.code === 'MEMBER_NOT_FOUND' && error.status === 404,
  );
  assert.equal(writes, 0);
});
