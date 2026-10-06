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

function createHarness({ competitionMode = 'OFFICIAL', teamSizes = [2, 2, 2, 2] } = {}) {
  const participantCount = teamSizes.reduce((sum, size) => sum + size, 0);
  const teamIndexByParticipant = teamSizes.flatMap((size, teamIndex) => Array(size).fill(teamIndex));
  const firstParticipantByTeam = teamSizes.map((_, teamIndex) =>
    teamSizes.slice(0, teamIndex).reduce((sum, size) => sum + size, 0));
  const members = Array.from({ length: participantCount }, (_, index) => ({
    id: `member-${index + 1}`,
    userId: `user-${index + 1}`,
    alias: null,
    user: { name: `회원${index + 1}` },
  }));
  const participants = members.map((member, index) => ({
    id: `participant-${index + 1}`,
    eventId: 'event-team-score',
    generation: 1,
    memberId: member.id,
    guestId: null,
    competitionTeamId: `competition-team-${teamIndexByParticipant[index] + 1}`,
    assignmentType: firstParticipantByTeam.includes(index) ? 'CAPTAIN' : index === 1 ? 'ADMIN_OVERRIDE' : 'DRAFT',
    assignmentOrder: index - firstParticipantByTeam[teamIndexByParticipant[index]],
    member,
    guest: null,
  }));
  const competitionTeams = teamSizes.map((size, index) => ({
    id: `competition-team-${index + 1}`,
    eventId: 'event-team-score',
    generation: 1,
    name: `TEAM ${index + 1}`,
    draftOrder: index + 1,
    lanePriority: index + 1,
    teamHandicap: 0,
    captainMemberId: members[firstParticipantByTeam[index]].id,
    captain: members[firstParticipantByTeam[index]],
    participants: participants.slice(firstParticipantByTeam[index], firstParticipantByTeam[index] + size),
  }));
  const laneSlots = participants.map((_, index) => ({
    id: `slot-${index + 1}`,
    eventId: 'event-team-score',
    laneNumber: 8 + Math.floor(index / 2),
    position: index % 2 + 1,
  }));
  const laneAssignments = participants.map((participant, index) => ({
    id: `assignment-${index + 1}`,
    eventId: 'event-team-score',
    slotId: laneSlots[index].id,
    memberId: participant.memberId,
    guestId: null,
    participantKind: 'MEMBER',
    participantDisplayName: participant.member.user.name,
    slot: laneSlots[index],
  }));
  const event = {
    id: 'event-team-score',
    teamId: 'team-1',
    createdById: 'user-1',
    title: 'TEAM 4게임 회귀',
    eventDate: new Date('2026-10-06T10:00:00+09:00'),
    eventTime: '10:00',
    location: '테스트 볼링장',
    gameType: '정기전',
    competitionEnabled: true,
    competitionType: 'TEAM',
    competitionMode,
    competitionStatus: 'LANES_ASSIGNED',
    competitionGameCount: 4,
    draftGeneration: 1,
    currentPickNumber: 5,
    laneDrawStatus: 'COMPLETED',
    rankPoints: JSON.stringify({ version: 2, games: [
      { gameNumber: 1, points: { 1: 5, 2: 3, 3: 2, 4: 1 } },
      { gameNumber: 2, points: { 1: 5, 2: 3, 3: 2, 4: 1 } },
      { gameNumber: 3, points: { 1: 5, 2: 3, 3: 2, 4: 1 } },
      { gameNumber: 4, points: { 1: 6, 2: 4, 3: 2, 4: 1 } },
    ] }),
    seasonId: 'season-1',
    seasonPublicationRevision: 0,
    team: {
      name: '테스트팀', ownerId: 'user-1', bowlerHiddenEnabled: true,
      User: [], members,
    },
    attendances: members.map((member, index) => ({
      id: `attendance-${index + 1}`,
      memberId: member.id,
      memberDisplayName: member.user.name,
      status: 'ATTENDING',
      createdAt: new Date(`2026-10-01T00:00:0${index}Z`),
      member,
    })),
    guests: [],
    competitionTeams,
    competitionParticipants: participants,
    eventCompetitionParticipants: [],
    competitionDraftPicks: [],
    laneSlots,
    laneAssignments,
    seasonPublications: [],
    scores: [],
  };
  const scoreRows = [];
  const seasonPublications = event.seasonPublications;
  const seasonPointEntries = [];
  let scoreReadCount = 0;
  const prisma = {
    teamEvent: {
      findFirst: async () => event,
      updateMany: async ({ where, data }) => {
        if (where.competitionStatus !== event.competitionStatus &&
            !(where.competitionStatus?.in?.includes(event.competitionStatus))) return { count: 0 };
        if (data.competitionStatus) event.competitionStatus = data.competitionStatus;
        if (data.seasonPublicationRevision?.increment) {
          event.seasonPublicationRevision += data.seasonPublicationRevision.increment;
        }
        return { count: 1 };
      },
    },
    teamSeason: { findFirst: async () => ({
      id: 'season-1', teamId: 'team-1', status: 'ACTIVE', rankingMode: 'DATA',
      startDate: new Date('2026-01-01T00:00:00+09:00'),
      endDate: new Date('2026-12-31T23:59:59+09:00'),
      individualPointsConfig: '{}', teamPointsConfig: '{"1":35,"2":20,"3":10,"4":5}', eventPointsConfig: '{}',
    }) },
    score: {
      deleteMany: async () => { const count = scoreRows.length; scoreRows.length = 0; event.scores = []; return { count }; },
      createMany: async ({ data }) => { scoreRows.push(...data); event.scores = scoreRows; return { count: data.length }; },
      findMany: async () => { scoreReadCount += 1; return scoreRows; },
    },
    seasonPointPublication: {
      findFirst: async () => seasonPublications.find(item => !item.revokedAt) ?? null,
      create: async ({ data }) => {
        const publication = { id: `publication-${seasonPublications.length + 1}`, ...data, revokedAt: null };
        seasonPublications.push(publication);
        return { id: publication.id };
      },
      updateMany: async ({ data }) => {
        const active = seasonPublications.filter(item => !item.revokedAt);
        active.forEach(item => { item.revokedAt = data.revokedAt; });
        return { count: active.length };
      },
    },
    seasonPointEntry: {
      createMany: async ({ data }) => { seasonPointEntries.push(...data); return { count: data.length }; },
    },
  };
  prisma.$transaction = async callback => callback(prisma);
  const overrides = {
    '@/lib/prisma': prisma,
    '@/lib/mobile-api/notifications': { enqueueMobileNotifications: async () => {}, MOBILE_NOTIFICATION_TYPES: {} },
    '@/lib/mobile-api/event-admin-audit': { recordEventAdminAudit: async () => {} },
  };
  const cache = new Map();
  const scoreService = loadTs('src/lib/mobile-api/competition-scores.ts', overrides, cache);
  const teamService = loadTs('src/lib/mobile-api/team-competition.ts', overrides, cache);
  const auth = { getMobileApiUserId: async request => request.headers.get('x-user') };
  const scoreRoute = loadTs('src/app/api/mobile/v1/teams/[teamId]/events/[eventId]/scores/route.ts', {
    '@/lib/mobile-api/auth': auth,
    '@/lib/mobile-api/competition-scores': {
      CompetitionScoreError: scoreService.CompetitionScoreError,
      getCompetitionScoreEntry: scoreService.getCompetitionScoreEntry,
      saveCompetitionScores: scoreService.saveCompetitionScores,
    },
  });
  const teamRoute = loadTs('src/app/api/mobile/v1/teams/[teamId]/events/[eventId]/competition/team/route.ts', {
    '@/lib/mobile-api/auth': auth,
    '@/lib/mobile-api/team-competition': {
      TeamCompetitionError: teamService.TeamCompetitionError,
      getTeamCompetitionState: teamService.getTeamCompetitionState,
      updateTeamCompetition: teamService.updateTeamCompetition,
    },
    '@/lib/mobile-api/unified-season': { UnifiedSeasonError: class UnifiedSeasonError extends Error {} },
  });
  const eventRoute = loadTs('src/app/api/mobile/v1/teams/[teamId]/events/[eventId]/route.ts', {
    '@/lib/mobile-api/auth': auth,
    '@/lib/mobile-api/team-events': {
      getTeamEvent: async () => ({ id: event.id, teamId: event.teamId, competitionStatus: event.competitionStatus }),
      updateTeamEvent: async () => assert.fail('not called'),
      deleteTeamEvent: async () => assert.fail('not called'),
    },
    '@/lib/mobile-api/team-events-response': {
      readJson: async () => ({}),
      teamEventErrorResponse: () => Response.json({ success: false }, { status: 500 }),
    },
  });
  return {
    event,
    participants,
    scoreRows,
    seasonPublications,
    seasonPointEntries,
    scoreService,
    teamService,
    scoreRoute,
    teamRoute,
    eventRoute,
    get scoreReadCount() { return scoreReadCount; },
  };
}

