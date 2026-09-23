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

const service = loadTs('src/lib/mobile-api/event-competition.ts', {
  '@/lib/prisma': {},
  '@/lib/mobile-api/bowler-hidden': { readRankPoints: () => [] },
});

const participants = [
  { participantId: 'p1', memberId: 'm1', name: '가', scores: [250, 250, 250, 250] },
  { participantId: 'p2', memberId: 'm2', name: '나', scores: [217, 230, 220, 250] },
  { participantId: 'p3', memberId: 'm3', name: '다', scores: [200, 200, 200, 200] },
  { participantId: 'p4', memberId: 'm4', name: '라', scores: [150, 150, 150, 150] },
];
const ballots = [
  { voterParticipantId: 'p1', selectedParticipantIds: ['p2', 'p3', 'p4'] },
  { voterParticipantId: 'p2', selectedParticipantIds: ['p1', 'p3', 'p4'] },
  { voterParticipantId: 'p3', selectedParticipantIds: ['p1', 'p2', 'p4'] },
  { voterParticipantId: 'p4', selectedParticipantIds: ['p1', 'p2', 'p3'] },
];

test('vote validation requires exactly three unique attending others', () => {
  const ids = new Set(['p1', 'p2', 'p3', 'p4']);
  assert.deepEqual(service.validateVoteSelection('p1', ['p2', 'p3', 'p4'], ids), ['p2', 'p3', 'p4']);
  assert.throws(() => service.validateVoteSelection('p1', ['p2', 'p3'], ids), e => e.code === 'INVALID_VOTE');
  assert.throws(() => service.validateVoteSelection('p1', ['p2', 'p3', 'p4', 'p5'], ids), e => e.code === 'INVALID_VOTE');
  assert.throws(() => service.validateVoteSelection('p1', ['p2', 'p2', 'p3'], ids), e => e.code === 'DUPLICATE_VOTE');
  assert.throws(() => service.validateVoteSelection('p1', ['p1', 'p2', 'p3'], ids), e => e.code === 'SELF_VOTE');
  assert.throws(() => service.validateVoteSelection('p1', ['p2', 'p3', 'outside'], ids), e => e.code === 'INVALID_PARTICIPANT');
});

test('server voting window opens at start and closes exactly after 30 minutes', () => {
  const start = new Date('2026-09-22T10:00:00Z');
  assert.equal(service.votingPhase(start, 30, new Date('2026-09-22T09:59:59Z')).open, false);
  assert.equal(service.votingPhase(start, 30, start).open, true);
  assert.equal(service.votingPhase(start, 30, new Date('2026-09-22T10:29:59Z')).open, true);
  const close = service.votingPhase(start, 30, new Date('2026-09-22T10:30:00Z'));
  assert.equal(close.open, false); assert.equal(close.closed, true);
});

test('share, voter bonus and final score preserve decimal precision', () => {
  const rows = service.calculateEventResults(participants, ballots, [{ rank: 1, points: 20 }], 'INCLUDE_ACTUAL_ONLY', 'ACTUAL_SCORE_THEN_ID');
  const p2 = rows.find(row => row.participantId === 'p2');
  assert.equal(p2.actualScore, 917);
  assert.equal(p2.voteCount, 3);
  assert.equal(p2.shareScore, 917 / 3);
  const p1 = rows.find(row => row.participantId === 'p1');
  assert.equal(p1.voteBonus, 917 / 3 + 800 / 3 + 600 / 3);
  assert.equal(p1.finalScore, 1000 + 917 / 3 + 800 / 3 + 600 / 3);
  assert.equal(p1.seasonPoint, 20);
});

test('official decimal fixture keeps 917 divided by 6 unrounded', () => {
  const seven = Array.from({ length: 7 }, (_, index) => ({
    participantId: `d${index + 1}`, memberId: `dm${index + 1}`, name: `참가${index + 1}`,
    scores: index === 0 ? [217, 230, 220, 250] : [100],
  }));
  const sixVotes = seven.slice(1).map(voter => ({
    voterParticipantId: voter.participantId,
    selectedParticipantIds: ['d1', ...seven.filter(item => item.participantId !== 'd1' && item.participantId !== voter.participantId).slice(0, 2).map(item => item.participantId)],
  }));
  const row = service.calculateEventResults(seven, sixVotes, [], 'INCLUDE_ACTUAL_ONLY', 'STABLE_ID_ONLY')
    .find(item => item.participantId === 'd1');
  assert.equal(row.voteCount, 6);
  assert.equal(row.shareScore, 917 / 6);
  assert.equal(row.shareScore, 152.83333333333334);
});

test('zero votes produces null share instead of division', () => {
  const sparse = [
    { voterParticipantId: 'p1', selectedParticipantIds: ['p2', 'p3', 'p4'] },
  ];
  const rows = service.calculateEventResults(participants, sparse, [], 'INCLUDE_ACTUAL_ONLY', 'STABLE_ID_ONLY');
  assert.equal(rows.find(row => row.participantId === 'p1').voteCount, 0);
  assert.equal(rows.find(row => row.participantId === 'p1').shareScore, null);
  assert.equal(rows.find(row => row.participantId === 'p2').voteCount, 1);
  assert.equal(rows.find(row => row.participantId === 'p2').shareScore, 917);
});

