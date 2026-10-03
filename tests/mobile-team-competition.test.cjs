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

function member(number) {
  return { id: `member-${number}`, userId: `user-${number}`, alias: null, user: { name: `회원${number}` } };
}

function eventFixture({ incomplete = false, pointTie = false } = {}) {
  const members = [1, 2, 3, 4, 5].map(member);
  const participant = (number, teamId, order) => ({
    id: `participant-${number}`, eventId: 'event-1', generation: 1,
    memberId: `member-${number}`, competitionTeamId: teamId,
    assignmentType: order === 0 ? 'CAPTAIN' : 'DRAFT', assignmentOrder: order,
    member: members[number - 1],
  });
  const participants = [
    participant(1, 'competition-team-1', 0), participant(2, 'competition-team-1', 1),
    participant(3, 'competition-team-1', 2), participant(4, 'competition-team-2', 0),
    participant(5, 'competition-team-2', 3),
  ];
  const teams = [
    {
      id: 'competition-team-1', generation: 1, name: 'TEAM 1', draftOrder: 1,
      lanePriority: null, teamHandicap: 0, captainMemberId: 'member-1',
      captain: members[0], participants: participants.slice(0, 3),
    },
    {
      id: 'competition-team-2', generation: 1, name: 'TEAM 2', draftOrder: 2,
      lanePriority: null, teamHandicap: 0, captainMemberId: 'member-4',
      captain: members[3], participants: participants.slice(3),
    },
  ];
  const scores = [
    [1, 220, 250], [2, 200, 240], [3, 100, 100],
    [4, 180, 190], [5, 170, 180],
  ].flatMap(([number, first, second]) => [
    { id: `score-${number}-1`, userId: `user-${number}`, score: first },
    ...((incomplete && number === 5) ? [] : [{ id: `score-${number}-2`, userId: `user-${number}`, score: pointTie ? second + 120 : second }]),
  ]);
  return {
    event: {
      id: 'event-1', teamId: 'team-1', eventDate: new Date('2026-09-22T00:00:00+09:00'),
      gameType: '정기전', competitionEnabled: true, competitionType: 'TEAM',
      competitionStatus: 'TEAMS_FINALIZED', competitionGameCount: 2,
      draftGeneration: 1, currentPickNumber: 4,
      rankPoints: JSON.stringify({ 1: 5, 2: 3 }),
      team: { ownerId: 'user-1', bowlerHiddenEnabled: true, User: [], members },
      attendances: members.map(item => ({ status: 'ATTENDING', member: item })),
      competitionTeams: teams, competitionParticipants: participants,
      competitionDraftPicks: [], laneSlots: [], laneAssignments: [],
    },
    scores,
  };
}

test('snake draft is deterministic and the 19/4 plan reserves three random assignments', () => {
  const service = loadTs('src/lib/mobile-api/team-competition.ts', {
    '@/lib/prisma': {}, '@/lib/mobile-api/bowler-hidden': { readRankPoints: () => [] },
  });
  assert.deepEqual(
    Array.from({ length: 8 }, (_, index) => service.snakeDraftTurn(index + 1, 4).draftOrder),
    [1, 2, 3, 4, 4, 3, 2, 1],
  );
  assert.deepEqual(service.draftPlan(19, 4), {
    attendeeCount: 19, captainCount: 4, draftPerTeam: 3, draftTotal: 12, remainder: 3,
  });
});

