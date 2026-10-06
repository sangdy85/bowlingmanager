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

function regressionHarness() {
  const members = Array.from({ length: 6 }, (_, index) => ({
    id: `member-${index + 1}`,
    userId: `user-${index + 1}`,
    alias: null,
    user: { name: `회원${index + 1}` },
  }));
  const event = {
    id: 'event-override', teamId: 'team-1', title: '수동 편성 회귀 테스트',
    eventDate: new Date('2026-10-06T00:00:00Z'), gameType: '정기전',
    competitionEnabled: true, competitionType: 'TEAM', competitionMode: 'OFFICIAL',
    competitionStatus: 'ATTENDANCE_OPEN', competitionGameCount: 4,
    draftGeneration: 1, currentPickNumber: 1, laneDrawStatus: 'NOT_STARTED',
    rankPoints: '{}',
    team: {
      ownerId: 'user-1', bowlerHiddenEnabled: true, User: [], members,
    },
    attendances: members.map(member => ({
      memberId: member.id, status: 'ATTENDING', member,
    })),
    guests: [], competitionTeams: [], competitionParticipants: [],
    competitionDraftPicks: [], eventCompetitionParticipants: [],
    eventCompetitionBallots: [], laneSlots: [], laneAssignments: [],
    seasonPublications: [], adminAudits: [], _count: { scores: 0, charges: 0 },
  };
  let participantSequence = 0;
  let teamSequence = 0;
  let pickSequence = 0;

  const syncRelations = () => {
    for (const team of event.competitionTeams) {
      team.captain = members.find(member => member.id === team.captainMemberId);
      team.participants = event.competitionParticipants
        .filter(participant => participant.competitionTeamId === team.id)
        .sort((left, right) =>
          (left.assignmentOrder ?? Number.MAX_SAFE_INTEGER) -
            (right.assignmentOrder ?? Number.MAX_SAFE_INTEGER) ||
          left.id.localeCompare(right.id));
    }
    for (const pick of event.competitionDraftPicks) {
      pick.competitionTeam = event.competitionTeams.find(team => team.id === pick.competitionTeamId);
      pick.selectedParticipant = event.competitionParticipants.find(
        participant => participant.id === pick.selectedParticipantId,
      ) ?? null;
    }
    return event;
  };

  const matches = (actual, expected) => {
    if (expected == null || typeof expected !== 'object') return actual === expected;
    if (Array.isArray(expected.in)) return expected.in.includes(actual);
    if (Object.hasOwn(expected, 'not')) return actual !== expected.not;
    return true;
  };
  const applyData = (target, data) => {
    for (const [key, value] of Object.entries(data)) {
      if (value && typeof value === 'object' && Number.isInteger(value.increment)) {
        target[key] += value.increment;
      } else {
        target[key] = value;
      }
    }
  };
  const teamEventMatches = where =>
    (!where.id || where.id === event.id) &&
    (!where.teamId || where.teamId === event.teamId) &&
    (!Object.hasOwn(where, 'competitionStatus') || matches(event.competitionStatus, where.competitionStatus)) &&
    (!Object.hasOwn(where, 'currentPickNumber') || event.currentPickNumber === where.currentPickNumber) &&
    (!Object.hasOwn(where, 'draftGeneration') || event.draftGeneration === where.draftGeneration) &&
    (!Object.hasOwn(where, 'laneDrawStatus') || event.laneDrawStatus === where.laneDrawStatus);

  const prisma = {
    teamEvent: {
      findFirst: async ({ where }) =>
        teamEventMatches(where) ? structuredClone(syncRelations()) : null,
      update: async ({ data }) => { applyData(event, data); return syncRelations(); },
      updateMany: async ({ where, data }) => {
        if (!teamEventMatches(where)) return { count: 0 };
        applyData(event, data);
        return { count: 1 };
      },
    },
    teamCompetitionParticipant: {
      create: async ({ data }) => {
        const member = data.memberId
          ? members.find(item => item.id === data.memberId) ?? null
          : null;
        const row = {
          id: `participant-${++participantSequence}`,
          competitionTeamId: null, assignmentType: null, assignmentOrder: null,
          guestId: null, guest: null, member, ...data,
        };
        event.competitionParticipants.push(row);
        return row;
      },
      update: async ({ where, data }) => {
        const row = event.competitionParticipants.find(item => item.id === where.id);
        assert.ok(row);
        applyData(row, data);
        return row;
      },
      updateMany: async ({ where, data }) => {
        const row = event.competitionParticipants.find(item => item.id === where.id);
        if (!row || (Object.hasOwn(where, 'competitionTeamId') && row.competitionTeamId !== where.competitionTeamId)) {
          return { count: 0 };
        }
        applyData(row, data);
        return { count: 1 };
      },
    },
    teamCompetitionTeam: {
      create: async ({ data }) => {
        const row = {
          id: `competition-team-${++teamSequence}`,
          lanePriority: null, teamHandicap: 0, participants: [], ...data,
        };
        event.competitionTeams.push(row);
        return row;
      },
    },
    teamCompetitionDraftPick: {
      create: async ({ data }) => {
        const row = { id: `pick-${++pickSequence}`, createdAt: new Date(), ...data };
        event.competitionDraftPicks.push(row);
        return row;
      },
    },
    teamEventLaneAssignment: {
      deleteMany: async () => {
        const count = event.laneAssignments.length;
        event.laneAssignments = [];
        return { count };
      },
    },
    teamEventAdminAudit: {
      create: async ({ data }) => {
        const row = { id: `audit-${event.adminAudits.length + 1}`, createdAt: new Date(), ...data };
        event.adminAudits.unshift(row);
        return row;
      },
    },
    score: {
      count: async () => event._count.scores,
      findMany: async () => [],
      deleteMany: async () => {
        const count = event._count.scores;
        event._count.scores = 0;
        return { count };
      },
    },
  };
  prisma.$transaction = async callback => callback(prisma);

  const notificationTypes = {
    laneAssigned: 'LANE_ASSIGNED',
    teamCaptainSelected: 'TEAM_CAPTAIN_SELECTED',
    teamDraftTurn: 'TEAM_DRAFT_TURN',
    teamMemberSelected: 'TEAM_MEMBER_SELECTED',
  };
  const commonOverrides = {
    '@/lib/prisma': prisma,
    '@/lib/mobile-api/notifications': {
      enqueueMobileNotifications: async () => {},
      MOBILE_NOTIFICATION_TYPES: notificationTypes,
    },
    '@/lib/mobile-api/event-admin-audit': { recordEventAdminAudit: async () => {} },
    '@/lib/mobile-api/unified-season': {
      UnifiedSeasonError: class UnifiedSeasonError extends Error {},
      createSeasonPointPublication: async () => {},
      getPublicationPointTable: async () => [],
      getSeasonPointPreview: async () => [],
      revokeSeasonPointPublication: async () => {},
      seasonPointsForRank: () => 0,
    },
    '@/lib/mobile-api/team-game-points': {
      defaultTeamGamePointTables: count => Array.from({ length: count }, (_, index) => ({
        gameNumber: index + 1, points: [],
      })),
      parseTeamGamePointTables: value => value,
      readTeamGamePointTables: (_value, count) => Array.from({ length: count }, (_, index) => ({
        gameNumber: index + 1, points: [],
      })),
      serializeTeamGamePointTables: JSON.stringify,
    },
    '@/lib/mobile-api/team-event-guest': { normalizeTeamEventGuestName: value => value },
  };
  const teamService = loadTs('src/lib/mobile-api/team-competition.ts', commonOverrides);
  const adminService = loadTs('src/lib/mobile-api/event-admin-operations.ts', commonOverrides);
  return { event, members, prisma, syncRelations, teamService, adminService };
}