test('explicit non-voter policies include actual-only or exclude ranking', () => {
  const partial = ballots.slice(0, 3);
  const included = service.calculateEventResults(participants, partial, [], 'INCLUDE_ACTUAL_ONLY', 'STABLE_ID_ONLY');
  assert.notEqual(included.find(row => row.participantId === 'p4').rank, null);
  assert.equal(included.find(row => row.participantId === 'p4').voteBonus, 0);
  const excluded = service.calculateEventResults(participants, partial, [], 'EXCLUDE_FROM_RANKING', 'STABLE_ID_ONLY');
  assert.equal(excluded.find(row => row.participantId === 'p4').rank, null);
});

test('tie policy is deterministic and actual score policy is explicit', () => {
  const tied = participants.map((item, index) => ({ ...item, scores: [100 + index] }));
  const noBallots = [];
  const stable = service.calculateEventResults(tied, noBallots, [], 'INCLUDE_ACTUAL_ONLY', 'STABLE_ID_ONLY');
  assert.deepEqual(stable.map(row => row.participantId), ['p4', 'p3', 'p2', 'p1']);
  const same = tied.map(item => ({ ...item, scores: [100] }));
  assert.deepEqual(service.calculateEventResults(same, noBallots, [], 'INCLUDE_ACTUAL_ONLY', 'STABLE_ID_ONLY').map(row => row.participantId), ['p1', 'p2', 'p3', 'p4']);
});

test('EVENT migration is additive with ballot uniqueness and no destructive SQL', () => {
  const sql = fs.readFileSync(path.resolve(__dirname, '../prisma/migrations/20260922210000_add_bowler_hidden_competitions/migration.sql'), 'utf8');
  assert.match(sql, /CREATE TABLE "EventCompetitionParticipant"/);
  assert.match(sql, /EventCompetitionBallot_voter_key/);
  assert.match(sql, /EventCompetitionVotePick_ballot_selected_key/);
  assert.match(sql, /selectionOrder" BETWEEN 1 AND 3/);
  assert.doesNotMatch(sql, /DROP TABLE|DELETE FROM|UPDATE "/i);
});

test('EVENT route requires mobile auth and exposes domain actions without secrets', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/app/api/mobile/v1/teams/[teamId]/events/[eventId]/competition/event/route.ts'), 'utf8');
  assert.match(source, /getMobileApiUserId/);
  assert.match(source, /unauthorizedResponse/);
  assert.match(source, /getEventCompetitionState/);
  assert.match(source, /updateEventCompetition/);
  assert.doesNotMatch(source, /password|accessToken|refreshToken|Authorization/);
});

test('service keeps ballot detail private before reveal and persists publication snapshot', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/lib/mobile-api/event-competition.ts'), 'utf8');
  assert.match(source, /mySelections:/);
  assert.match(source, /role === "MEMBER"/);
  assert.match(source, /eventPublishedSnapshot: snapshot/);
  assert.match(source, /competitionStatus: "PUBLISHED"/);
  assert.match(source, /updateMany\(\{ where: \{ id: eventId, competitionStatus: "FINAL_READY"/);
});

test('score completion and sequential reveal reject incomplete or duplicate progress', () => {
  assert.equal(service.eventScoresComplete(participants, 4), true);
  assert.equal(service.eventScoresComplete(participants.map((item, index) => index === 0 ? { ...item, scores: item.scores.slice(0, 3) } : item), 4), false);
  assert.deepEqual(service.nextRevealStep(0, 4), { revealedCount: 1, status: 'REVEALING' });
  assert.deepEqual(service.nextRevealStep(3, 4), { revealedCount: 4, status: 'FINAL_READY' });
  assert.throws(() => service.nextRevealStep(4, 4), error => error.code === 'REVEAL_COMPLETE');
});

test('vote replacement and reveal use transactions and compare-and-set guards', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/lib/mobile-api/event-competition.ts'), 'utf8');
  assert.match(source, /eventCompetitionBallot\.upsert/);
  assert.match(source, /eventCompetitionVotePick\.deleteMany/);
  assert.match(source, /\$transaction\(async \(tx\)/);
  assert.match(source, /revealedAt: null/);
  assert.match(source, /eventRevealIndex: event\.eventRevealIndex/);
});

test('published EVENT source scores are locked while unrelated rows remain mutable', async () => {
  const calls = [];
  const db = { teamEvent: { findFirst: async args => {
    calls.push(args.where);
    return args.where.OR.some(item => item.teamId === 'locked-team') ? { id: 'event-1' } : null;
  } } };
  await assert.rejects(
    service.assertEventScoresMutable([{ teamId: 'locked-team', userId: 'user-1', gameDate: new Date('2026-09-22T10:00:00Z'), gameType: '정기전' }], db),
    error => error.code === 'EVENT_SCORE_LOCKED' && error.status === 409,
  );
  await service.assertEventScoresMutable([
    { teamId: 'open-team', userId: 'user-1', gameDate: new Date('2026-09-22T10:00:00Z'), gameType: '정기전' },
    { teamId: 'locked-team', userId: null, gameDate: new Date('2026-09-22T10:00:00Z'), gameType: '정기전' },
  ], db);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0].OR[0].AND[0], { OR: [{ gameType: null }, { gameType: '정기전' }] });
  assert.deepEqual(calls[0].OR[0].AND[1].OR[0].competitionStatus, { in: ['REVEALING', 'FINAL_READY', 'PUBLISHED'] });
  assert.equal(calls[0].OR[0].AND[1].OR[1].competitionStatus, 'PUBLISHED');
  assert.equal(calls[0].OR[0].AND[1].OR[2].competitionStatus, 'PUBLISHED');
});
