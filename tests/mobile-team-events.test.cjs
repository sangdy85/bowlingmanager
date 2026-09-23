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
    competitionEnabled: false, competitionType: null, competitionMode: null, competitionGameCount: null, rankPoints: [],
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
    competitionEnabled: true, competitionType: 'TEAM', rankPoints: [{ rank: 1, points: 20 }],
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

test('event routes require authentication and keep actor/team/event scope', async () => {
  let call = null;
  const fakes = {
    '@/lib/mobile-api/auth': { getMobileApiUserId: async request => request.headers.get('x-user') },
    '@/lib/mobile-api/team-events': {
      listTeamEvents: async (userId, teamId) => { call = { userId, teamId }; return { role: 'MEMBER', events: [] }; },
      createTeamEvent: async () => ({ id: 'event-1' }),
      TeamEventError: service.TeamEventError,
    },
  };
  const route = loadTs('src/app/api/mobile/v1/teams/[teamId]/events/route.ts', fakes);
  let response = await route.GET(new Request('https://example.test/events'), { params: Promise.resolve({ teamId: 'team-1' }) });
  assert.equal(response.status, 401);
  assert.equal(call, null);

  response = await route.GET(new Request('https://example.test/events', { headers: { 'x-user': 'member-1' } }), { params: Promise.resolve({ teamId: 'team-1' }) });
  assert.equal(response.status, 200);
  assert.deepEqual(call, { userId: 'member-1', teamId: 'team-1' });
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