test('LANES_ASSIGNED TEAM can load, save complete scores, reload score entry and reload TEAM results without server error', async () => {
  const harness = createHarness();
  const context = { params: Promise.resolve({ teamId: 'team-1', eventId: harness.event.id }) };
  const headers = { 'content-type': 'application/json', 'x-user': 'user-1' };
  let response = await harness.scoreRoute.GET(new Request('https://example.test', { headers }), context);
  assert.equal(response.status, 200);
  const before = (await response.json()).data;
  assert.equal(before.gameCount, 4);
  assert.equal(before.participants.length, 8);
  assert.equal(before.participants.every(item => item.scores.length === 0), true);

  const payload = {
    gameCount: 4,
    participants: before.participants.map((participant, participantIndex) => ({
      participantId: participant.participantId,
      scores: Array.from({ length: 4 }, (_, gameIndex) => 120 + participantIndex * 10 + gameIndex),
    })),
  };
  response = await harness.scoreRoute.POST(new Request('https://example.test', {
    method: 'POST', headers, body: JSON.stringify(payload),
  }), context);
  assert.equal(response.status, 200);
  const saved = (await response.json()).data;
  assert.equal(saved.savedCount, 32);
  assert.equal(harness.scoreRows.length, 32);

  response = await harness.scoreRoute.GET(new Request('https://example.test', { headers }), context);
  assert.equal(response.status, 200);
  const reloaded = (await response.json()).data;
  assert.equal(reloaded.participants.every(item => item.scores.length === 4), true);

  response = await harness.teamRoute.GET(new Request('https://example.test', { headers }), context);
  assert.equal(response.status, 200);
  const state = (await response.json()).data;
  assert.equal(state.status, 'LANES_ASSIGNED');
  assert.equal(state.results.complete, true);
  assert.equal(state.results.individual.length, 8);
  assert.equal(state.results.individual.every(item => item.scores.length === 4), true);
  assert.equal(state.results.games.length, 4);
  assert.equal(state.results.games.every(game => game.complete && game.teams.length === 4), true);
  assert.equal(state.results.games.every(game => game.teams.every(team =>
    team.rawTeamTotal !== null && team.rank !== null && team.points !== null)), true);
  assert.equal(state.results.teams.length, 4);
  assert.equal(state.results.teams.every(team => team.finalRankPreview != null), true);
  assert.equal(state.teams[0].members[1].assignmentType, 'DRAFT');

  response = await harness.eventRoute.GET(new Request('https://example.test', { headers }), context);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.event.competitionStatus, 'LANES_ASSIGNED');
});