test('19/4 draft enforces every snake turn and records twelve picks plus three balanced random assignments', async () => {
  const members = Array.from({ length: 19 }, (_, index) => member(index + 1));
  const participants = members.map((item, index) => ({
    id: `participant-${index + 1}`, eventId: 'event-draft', generation: 1,
    memberId: item.id, competitionTeamId: index < 4 ? `team-${index + 1}` : null,
    assignmentType: index < 4 ? 'CAPTAIN' : null, assignmentOrder: index < 4 ? 0 : null,
    member: item,
  }));
  for (let index = 17; index < 19; index += 1) {
    participants[index].memberId = null;
    participants[index].guestId = `guest-${index - 16}`;
    participants[index].member = null;
    participants[index].guest = { id: participants[index].guestId, name: `게스트${index - 16}` };
  }
  const teams = members.slice(0, 4).map((captain, index) => ({
    id: `team-${index + 1}`, generation: 1, name: `TEAM ${index + 1}`, draftOrder: index + 1,
    lanePriority: null, teamHandicap: 0, captainMemberId: captain.id, captain,
    participants: [participants[index]],
  }));
  const event = {
    id: 'event-draft', teamId: 'team-1', title: '9월 팀전', competitionEnabled: true, competitionType: 'TEAM',
    competitionStatus: 'DRAFT_READY', draftGeneration: 1, currentPickNumber: 1,
    team: { ownerId: 'user-1', bowlerHiddenEnabled: true, User: [], members },
    attendances: members.slice(0, 17).map(item => ({ status: 'ATTENDING', member: item })), guests: [{ id: 'guest-1', name: '게스트1' }, { id: 'guest-2', name: '게스트2' }],
    competitionTeams: teams, competitionParticipants: participants, competitionDraftPicks: [],
    laneSlots: [], laneAssignments: [], seasonPublications: [], rankPoints: '{}',
  };
  const notifications = [];
  const prisma = {
    teamEvent: {
      findFirst: async args => args.where.id === event.id && args.where.teamId === event.teamId ? { ...event } : null,
      updateMany: async args => {
        if (args.where.competitionStatus && event.competitionStatus !== args.where.competitionStatus) return { count: 0 };
        if (args.where.currentPickNumber && event.currentPickNumber !== args.where.currentPickNumber) return { count: 0 };
        if (args.data.competitionStatus) event.competitionStatus = args.data.competitionStatus;
        if (typeof args.data.currentPickNumber === 'number') event.currentPickNumber = args.data.currentPickNumber;
        if (args.data.currentPickNumber?.increment) event.currentPickNumber += args.data.currentPickNumber.increment;
        return { count: 1 };
      },
      update: async args => {
        if (args.data.competitionStatus) event.competitionStatus = args.data.competitionStatus;
        if (typeof args.data.currentPickNumber === 'number') event.currentPickNumber = args.data.currentPickNumber;
        return event;
      },
    },
    teamCompetitionParticipant: {
      updateMany: async args => {
        const participant = participants.find(item => item.id === args.where.id);
        if (!participant || participant.competitionTeamId !== null) return { count: 0 };
        Object.assign(participant, args.data);
        return { count: 1 };
      },
      update: async args => {
        const participant = participants.find(item => item.id === args.where.id);
        Object.assign(participant, args.data);
        return participant;
      },
    },
    teamCompetitionDraftPick: {
      create: async args => {
        assert.equal(event.competitionDraftPicks.some(item => item.pickNumber === args.data.pickNumber), false, 'duplicate pick number');
        assert.equal(event.competitionDraftPicks.some(item => item.selectedParticipantId === args.data.selectedParticipantId), false, 'duplicate participant history');
        event.competitionDraftPicks.push({ id: `pick-${args.data.pickNumber}`, ...args.data });
        return event.competitionDraftPicks.at(-1);
      },
    },
    mobileNotification: { upsert: async ({ where, create }) => {
      const existing = notifications.find(item => item.dedupeKey === where.dedupeKey);
      if (existing) return existing;
      const row = { id: `notification-${notifications.length + 1}`, ...create };
      notifications.push(row); return row;
    } },
    mobilePushDevice: { findMany: async () => [] },
    mobileNotificationDelivery: { upsert: async () => ({}) },
  };
  prisma.$transaction = async callback => callback(prisma);
  const service = loadTs('src/lib/mobile-api/team-competition.ts', {
    '@/lib/prisma': prisma, '@/lib/mobile-api/bowler-hidden': { readRankPoints: () => [] },
  });

  assert.equal((await service.updateTeamCompetition('user-1', 'team-1', event.id, { action: 'START_DRAFT' })).status, 'DRAFT_IN_PROGRESS');
  await assert.rejects(
    service.updateTeamCompetition('user-2', 'team-1', event.id, { action: 'PICK', memberId: 'member-5' }),
    error => error.code === 'NOT_CURRENT_CAPTAIN',
  );
  const actorOrder = [1, 2, 3, 4, 4, 3, 2, 1, 1, 2, 3, 4];
  for (let index = 0; index < 12; index += 1) {
    const actor = `user-${actorOrder[index]}`;
    const selected = `member-${index + 5}`;
    await service.updateTeamCompetition(actor, 'team-1', event.id, { action: 'PICK', memberId: selected });
    if (index === 0) {
      await assert.rejects(
        service.updateTeamCompetition('user-2', 'team-1', event.id, { action: 'PICK', memberId: selected }),
        error => error.code === 'PLAYER_ALREADY_DRAFTED',
      );
    }
  }

  assert.equal(event.competitionStatus, 'LUCKY_DRAW');
  await service.updateTeamCompetition('user-1', 'team-1', event.id, { action: 'AUTO_ASSIGN_REMAINDER' });
  assert.equal(event.competitionStatus, 'TEAMS_FINALIZED');
  assert.equal(event.competitionDraftPicks.length, 15);
  assert.equal(new Set(event.competitionDraftPicks.map(item => item.pickNumber)).size, 15);
  assert.equal(new Set(event.competitionDraftPicks.map(item => item.selectedParticipantId)).size, 15);
  assert.equal(participants.filter(item => !item.competitionTeamId).length, 0);
  assert.equal(participants.filter(item => item.guestId && item.competitionTeamId).length, 2);
  const sizes = teams.map(team => participants.filter(item => item.competitionTeamId === team.id).length);
  assert.deepEqual([...sizes].sort((a, b) => b - a), [5, 5, 5, 4]);
  assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1);
  assert.deepEqual(event.competitionDraftPicks.slice(0, 12).map(item => Number(item.competitionTeamId.slice(-1))), actorOrder);
  assert.equal(event.competitionDraftPicks.slice(12).every(item => item.pickType === 'AUTO_REMAINDER'), true);
  const turns = notifications.filter(item => item.type === 'TEAM_DRAFT_TURN');
  const selected = notifications.filter(item => item.type === 'TEAM_MEMBER_SELECTED');
  assert.equal(turns.length, 13);
  assert.equal(new Set(turns.map(item => item.dedupeKey)).size, 13);
  assert.ok(turns.some(item => item.dedupeKey.includes(':4:member-4')));
  assert.ok(turns.some(item => item.dedupeKey.includes(':5:member-4')), 'same captain gets a distinct consecutive turn');
  assert.equal(selected.length, 13, 'member picks notify while guest assignments do not');
  assert.equal(new Set(selected.map(item => item.dedupeKey)).size, 13);
});

test('lucky draw server policy supports wins, misses and forces a bounded win', () => {
  const service = loadTs('src/lib/mobile-api/team-competition.ts', {
    '@/lib/prisma': {}, '@/lib/mobile-api/bowler-hidden': { readRankPoints: () => [] },
  });
  assert.equal(service.luckyDrawWins(0, 4, () => 0), true);
  assert.equal(service.luckyDrawWins(0, 4, () => 1), false);
  assert.equal(service.luckyDrawWins(3, 4, () => 1), true);
});

test('official lane example allocates non-interleaved contiguous team blocks', () => {
  const service = loadTs('src/lib/mobile-api/team-competition.ts', {
    '@/lib/prisma': {}, '@/lib/mobile-api/bowler-hidden': { readRankPoints: () => [] },
  });
  const slots = [];
  for (let lane = 9; lane <= 14; lane += 1) {
    for (let position = 1; position <= 3; position += 1) slots.push({ id: `${lane}-${position}`, laneNumber: lane, position });
  }
  const teams = [4, 5, 4, 5].map((size, index) => ({
    id: `team-${index + 1}`, lanePriority: index + 1,
    memberIds: Array.from({ length: size }, (_, memberIndex) => `m-${index + 1}-${memberIndex + 1}`),
  }));
  const blocks = service.allocateTeamLaneBlocks(teams, slots);
  assert.deepEqual(blocks.map(block => block.assignments.map(item => item.slot.id)), [
    ['9-1', '9-2', '9-3', '10-1'],
    ['10-2', '10-3', '11-1', '11-2', '11-3'],
    ['12-1', '12-2', '12-3', '13-1'],
    ['13-2', '13-3', '14-1', '14-2', '14-3'],
  ]);
  assert.throws(
    () => service.allocateTeamLaneBlocks(teams, slots.slice(0, -1)),
    error => error.code === 'PARTICIPANT_SLOT_MISMATCH',
  );
});