test('manual override keeps the finalized TEAM state readable with stale draft history', async () => {
  const harness = regressionHarness();
  const { event, teamService, adminService } = harness;

  assert.deepEqual(
    await teamService.updateTeamCompetition('user-1', 'team-1', event.id, { action: 'LOCK_ATTENDANCE' }),
    { status: 'ATTENDANCE_LOCKED' },
  );
  assert.deepEqual(
    await teamService.updateTeamCompetition('user-1', 'team-1', event.id, {
      action: 'CONFIGURE_CAPTAINS',
      captains: [
        { memberId: 'member-1', draftOrder: 1 },
        { memberId: 'member-4', draftOrder: 2 },
      ],
    }),
    { status: 'DRAFT_READY' },
  );
  assert.equal(
    (await teamService.updateTeamCompetition('user-1', 'team-1', event.id, { action: 'START_DRAFT' })).status,
    'DRAFT_IN_PROGRESS',
  );
  const participant = memberId => event.competitionParticipants.find(item => item.memberId === memberId);
  await teamService.updateTeamCompetition('user-1', 'team-1', event.id, {
    action: 'PICK', participantId: participant('member-2').id,
  });
  await teamService.updateTeamCompetition('user-4', 'team-1', event.id, {
    action: 'PICK', participantId: participant('member-5').id,
  });
  await teamService.updateTeamCompetition('user-4', 'team-1', event.id, {
    action: 'PICK', participantId: participant('member-6').id,
  });
  const finalized = await teamService.updateTeamCompetition('user-1', 'team-1', event.id, {
    action: 'PICK', participantId: participant('member-3').id,
  });
  assert.equal(finalized.status, 'TEAMS_FINALIZED');
  assert.equal(event.competitionStatus, 'TEAMS_FINALIZED');

  harness.syncRelations();
  const [teamOne, teamTwo] = event.competitionTeams;
  const overrideResult = await adminService.runEventAdminOperation(
    'user-1',
    'team-1',
    event.id,
    {
      action: 'ADMIN_TEAM_OVERRIDE',
      assignments: event.competitionParticipants.map(item => ({
        participantId: item.id,
        competitionTeamId: item.memberId === 'member-1' ? teamOne.id : teamTwo.id,
      })),
    },
  );
  assert.equal(overrideResult.status, 'TEAMS_FINALIZED');

  harness.syncRelations();
  assert.equal(
    event.competitionParticipants.find(item => item.memberId === 'member-2').assignmentType,
    'ADMIN_OVERRIDE',
  );
  const adminState = await adminService.getEventAdminOperationsState(
    'user-1', 'team-1', event.id,
  );
  assert.equal(
    adminState.teams[1].members.find(item => item.memberId === 'member-2').assignmentType,
    'ADMIN_OVERRIDE',
  );
  const responseState = await teamService.getTeamCompetitionState('user-1', 'team-1', event.id);
  const route = loadTs('src/app/api/mobile/v1/teams/[teamId]/events/[eventId]/competition/team/route.ts', {
    '@/lib/mobile-api/auth': { getMobileApiUserId: async () => 'user-1' },
    '@/lib/mobile-api/team-competition': {
      TeamCompetitionError: teamService.TeamCompetitionError,
      getTeamCompetitionState: async () => responseState,
      updateTeamCompetition: teamService.updateTeamCompetition,
    },
    '@/lib/mobile-api/unified-season': commonUnifiedSeasonForRoute(),
    '@/lib/mobile-api/response': {
      mobileApiSuccess: (data, status = 200) => Response.json({ success: true, data }, { status }),
      mobileApiError: (code, message, status) => Response.json({ success: false, error: { code, message } }, { status }),
      unauthorizedResponse: () => Response.json({ success: false }, { status: 401 }),
      internalServerErrorResponse: () => Response.json({ success: false }, { status: 500 }),
    },
  });
  const response = await route.GET(new Request('https://example.test'), {
    params: Promise.resolve({ teamId: 'team-1', eventId: event.id }),
  });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.data.status, 'TEAMS_FINALIZED');
  assert.equal(payload.data.teams.length, 2);
  assert.equal(payload.data.teams[0].captainMemberId, 'member-1');
  assert.equal(payload.data.teams[1].captainMemberId, 'member-4');
  assert.deepEqual(
    payload.data.teams[1].members.map(item => item.memberId).sort(),
    ['member-2', 'member-3', 'member-4', 'member-5', 'member-6'],
  );
  assert.equal(payload.data.teams[1].members.find(item => item.memberId === 'member-2').assignmentType, 'DRAFT');
  assert.equal(payload.data.teams[1].members.find(item => item.memberId === 'member-3').assignmentType, 'DRAFT');
  assert.deepEqual(payload.data.remainingParticipants, []);
  assert.equal(event.laneDrawStatus, 'NOT_STARTED');
  assert.equal(event.competitionDraftPicks.length, 4);
});

function commonUnifiedSeasonForRoute() {
  return { UnifiedSeasonError: class UnifiedSeasonError extends Error {} };
}
