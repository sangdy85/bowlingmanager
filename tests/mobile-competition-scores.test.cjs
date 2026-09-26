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
  const module = { exports: {} }; cache.set(filename, module);
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

function event(overrides = {}) {
  return {
    id: 'event-1', teamId: 'team-1', title: '개인전', eventDate: new Date('2026-09-26T00:00:00+09:00'),
    gameType: '정기전', competitionEnabled: true, competitionType: 'INDIVIDUAL', competitionMode: 'OFFICIAL',
    competitionStatus: 'GROUPS_READY', competitionGameCount: 2, draftGeneration: 1,
    team: { ownerId: 'owner', bowlerHiddenEnabled: true, User: [], members: [{ id: 'member-a', userId: 'owner' }] },
    attendances: [{ memberId: 'member-a', memberDisplayName: '회원', manualGroup: 'A', member: { id: 'member-a', userId: 'owner', alias: null, user: { name: '회원' } } }],
    guests: [{ id: 'guest-a', name: '게스트', manualGroup: 'B' }],
    competitionTeams: [], eventCompetitionParticipants: [],
    scores: [
      { id: 's1', userId: 'owner', teamEventGuestId: null, score: 200 },
      { id: 's2', userId: 'owner', teamEventGuestId: null, score: 210 },
      { id: 's3', userId: null, teamEventGuestId: 'guest-a', score: 180 },
      { id: 's4', userId: null, teamEventGuestId: 'guest-a', score: 190 },
    ],
    ...overrides,
  };
}

test('competition score state uses exact event participant snapshot and linked scores', async () => {
  const prisma = { teamEvent: { findFirst: async () => event() } };
  const service = loadTs('src/lib/mobile-api/competition-scores.ts', {
    '@/lib/prisma': prisma,
    '@/lib/mobile-api/bowler-hidden': { getBowlerHiddenCompetition: async () => ({ participantPreview: [
      { participantKind: 'MEMBER', participantId: 'member-a', effectiveGroup: 'A' },
      { participantKind: 'GUEST', participantId: 'guest-a', effectiveGroup: 'B' },
    ] }) },
  });
  const result = await service.getCompetitionScoreEntry('owner', 'team-1', 'event-1');
  assert.equal(result.gameCount, 2);
  assert.deepEqual(result.participants.map(item => item.group), ['A', 'B']);
  assert.deepEqual(result.participants.map(item => [item.participantId, item.scores]), [
    ['member:member-a', [200, 210]], ['guest:guest-a', [180, 190]],
  ]);
});

test('competition score save replaces exact event rows atomically with provenance', async () => {
  const calls = [];
  const tx = {
    teamEvent: { findFirst: async () => event({ scores: [] }) },
    score: {
      deleteMany: async args => { calls.push(['delete', args]); return { count: 0 }; },
      createMany: async args => { calls.push(['create', args]); return { count: args.data.length }; },
    },
  };
  const prisma = { $transaction: async callback => callback(tx) };
  const service = loadTs('src/lib/mobile-api/competition-scores.ts', {
    '@/lib/prisma': prisma,
    '@/lib/mobile-api/bowler-hidden': { getBowlerHiddenCompetition: async () => ({ participantPreview: [] }) },
  });
  const result = await service.saveCompetitionScores('owner', 'team-1', 'event-1', { participants: [
    { participantId: 'member:member-a', scores: [201, 202] },
    { participantId: 'guest:guest-a', scores: [181, 182] },
  ] });
  assert.deepEqual(result, { eventId: 'event-1', participantCount: 2, gameCount: 2, savedCount: 4 });
  assert.deepEqual(calls[0][1].where, { teamEventId: 'event-1' });
  assert.equal(calls[1][1].data.every(row => row.teamEventId === 'event-1' && row.teamId === 'team-1'), true);
  assert.deepEqual(calls[1][1].data.filter(row => row.teamEventGuestId === 'guest-a').map(row => row.score), [181, 182]);
});

test('competition score save rejects duplicates, incomplete participants and published events', async () => {
  let current = event({ scores: [] });
  const tx = { teamEvent: { findFirst: async () => current }, score: { deleteMany: async () => assert.fail(), createMany: async () => assert.fail() } };
  const service = loadTs('src/lib/mobile-api/competition-scores.ts', {
    '@/lib/prisma': { $transaction: async callback => callback(tx) },
    '@/lib/mobile-api/bowler-hidden': { getBowlerHiddenCompetition: async () => ({ participantPreview: [] }) },
  });
  await assert.rejects(() => service.saveCompetitionScores('owner', 'team-1', 'event-1', { participants: [
    { participantId: 'member:member-a', scores: [1, 2] }, { participantId: 'member:member-a', scores: [3, 4] },
  ] }), error => error.code === 'PARTICIPANT_MISMATCH' || error.code === 'DUPLICATE_PARTICIPANT');
  await assert.rejects(() => service.saveCompetitionScores('owner', 'team-1', 'event-1', { participants: [
    { participantId: 'member:member-a', scores: [1, 2] },
  ] }), error => error.code === 'PARTICIPANT_MISMATCH');
  current = event({ competitionStatus: 'PUBLISHED', scores: [] });
  await assert.rejects(() => service.saveCompetitionScores('owner', 'team-1', 'event-1', { participants: [
    { participantId: 'member:member-a', scores: [1, 2] }, { participantId: 'guest:guest-a', scores: [3, 4] },
  ] }), error => error.code === 'SCORES_READ_ONLY');
});

test('competition score access remains manager-only and requires Hidden competition', async () => {
  const prisma = { teamEvent: { findFirst: async () => event({ team: { ownerId: 'another', bowlerHiddenEnabled: true, User: [], members: [{ id: 'm', userId: 'member-user' }] } }) } };
  const service = loadTs('src/lib/mobile-api/competition-scores.ts', {
    '@/lib/prisma': prisma,
    '@/lib/mobile-api/bowler-hidden': { getBowlerHiddenCompetition: async () => ({ participantPreview: [] }) },
  });
  await assert.rejects(() => service.getCompetitionScoreEntry('member-user', 'team-1', 'event-1'), error => error.code === 'FORBIDDEN');
});

test('competition score route requires auth and preserves actor team event scope', async () => {
  const calls = [];
  const route = loadTs('src/app/api/mobile/v1/teams/[teamId]/events/[eventId]/scores/route.ts', {
    '@/lib/mobile-api/auth': { getMobileApiUserId: async request => request.headers.get('x-user') },
    '@/lib/mobile-api/competition-scores': {
      CompetitionScoreError: class CompetitionScoreError extends Error {},
      getCompetitionScoreEntry: async (...args) => { calls.push(['GET', ...args]); return { gameCount: 3 }; },
      saveCompetitionScores: async (...args) => { calls.push(['POST', ...args]); return { savedCount: 3 }; },
    },
  });
  const context = { params: Promise.resolve({ teamId: 'team-1', eventId: 'event-1' }) };
  assert.equal((await route.GET(new Request('https://example.test'), context)).status, 401);
  assert.equal((await route.GET(new Request('https://example.test', { headers: { 'x-user': 'user-1' } }), context)).status, 200);
  assert.equal((await route.POST(new Request('https://example.test', {
    method: 'POST', headers: { 'x-user': 'user-1', 'content-type': 'application/json' }, body: JSON.stringify({ participants: [] }),
  }), context)).status, 200);
  assert.deepEqual(calls.map(call => call.slice(0, 4)), [
    ['GET', 'user-1', 'team-1', 'event-1'], ['POST', 'user-1', 'team-1', 'event-1'],
  ]);
});