test('LANES_ASSIGNED TEAM partial scores remain readable and incomplete', async () => {
  const harness = createHarness();
  harness.scoreRows.push({
    id: 'partial-1', score: 200, gameDate: harness.event.eventDate, gameType: harness.event.gameType,
    userId: 'user-1', teamId: 'team-1', memo: harness.event.title, guestName: null,
    competitionMode: 'OFFICIAL', teamEventId: harness.event.id, teamEventGuestId: null,
    createdAt: new Date('2026-10-06T01:00:00Z'),
  });
  harness.event.scores = harness.scoreRows;
  const state = await harness.teamService.getTeamCompetitionState('user-1', 'team-1', harness.event.id);
  assert.equal(state.results.complete, false);
  assert.equal(state.results.games.length, 4);
  assert.equal(state.results.games.every(game => game.complete === false), true);
});

test('published MINI TEAM remains readable without a season publication snapshot and can be reopened', async () => {
  const harness = createHarness({ competitionMode: 'MINI', teamSizes: [5, 5, 4, 4] });
  const context = { params: Promise.resolve({ teamId: 'team-1', eventId: harness.event.id }) };
  const headers = { 'content-type': 'application/json', 'x-user': 'user-1' };

  let response = await harness.scoreRoute.GET(new Request('https://example.test', { headers }), context);
  const entry = (await response.json()).data;
  const payload = {
    gameCount: 4,
    participants: entry.participants.map((participant, participantIndex) => ({
      participantId: participant.participantId,
      scores: Array.from({ length: 4 }, (_, gameIndex) => 120 + participantIndex * 5 + gameIndex),
    })),
  };
  response = await harness.scoreRoute.POST(new Request('https://example.test', {
    method: 'POST', headers, body: JSON.stringify(payload),
  }), context);
  assert.equal(response.status, 200);
  assert.equal(harness.scoreRows.length, 72);

  response = await harness.teamRoute.GET(new Request('https://example.test', { headers }), context);
  assert.equal(response.status, 200);
  const expectedTeamTotals = (await response.json()).data.results.teams.map(team => ({
    competitionTeamId: team.competitionTeamId,
    totalPoints: team.totalPoints,
  }));

  response = await harness.teamRoute.POST(new Request('https://example.test', {
    method: 'POST', headers, body: JSON.stringify({ action: 'PUBLISH' }),
  }), context);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.publicationId, null);
  assert.equal(harness.event.competitionStatus, 'PUBLISHED');
  assert.deepEqual(harness.event.seasonPublications, []);

  response = await harness.teamRoute.GET(new Request('https://example.test', { headers }), context);
  assert.equal(response.status, 200);
  const state = (await response.json()).data;
  assert.equal(state.status, 'PUBLISHED');
  assert.equal(state.results.complete, true);
  assert.equal(state.results.individual.length, 18);
  assert.equal(state.results.individual.every(item => item.scores.length === 4), true);
  assert.equal(state.results.games.length, 4);
  assert.deepEqual(state.results.teams.map(team => team.finalRank), [1, 2, 3, 4]);
  assert.deepEqual(state.results.teams.map(team => ({
    competitionTeamId: team.competitionTeamId,
    totalPoints: team.totalPoints,
  })), expectedTeamTotals);
  assert.equal(state.results.teams.every(team => team.seasonPoint === 0), true);

  response = await harness.teamRoute.POST(new Request('https://example.test', {
    method: 'POST', headers, body: JSON.stringify({ action: 'REOPEN' }),
  }), context);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.status, 'LANES_ASSIGNED');
  assert.equal(harness.event.competitionStatus, 'LANES_ASSIGNED');
});