test('19-person operating fixture expands mixed capacities and assigns each team contiguously', () => {
  const service = loadTs('src/lib/mobile-api/team-competition.ts', {
    '@/lib/prisma': {}, '@/lib/mobile-api/bowler-hidden': { readRankPoints: () => [] },
  });
  const capacities = new Map([[8, 3], [9, 3], [10, 3], [11, 3], [12, 2], [13, 3], [14, 2]]);
  const slots = [...capacities].flatMap(([laneNumber, count]) =>
    Array.from({ length: count }, (_, index) => ({
      id: `${laneNumber}-${index + 1}`, laneNumber, position: index + 1,
    })),
  );
  assert.deepEqual(slots.map(item => item.id), [
    '8-1', '8-2', '8-3', '9-1', '9-2', '9-3', '10-1', '10-2', '10-3',
    '11-1', '11-2', '11-3', '12-1', '12-2', '13-1', '13-2', '13-3', '14-1', '14-2',
  ]);
  const orderedSizes = [4, 5, 5, 5];
  const teams = [4, 1, 2, 3].map((teamNumber, index) => ({
    id: `team-${teamNumber}`, lanePriority: index + 1,
    memberIds: Array.from({ length: orderedSizes[index] }, (_, memberIndex) =>
      `team-${teamNumber}-participant-${memberIndex + 1}`),
  }));
  const blocks = service.allocateTeamLaneBlocks(teams, slots);
  assert.deepEqual(blocks.map(item => item.competitionTeamId), ['team-4', 'team-1', 'team-2', 'team-3']);
  assert.deepEqual(blocks.map(item => item.assignments.map(assignment => assignment.slot.id)), [
    ['8-1', '8-2', '8-3', '9-1'],
    ['9-2', '9-3', '10-1', '10-2', '10-3'],
    ['11-1', '11-2', '11-3', '12-1', '12-2'],
    ['13-1', '13-2', '13-3', '14-1', '14-2'],
  ]);
  assert.equal(new Set(blocks.flatMap(item => item.assignments.map(assignment => assignment.slot.id))).size, 19);
});

test('configured full lane pool keeps each team contiguous and leaves extra slots unused', () => {
  const service = loadTs('src/lib/mobile-api/team-competition.ts', {
    '@/lib/prisma': {}, '@/lib/mobile-api/bowler-hidden': { readRankPoints: () => [] },
  });
  const teams = [4, 5, 4, 5].map((size, index) => ({
    id: `team-${index + 1}`, lanePriority: index + 1,
    memberIds: Array.from({ length: size }, (_, memberIndex) => `m-${index + 1}-${memberIndex + 1}`),
  }));
  const slots = [3, 4, 5, 6].flatMap(lane => Array.from({ length: 6 }, (_, index) => ({
    id: `${lane}-${index + 1}`, laneNumber: lane, position: index + 1,
  })));
  const blocks = service.allocateTeamLaneBlocks(teams, slots);
  assert.deepEqual(blocks.map(block => block.assignments.map(item => item.slot.id)), [
    ['3-1', '3-2', '3-3', '3-4'],
    ['3-5', '3-6', '4-1', '4-2', '4-3'],
    ['4-4', '4-5', '4-6', '5-1'],
    ['5-2', '5-3', '5-4', '5-5', '5-6'],
  ]);
  assert.deepEqual(blocks.map(block => block.competitionTeamId), ['team-1', 'team-2', 'team-3', 'team-4']);
  assert.equal(new Set(blocks.flatMap(block => block.assignments.map(item => item.slot.id))).size, 18);
  assert.throws(
    () => service.allocateTeamLaneBlocks(teams, slots.filter(slot => slot.laneNumber > 4)),
    error => error.code === 'PARTICIPANT_SLOT_MISMATCH',
  );
});

test('team lane allocation uses canonical sparse slot order, team priority and submitted member order', () => {
  const service = loadTs('src/lib/mobile-api/team-competition.ts', {
    '@/lib/prisma': {}, '@/lib/mobile-api/bowler-hidden': { readRankPoints: () => [] },
  });
  const teams = [
    { id: 'team-2', lanePriority: 2, memberIds: ['c', 'd'] },
    { id: 'team-1', lanePriority: 1, memberIds: ['b', 'a'] },
    { id: 'team-3', lanePriority: 3, memberIds: ['e'] },
  ];
  const slots = [
    { id: '2-3', laneNumber: 2, position: 3 },
    { id: '1-5', laneNumber: 1, position: 5 },
    { id: 'unused', laneNumber: 9, position: 1 },
    { id: '1-1', laneNumber: 1, position: 1 },
    { id: '2-2', laneNumber: 2, position: 2 },
    { id: '1-2', laneNumber: 1, position: 2 },
  ];
  const blocks = service.allocateTeamLaneBlocks(teams, slots);
  assert.deepEqual(blocks.map(block => ({
    team: block.competitionTeamId,
    members: block.assignments.map(item => item.memberId),
    slots: block.assignments.map(item => item.slot.id),
  })), [
    { team: 'team-1', members: ['b', 'a'], slots: ['1-1', '1-2'] },
    { team: 'team-2', members: ['c', 'd'], slots: ['1-5', '2-2'] },
    { team: 'team-3', members: ['e'], slots: ['2-3'] },
  ]);
  assert.equal(blocks.flatMap(block => block.assignments).some(item => item.slot.id === 'unused'), false);
});