test('published OFFICIAL TEAM creates and keeps the season publication snapshot authoritative', async () => {
  const harness = createHarness();
  const context = { params: Promise.resolve({ teamId: 'team-1', eventId: harness.event.id }) };
  const headers = { 'content-type': 'application/json', 'x-user': 'user-1' };
  let response = await harness.scoreRoute.GET(new Request('https://example.test', { headers }), context);
  const entry = (await response.json()).data;
  response = await harness.scoreRoute.POST(new Request('https://example.test', {
    method: 'POST', headers, body: JSON.stringify({
      gameCount: 4,
      participants: entry.participants.map((participant, participantIndex) => ({
        participantId: participant.participantId,
        scores: Array.from({ length: 4 }, (_, gameIndex) => 180 + participantIndex * 5 + gameIndex),
      })),
    }),
  }), context);
  assert.equal(response.status, 200);

  response = await harness.teamRoute.POST(new Request('https://example.test', {
    method: 'POST', headers, body: JSON.stringify({ action: 'PUBLISH' }),
  }), context);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.publicationId, 'publication-1');
  assert.equal(harness.seasonPublications.length, 1);
  assert.equal(harness.seasonPointEntries.length, 8);
  const snapshot = JSON.parse(harness.seasonPublications[0].resultSnapshot);
  assert.deepEqual(snapshot.teams.map(team => team.seasonPoint), [35, 20, 10, 5]);
  const scoreReadsAfterPublish = harness.scoreReadCount;

  harness.scoreRows.forEach(row => { row.score = 0; });
  response = await harness.teamRoute.GET(new Request('https://example.test', { headers }), context);
  assert.equal(response.status, 200);
  const state = (await response.json()).data;
  assert.deepEqual(state.results, snapshot);
  assert.equal(harness.scoreReadCount, scoreReadsAfterPublish);
});

test('published OFFICIAL TEAM without a season publication snapshot remains a server integrity error', async () => {
  const harness = createHarness();
  harness.event.competitionStatus = 'PUBLISHED';
  const context = { params: Promise.resolve({ teamId: 'team-1', eventId: harness.event.id }) };
  const response = await harness.teamRoute.GET(new Request('https://example.test', {
    headers: { 'x-user': 'user-1' },
  }), context);

  assert.equal(response.status, 500);
  const body = await response.json();
  assert.equal(body.error.code, 'INVALID_RESULT_SNAPSHOT');
  assert.equal(harness.scoreReadCount, 0);
});