function laneAdjustmentHarness({ status = 'LANES_ASSIGNED', scoreCount = 0, failCreateAt = null } = {}) {
  const members = [1, 2, 3].map(member);
  const participants = members.map((item, index) => ({
    id: `participant-${index + 1}`, eventId: 'event-adjust', generation: 2,
    memberId: item.id, guestId: null, competitionTeamId: index < 2 ? 'competition-team-1' : 'competition-team-2',
    assignmentType: index === 0 || index === 2 ? 'CAPTAIN' : 'DRAFT', assignmentOrder: index, member: item, guest: null,
  }));
  const laneSlots = [1, 2, 3, 4].map(position => ({ id: `slot-${position}`, eventId: 'event-adjust', laneNumber: 1, position }));
  const event = {
    id: 'event-adjust', teamId: 'team-1', title: '레인 조정', competitionEnabled: true, competitionType: 'TEAM',
    competitionStatus: status, laneDrawStatus: 'COMPLETED', draftGeneration: 2, currentPickNumber: 2,
    team: { ownerId: 'user-1', isActive: true, bowlerHiddenEnabled: true, User: [], members }, attendances: [], guests: [],
    competitionParticipants: participants,
    competitionTeams: [
      { id: 'competition-team-1', generation: 2, draftOrder: 1, lanePriority: 1, participants: participants.slice(0, 2), captain: members[0] },
      { id: 'competition-team-2', generation: 2, draftOrder: 2, lanePriority: 2, participants: participants.slice(2), captain: members[2] },
    ],
    competitionDraftPicks: [], laneSlots, laneAssignments: [], seasonPublications: [], rankPoints: '{}',
  };
  let assignments = participants.map((participant, index) => ({
    id: `assignment-${index + 1}`, eventId: event.id, slotId: laneSlots[index].id,
    memberId: participant.memberId, guestId: null, participantKind: 'MEMBER', participantDisplayName: participant.member.user.name,
  }));
  let createCount = 0;
  const prisma = {
    teamEvent: {
      findFirst: async args => args.where.id === event.id && args.where.teamId === event.teamId ? event : null,
      updateMany: async args => {
        if (args.where.competitionStatus !== event.competitionStatus || args.where.laneDrawStatus !== event.laneDrawStatus ||
            args.where.draftGeneration !== event.draftGeneration) return { count: 0 };
        return { count: 1 };
      },
    },
    score: { count: async () => scoreCount },
    teamEventLaneAssignment: {
      deleteMany: async () => { const count = assignments.length; assignments = []; return { count }; },
      create: async ({ data }) => {
        createCount += 1;
        if (failCreateAt === createCount) throw new Error('synthetic create failure');
        const row = { id: `new-${createCount}`, ...data };
        assignments.push(row); return row;
      },
    },
  };
  prisma.$transaction = async callback => {
    const snapshot = assignments.map(item => ({ ...item }));
    try { return await callback(prisma); }
    catch (error) { assignments = snapshot; throw error; }
  };
  const service = loadTs('src/lib/mobile-api/team-competition.ts', {
    '@/lib/prisma': prisma,
    '@/lib/mobile-api/bowler-hidden': { readRankPoints: () => [] },
  });
  return { service, event, get assignments() { return assignments; } };
}

test('ADJUST_LANES atomically supports occupied-slot swap and move to an empty configured slot', async () => {
  const harness = laneAdjustmentHarness();
  const result = await harness.service.updateTeamCompetition('user-1', 'team-1', 'event-adjust', {
    action: 'ADJUST_LANES', assignments: [
      { participantId: 'participant-1', slotId: 'slot-2' },
      { participantId: 'participant-2', slotId: 'slot-1' },
      { participantId: 'participant-3', slotId: 'slot-4' },
    ],
  });
  assert.equal(result.status, 'LANES_ASSIGNED');
  assert.deepEqual(harness.assignments.map(item => [item.memberId, item.slotId]), [
    ['member-1', 'slot-2'], ['member-2', 'slot-1'], ['member-3', 'slot-4'],
  ]);
  assert.equal(harness.event.competitionStatus, 'LANES_ASSIGNED');
});

test('ADJUST_LANES validates complete current participants and event-owned unique slots', async () => {
  const invalidCases = [
    {
      assignments: [
        { participantId: 'participant-1', slotId: 'slot-1' },
        { participantId: 'participant-2', slotId: 'slot-1' },
        { participantId: 'participant-3', slotId: 'slot-3' },
      ], code: 'DUPLICATE_LANE_SLOT',
    },
    {
      assignments: [
        { participantId: 'participant-1', slotId: 'slot-1' },
        { participantId: 'participant-2', slotId: 'slot-2' },
      ], code: 'INVALID_LANE_ASSIGNMENTS',
    },
    {
      assignments: [
        { participantId: 'participant-1', slotId: 'slot-1' },
        { participantId: 'participant-2', slotId: 'slot-2' },
        { participantId: 'participant-other-event', slotId: 'slot-3' },
      ], code: 'INVALID_LANE_ASSIGNMENTS',
    },
    {
      assignments: [
        { participantId: 'participant-1', slotId: 'slot-1' },
        { participantId: 'participant-2', slotId: 'slot-2' },
        { participantId: 'participant-3', slotId: 'slot-other-event' },
      ], code: 'INVALID_LANE_SLOT',
    },
  ];
  for (const item of invalidCases) {
    const harness = laneAdjustmentHarness();
    await assert.rejects(
      harness.service.updateTeamCompetition('user-1', 'team-1', 'event-adjust', { action: 'ADJUST_LANES', assignments: item.assignments }),
      error => error.code === item.code,
    );
    assert.equal(harness.assignments.length, 3);
  }
});

test('ADJUST_LANES rejects member actors, score-started and published events', async () => {
  const assignments = [
    { participantId: 'participant-1', slotId: 'slot-1' },
    { participantId: 'participant-2', slotId: 'slot-2' },
    { participantId: 'participant-3', slotId: 'slot-3' },
  ];
  await assert.rejects(
    laneAdjustmentHarness().service.updateTeamCompetition('user-2', 'team-1', 'event-adjust', { action: 'ADJUST_LANES', assignments }),
    error => error.code === 'FORBIDDEN',
  );
  await assert.rejects(
    laneAdjustmentHarness({ scoreCount: 1 }).service.updateTeamCompetition('user-1', 'team-1', 'event-adjust', { action: 'ADJUST_LANES', assignments }),
    error => error.code === 'COMPETITION_SCORE_STARTED' && error.message === '이미 경기 점수가 입력되어 레인 배정을 변경할 수 없습니다.',
  );
  await assert.rejects(
    laneAdjustmentHarness({ status: 'PUBLISHED' }).service.updateTeamCompetition('user-1', 'team-1', 'event-adjust', { action: 'ADJUST_LANES', assignments }),
    error => error.code === 'COMPETITION_PUBLISHED',
  );
});

test('ADJUST_LANES rolls the full assignment snapshot back when recreation fails', async () => {
  const harness = laneAdjustmentHarness({ failCreateAt: 2 });
  const original = harness.assignments.map(item => ({ ...item }));
  await assert.rejects(
    harness.service.updateTeamCompetition('user-1', 'team-1', 'event-adjust', {
      action: 'ADJUST_LANES', assignments: [
        { participantId: 'participant-1', slotId: 'slot-2' },
        { participantId: 'participant-2', slotId: 'slot-1' },
        { participantId: 'participant-3', slotId: 'slot-4' },
      ],
    }),
    /synthetic create failure/,
  );
  assert.deepEqual(harness.assignments, original);
});

test('team results drop each larger team game lowest score and are recalculated from source rows', async () => {
  const fixture = eventFixture();
  let scoreQueries = 0;
  const prisma = {
    teamSeason: { findFirst: async () => ({
      status: 'ACTIVE', startDate: new Date('2026-01-01T00:00:00+09:00'),
      endDate: new Date('2026-12-31T23:59:59+09:00'),
      individualPointsConfig: '{}', teamPointsConfig: '{"1":35,"2":20}', eventPointsConfig: '{}',
    }) },
    teamEvent: { findFirst: async () => fixture.event },
    score: { findMany: async () => { scoreQueries += 1; return fixture.scores; } },
  };
  const service = loadTs('src/lib/mobile-api/team-competition.ts', {
    '@/lib/prisma': prisma,
    '@/lib/mobile-api/bowler-hidden': { readRankPoints: () => [{ rank: 1, points: 5 }, { rank: 2, points: 3 }] },
  });
  const result = await service.getTeamCompetitionState('user-1', 'team-1', 'event-1');
  assert.equal(scoreQueries, 1);
  assert.equal(result.results.effectivePlayerCount, 2);
  assert.deepEqual(result.results.games[0].teams.map(team => ({
    team: team.teamName, raw: team.rawTeamTotal, excluded: team.excludedScores,
    normalized: team.normalizedTeamTotal, rank: team.rank, points: team.points,
  })), [
    { team: 'TEAM 1', raw: 520, excluded: [100], normalized: 420, rank: 1, points: 5 },
    { team: 'TEAM 2', raw: 350, excluded: [], normalized: 350, rank: 2, points: 3 },
  ]);
  assert.equal(result.results.complete, true);
  assert.equal(result.results.teams[0].totalPoints, 10);
  assert.equal(result.policies.teamHandicapApplication, 'EFFECTIVE_PIN_PLUS_TEAM_HANDICAP_PER_GAME');
  assert.equal(JSON.stringify(result).includes('user-'), false);
});

test('5/5/5/4 scoring excludes each game own lowest player and accumulates game points', async () => {
  const sizes = [5, 5, 5, 4];
  const scoreMatrix = [
    [[200, 100], [190, 190], [180, 180], [170, 170], [100, 220]],
    [[180, 180], [179, 179], [178, 178], [177, 177], [90, 90]],
    [[160, 160], [159, 159], [158, 158], [157, 157], [80, 80]],
    [[150, 150], [149, 149], [148, 148], [147, 147]],
  ];
  let memberNumber = 1;
  const teams = [];
  const participants = [];
  const members = [];
  const scores = [];
  for (let teamIndex = 0; teamIndex < sizes.length; teamIndex += 1) {
    const teamParticipants = [];
    for (let index = 0; index < sizes[teamIndex]; index += 1) {
      const current = member(memberNumber);
      const participant = {
        id: `participant-${memberNumber}`, eventId: 'event-exact-score', generation: 1,
        memberId: current.id, competitionTeamId: `team-${teamIndex + 1}`,
        assignmentType: index === 0 ? 'CAPTAIN' : 'DRAFT', assignmentOrder: index,
        member: current,
      };
      members.push(current); participants.push(participant); teamParticipants.push(participant);
      scoreMatrix[teamIndex][index].forEach((scoreValue, gameIndex) => scores.push({
        id: `score-${memberNumber}-${gameIndex + 1}`, userId: current.userId, score: scoreValue,
      }));
      memberNumber += 1;
    }
    teams.push({
      id: `team-${teamIndex + 1}`, generation: 1, name: `TEAM ${teamIndex + 1}`,
      draftOrder: teamIndex + 1, lanePriority: null, teamHandicap: teamIndex * 5,
      captainMemberId: teamParticipants[0].memberId, captain: teamParticipants[0].member,
      participants: teamParticipants,
    });
  }
  const guestParticipant = participants.at(-1);
  const guestUserId = guestParticipant.member.userId;
  guestParticipant.memberId = null; guestParticipant.guestId = 'guest-score';
  guestParticipant.guest = { id: 'guest-score', name: '게스트점수' }; guestParticipant.member = null;
  scores.filter(row => row.userId === guestUserId).forEach(row => {
    row.userId = null; row.teamEventGuestId = 'guest-score'; row.guestName = '게스트점수';
  });
  const event = {
    id: 'event-exact-score', teamId: 'team-1', eventDate: new Date('2026-09-22T00:00:00+09:00'),
    gameType: '정기전', competitionEnabled: true, competitionType: 'TEAM', competitionStatus: 'TEAMS_FINALIZED',
    draftGeneration: 1, currentPickNumber: 13, competitionGameCount: 2,
    rankPoints: JSON.stringify({ version: 2, games: [
      { gameNumber: 1, points: { 1: 5, 2: 3, 3: 2, 4: 1 } },
      { gameNumber: 2, points: { 1: 6, 2: 4, 3: 2, 4: 1 } },
    ] }),
    team: { ownerId: 'user-1', bowlerHiddenEnabled: true, User: [], members },
    attendances: members.filter(item => item.userId !== guestUserId).map(item => ({ status: 'ATTENDING', member: item })),
    guests: [{ id: 'guest-score', name: '게스트점수' }],
    competitionTeams: teams, competitionParticipants: participants,
    competitionDraftPicks: [], laneSlots: [], laneAssignments: [], seasonPublications: [],
  };
  const service = loadTs('src/lib/mobile-api/team-competition.ts', {
    '@/lib/prisma': {
      teamEvent: { findFirst: async () => event },
      teamSeason: { findFirst: async () => ({
        individualPointsConfig: '{}', teamPointsConfig: '{}', eventPointsConfig: '{}',
      }) },
      score: { findMany: async () => scores },
    },
    '@/lib/mobile-api/bowler-hidden': {
      readRankPoints: value => Object.entries(JSON.parse(value)).map(([rank, points]) => ({ rank: Number(rank), points })),
      parseRankPoints: value => value.map(item => ({ rank: item.rank, points: item.points })),
      serializeRankPoints: value => JSON.stringify(Object.fromEntries(value.map(item => [item.rank, item.points]))),
    },
  });
  const result = await service.getTeamCompetitionState('user-1', 'team-1', event.id);
  assert.equal(result.results.effectivePlayerCount, 4);
  assert.deepEqual(result.results.games.map(game => game.teams.map(team => ({
    id: team.teamId, raw: team.rawTeamTotal, normalized: team.normalizedTeamTotal,
    handicap: team.teamHandicap, applied: team.handicapAppliedTotal,
    excluded: team.excludedScores, rank: team.rank, points: team.points,
  }))), [
    [
      { id: 'team-1', raw: 840, normalized: 740, handicap: 0, applied: 740, excluded: [100], rank: 1, points: 5 },
      { id: 'team-2', raw: 804, normalized: 714, handicap: 5, applied: 719, excluded: [90], rank: 2, points: 3 },
      { id: 'team-3', raw: 714, normalized: 634, handicap: 10, applied: 644, excluded: [80], rank: 3, points: 2 },
      { id: 'team-4', raw: 594, normalized: 594, handicap: 15, applied: 609, excluded: [], rank: 4, points: 1 },
    ],
    [
      { id: 'team-1', raw: 860, normalized: 760, handicap: 0, applied: 760, excluded: [100], rank: 1, points: 6 },
      { id: 'team-2', raw: 804, normalized: 714, handicap: 5, applied: 719, excluded: [90], rank: 2, points: 4 },
      { id: 'team-3', raw: 714, normalized: 634, handicap: 10, applied: 644, excluded: [80], rank: 3, points: 2 },
      { id: 'team-4', raw: 594, normalized: 594, handicap: 15, applied: 609, excluded: [], rank: 4, points: 1 },
    ],
  ]);
  assert.deepEqual(result.results.teams.map(team => ({ id: team.competitionTeamId, points: team.totalPoints, rank: team.finalRank })), [
    { id: 'team-1', points: 11, rank: 1 },
    { id: 'team-2', points: 7, rank: 2 },
    { id: 'team-3', points: 4, rank: 3 },
    { id: 'team-4', points: 2, rank: 4 },
  ]);
  assert.deepEqual(result.results.teams.map(team => ({ id: team.competitionTeamId, effective: team.effectivePins, applied: team.appliedPins })), [
    { id: 'team-1', effective: 1500, applied: 1500 },
    { id: 'team-2', effective: 1428, applied: 1438 },
    { id: 'team-3', effective: 1268, applied: 1288 },
    { id: 'team-4', effective: 1188, applied: 1218 },
  ]);
  assert.deepEqual(scoreMatrix[0][4], [100, 220]);
  assert.deepEqual(scoreMatrix[0][0], [200, 100]);
});

test('fixed team tie-break uses points, effective pins, member count, handicap, then stable id', () => {
  const service = loadTs('src/lib/mobile-api/team-competition.ts', {
    '@/lib/prisma': {}, '@/lib/mobile-api/bowler-hidden': { readRankPoints: () => [] },
  });
  const base = { totalPoints: 10, effectivePins: 1000, memberCount: 5, teamHandicap: 20 };
  assert.deepEqual(service.rankFinalTeams([
    { ...base, competitionTeamId: 'B', effectivePins: 1001 },
    { ...base, competitionTeamId: 'A' },
  ]).map(item => item.competitionTeamId), ['B', 'A']);
  assert.deepEqual(service.rankFinalTeams([
    { ...base, competitionTeamId: 'B', memberCount: 4 },
    { ...base, competitionTeamId: 'A' },
  ]).map(item => item.competitionTeamId), ['B', 'A']);
  assert.deepEqual(service.rankFinalTeams([
    { ...base, competitionTeamId: 'B', teamHandicap: 10 },
    { ...base, competitionTeamId: 'A' },
  ]).map(item => item.competitionTeamId), ['B', 'A']);
  assert.deepEqual(service.rankFinalTeams([
    { ...base, competitionTeamId: 'B' },
    { ...base, competitionTeamId: 'A' },
  ]).map(item => item.competitionTeamId), ['A', 'B']);
});

test('missing score never becomes zero and prevents the affected game ranking', async () => {
  const fixture = eventFixture({ incomplete: true });
  const service = loadTs('src/lib/mobile-api/team-competition.ts', {
    '@/lib/prisma': {
      teamEvent: { findFirst: async () => fixture.event },
      score: { findMany: async () => fixture.scores },
    },
    '@/lib/mobile-api/bowler-hidden': { readRankPoints: () => [{ rank: 1, points: 5 }, { rank: 2, points: 3 }] },
  });
  const result = await service.getTeamCompetitionState('user-1', 'team-1', 'event-1');
  assert.equal(result.results.complete, false);
  assert.equal(result.results.games[1].complete, false);
  const missingTeam = result.results.games[1].teams.find(team => team.teamId === 'competition-team-2');
  assert.equal(missingTeam.rawTeamTotal, null);
  assert.equal(missingTeam.rank, null);
  assert.equal(result.results.teams.every(team => team.finalRank === null), true);
});

test('feature flag and manager permissions are rechecked by team competition actions', async () => {
  const fixture = eventFixture();
  fixture.event.competitionStatus = 'ATTENDANCE_OPEN';
  let updates = 0;
  const prisma = {
    teamEvent: {
      findFirst: async () => fixture.event,
      update: async () => { updates += 1; return {}; },
    },
  };
  let service = loadTs('src/lib/mobile-api/team-competition.ts', {
    '@/lib/prisma': prisma,
    '@/lib/mobile-api/bowler-hidden': { readRankPoints: () => [] },
  });
  await assert.rejects(
    () => service.updateTeamCompetition('user-4', 'team-1', 'event-1', { action: 'LOCK_ATTENDANCE' }),
    error => error.code === 'FORBIDDEN' && error.status === 403,
  );
  assert.equal(updates, 0);

  fixture.event.team.bowlerHiddenEnabled = false;
  service = loadTs('src/lib/mobile-api/team-competition.ts', {
    '@/lib/prisma': prisma,
    '@/lib/mobile-api/bowler-hidden': { readRankPoints: () => [] },
  });
  await assert.rejects(
    () => service.getTeamCompetitionState('user-1', 'team-1', 'event-1'),
    error => error.code === 'FEATURE_DISABLED' && error.status === 404,
  );
});

test('team handicap is manager-only, non-negative, and scoped to the current event generation', async () => {
  const fixture = eventFixture();
  let updateArgs = null;
  const prisma = {
    teamEvent: { findFirst: async () => fixture.event },
    teamCompetitionTeam: { updateMany: async args => { updateArgs = args; return { count: 1 }; } },
  };
  const service = loadTs('src/lib/mobile-api/team-competition.ts', {
    '@/lib/prisma': prisma, '@/lib/mobile-api/bowler-hidden': { readRankPoints: () => [] },
  });
  await service.updateTeamCompetition('user-1', 'team-1', 'event-1', {
    action: 'SET_HANDICAP', competitionTeamId: 'competition-team-1', teamHandicap: 12,
  });
  assert.deepEqual(updateArgs, {
    where: { id: 'competition-team-1', eventId: 'event-1', generation: 1 }, data: { teamHandicap: 12 },
  });
  await assert.rejects(() => service.updateTeamCompetition('user-4', 'team-1', 'event-1', {
    action: 'SET_HANDICAP', competitionTeamId: 'competition-team-1', teamHandicap: 12,
  }), error => error.code === 'FORBIDDEN');
  await assert.rejects(() => service.updateTeamCompetition('user-1', 'team-1', 'event-1', {
    action: 'SET_HANDICAP', competitionTeamId: 'competition-team-1', teamHandicap: -1,
  }), error => error.code === 'INVALID_TEAM_HANDICAP');
});

function lateParticipantHarness({ status = 'ATTENDANCE_LOCKED', scoreCount = 0, failClaim = false } = {}) {
  const members = [1, 2, 3].map(member);
  const event = {
    id: 'event-late', teamId: 'team-1', title: '늦은 참가자 테스트',
    competitionEnabled: true, competitionType: 'TEAM', competitionStatus: status,
    draftGeneration: 4, currentPickNumber: 3,
    laneDrawStatus: status === 'LANES_ASSIGNED' ? 'COMPLETED' : 'NOT_STARTED',
    team: { ownerId: 'user-1', bowlerHiddenEnabled: true, User: [], members },
    attendances: [
      { memberId: 'member-1', memberDisplayName: '회원1', status: 'ATTENDING', member: members[0] },
      { memberId: 'member-2', memberDisplayName: '회원2', status: 'NOT_ATTENDING', member: members[1] },
    ],
    guests: [],
    competitionTeams: [{ id: 'old-team', generation: 4 }],
    competitionParticipants: [{ id: 'old-participant', generation: 4, memberId: 'member-1' }],
    competitionDraftPicks: [{ id: 'old-pick', generation: 4 }],
    laneSlots: [{ id: 'slot-1', laneNumber: 1, position: 1 }],
    laneAssignments: [{ id: 'assignment-1', eventId: 'event-late' }],
    seasonPublications: [{ id: 'finance-snapshot', resultSnapshot: '{}' }],
  };
  const calls = { deletedAssignments: 0, scoreCounts: 0, updateArgs: null };
  let nextGuest = 1;
  const prisma = {
    teamEvent: {
      findFirst: async args => args.where.id === event.id && args.where.teamId === event.teamId ? event : null,
      updateMany: async args => {
        calls.updateArgs = args;
        if (failClaim || args.where.draftGeneration !== event.draftGeneration ||
            args.where.competitionStatus !== event.competitionStatus ||
            args.where.laneDrawStatus !== event.laneDrawStatus) return { count: 0 };
        if (args.data.draftGeneration?.increment) event.draftGeneration += args.data.draftGeneration.increment;
        if (typeof args.data.currentPickNumber === 'number') event.currentPickNumber = args.data.currentPickNumber;
        if (args.data.competitionStatus) event.competitionStatus = args.data.competitionStatus;
        if (args.data.laneDrawStatus) event.laneDrawStatus = args.data.laneDrawStatus;
        return { count: 1 };
      },
    },
    score: { count: async () => { calls.scoreCounts += 1; return scoreCount; } },
    teamEventAttendance: { upsert: async args => {
      const existing = event.attendances.find(item => item.memberId === args.where.eventId_memberId.memberId);
      if (existing) Object.assign(existing, args.update);
      else event.attendances.push({ ...args.create, member: members.find(item => item.id === args.create.memberId) });
      return existing ?? event.attendances.at(-1);
    } },
    teamEventGuest: { create: async args => {
      const guest = { id: `late-guest-${nextGuest++}`, ...args.data };
      event.guests.push(guest); return guest;
    } },
    teamEventLaneAssignment: { deleteMany: async () => {
      calls.deletedAssignments += event.laneAssignments.length;
      event.laneAssignments = []; return { count: calls.deletedAssignments };
    } },
  };
  prisma.$transaction = async callback => {
    const snapshot = structuredClone(event);
    try { return await callback(prisma); }
    catch (error) { Object.assign(event, snapshot); throw error; }
  };
  const service = loadTs('src/lib/mobile-api/team-competition.ts', {
    '@/lib/prisma': prisma, '@/lib/mobile-api/bowler-hidden': { readRankPoints: () => [] },
  });
  return { event, calls, service };
}

test('late member can be added after attendance lock without resetting the draft generation', async () => {
  const { event, calls, service } = lateParticipantHarness();
  const result = await service.updateTeamCompetition('user-1', 'team-1', event.id, {
    action: 'ADD_LATE_PARTICIPANT', participantKind: 'MEMBER', memberId: 'member-2',
  });
  assert.deepEqual(result, {
    status: 'ATTENDANCE_LOCKED', generation: 4, participantKind: 'MEMBER',
    participantId: 'member-2', draftReset: false,
  });
  assert.equal(event.attendances.find(item => item.memberId === 'member-2').status, 'ATTENDING');
  assert.equal(event.draftGeneration, 4);
  assert.equal(calls.deletedAssignments, 0);
  assert.deepEqual(calls.updateArgs.where, {
    id: event.id, teamId: 'team-1', draftGeneration: 4,
    competitionStatus: 'ATTENDANCE_LOCKED', laneDrawStatus: 'NOT_STARTED',
  });
});

test('late guest resets active draft and lane state while preserving prior generations and snapshots', async () => {
  const { event, calls, service } = lateParticipantHarness({ status: 'LANES_ASSIGNED' });
  const oldRows = {
    teams: [...event.competitionTeams], participants: [...event.competitionParticipants],
    picks: [...event.competitionDraftPicks], slots: [...event.laneSlots], publications: [...event.seasonPublications],
  };
  let result = await service.updateTeamCompetition('user-1', 'team-1', event.id, {
    action: 'ADD_LATE_PARTICIPANT', participantKind: 'GUEST', guestName: '  같은 이름  ',
  });
  assert.equal(result.draftReset, true);
  assert.equal(event.competitionStatus, 'ATTENDANCE_LOCKED');
  assert.equal(event.draftGeneration, 5);
  assert.equal(event.currentPickNumber, 1);
  assert.equal(event.laneDrawStatus, 'NOT_STARTED');
  assert.equal(calls.deletedAssignments, 1);
  assert.deepEqual(event.competitionTeams, oldRows.teams);
  assert.deepEqual(event.competitionParticipants, oldRows.participants);
  assert.deepEqual(event.competitionDraftPicks, oldRows.picks);
  assert.deepEqual(event.laneSlots, oldRows.slots);
  assert.deepEqual(event.seasonPublications, oldRows.publications);

  result = await service.updateTeamCompetition('user-1', 'team-1', event.id, {
    action: 'ADD_LATE_PARTICIPANT', participantKind: 'GUEST', guestName: '같은 이름',
  });
  assert.equal(result.draftReset, false);
  assert.equal(event.guests.length, 2);
  assert.equal(new Set(event.guests.map(item => item.id)).size, 2);
});

test('every active draft phase returns to a clean new generation after late member add', async () => {
  for (const status of ['DRAFT_READY', 'DRAFT_IN_PROGRESS', 'LUCKY_DRAW', 'TEAMS_FINALIZED']) {
    const { event, service } = lateParticipantHarness({ status });
    const result = await service.updateTeamCompetition('user-1', 'team-1', event.id, {
      action: 'ADD_LATE_PARTICIPANT', participantKind: 'MEMBER', memberId: 'member-2',
    });
    assert.equal(result.draftReset, true, status);
    assert.equal(event.draftGeneration, 5, status);
    assert.equal(event.currentPickNumber, 1, status);
    assert.equal(event.competitionStatus, 'ATTENDANCE_LOCKED', status);
    assert.equal(event.competitionParticipants.length, 1, status);
    assert.equal(event.competitionTeams.length, 1, status);
    assert.equal(event.competitionDraftPicks.length, 1, status);
  }
});

test('late participant rejects duplicates, cross-team members and team-assignment payloads', async () => {
  const { event, service } = lateParticipantHarness();
  await assert.rejects(() => service.updateTeamCompetition('user-1', 'team-1', event.id, {
    action: 'ADD_LATE_PARTICIPANT', participantKind: 'MEMBER', memberId: 'member-1',
  }), error => error.code === 'ALREADY_PARTICIPATING');
  await assert.rejects(() => service.updateTeamCompetition('user-1', 'team-1', event.id, {
    action: 'ADD_LATE_PARTICIPANT', participantKind: 'MEMBER', memberId: 'other-team-member',
  }), error => error.code === 'MEMBER_NOT_FOUND');
  await assert.rejects(() => service.updateTeamCompetition('user-1', 'team-1', event.id, {
    action: 'ADD_LATE_PARTICIPANT', participantKind: 'MEMBER', memberId: 'member-2', competitionTeamId: 'old-team',
  }), error => error.code === 'INVALID_REQUEST');
  await assert.rejects(() => service.updateTeamCompetition('user-3', 'team-1', event.id, {
    action: 'ADD_LATE_PARTICIPANT', participantKind: 'MEMBER', memberId: 'member-2',
  }), error => error.code === 'FORBIDDEN');
});

test('late participant is blocked after score entry or publication, and conflicts roll back writes', async () => {
  let harness = lateParticipantHarness({ status: 'LANES_ASSIGNED', scoreCount: 1 });
  await assert.rejects(() => harness.service.updateTeamCompetition('user-1', 'team-1', harness.event.id, {
    action: 'ADD_LATE_PARTICIPANT', participantKind: 'GUEST', guestName: '게스트',
  }), error => error.code === 'COMPETITION_SCORE_STARTED');
  assert.equal(harness.event.guests.length, 0);
  assert.equal(harness.event.laneAssignments.length, 1);

  harness = lateParticipantHarness({ status: 'PUBLISHED' });
  await assert.rejects(() => harness.service.updateTeamCompetition('user-1', 'team-1', harness.event.id, {
    action: 'ADD_LATE_PARTICIPANT', participantKind: 'GUEST', guestName: '게스트',
  }), error => error.code === 'COMPETITION_PUBLISHED');
  assert.equal(harness.calls.scoreCounts, 0);

  harness = lateParticipantHarness({ status: 'DRAFT_READY', failClaim: true });
  await assert.rejects(() => harness.service.updateTeamCompetition('user-1', 'team-1', harness.event.id, {
    action: 'ADD_LATE_PARTICIPANT', participantKind: 'GUEST', guestName: '게스트',
  }), error => error.code === 'LATE_PARTICIPANT_CONFLICT');
  assert.equal(harness.event.guests.length, 0);
  assert.equal(harness.event.laneAssignments.length, 1);
  assert.equal(harness.event.draftGeneration, 4);
});

test('migration keeps reset generations and conflict-prevention uniqueness', () => {
  const sql = fs.readFileSync(path.resolve(__dirname,
    '../prisma/migrations/20260922210000_add_bowler_hidden_competitions/migration.sql'), 'utf8');
  assert.match(sql, /draftGeneration[^\n]*DEFAULT 1/i);
  assert.match(sql, /TeamCompetitionDraftPick_event_generation_pick_key/);
  assert.match(sql, /TeamCompetitionParticipant_event_generation_member_key/);
  assert.match(sql, /TeamCompetitionTeam_event_generation_order_key/);
  assert.doesNotMatch(sql, /DROP TABLE|DELETE FROM/i);
});

test('team competition route authenticates and keeps actor/team/event scope', async () => {
  let getCall = null;
  let postCall = null;
  class FakeError extends Error {}
  const route = loadTs('src/app/api/mobile/v1/teams/[teamId]/events/[eventId]/competition/team/route.ts', {
    '@/lib/mobile-api/auth': { getMobileApiUserId: async request => request.headers.get('x-user') },
    '@/lib/mobile-api/team-competition': {
      TeamCompetitionError: FakeError,
      getTeamCompetitionState: async (userId, teamId, eventId) => {
        getCall = { userId, teamId, eventId }; return { status: 'ATTENDANCE_OPEN' };
      },
      updateTeamCompetition: async (userId, teamId, eventId, body) => {
        postCall = { userId, teamId, eventId, body }; return { status: 'ATTENDANCE_LOCKED' };
      },
    },
  });
  const context = { params: Promise.resolve({ teamId: 'team-1', eventId: 'event-1' }) };
  assert.equal((await route.GET(new Request('https://example.test'), context)).status, 401);
  const headers = { 'content-type': 'application/json', 'x-user': 'user-1' };
  assert.equal((await route.GET(new Request('https://example.test', { headers }), context)).status, 200);
  assert.deepEqual(getCall, { userId: 'user-1', teamId: 'team-1', eventId: 'event-1' });
  const response = await route.POST(new Request('https://example.test', {
    method: 'POST', headers, body: JSON.stringify({ action: 'LOCK_ATTENDANCE' }),
  }), context);
  assert.equal(response.status, 200);
  assert.deepEqual(postCall, {
    userId: 'user-1', teamId: 'team-1', eventId: 'event-1', body: { action: 'LOCK_ATTENDANCE' },
  });
});
