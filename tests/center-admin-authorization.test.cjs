const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

// Body of each exported server action, keyed by name.
function exportedActions(source) {
  const starts = [...source.matchAll(/export\s+async\s+function\s+(\w+)\s*\(/g)];
  return new Map(starts.map((match, index) => [
    match[1],
    source.slice(match.index, index + 1 < starts.length ? starts[index + 1].index : source.length),
  ]));
}

// The admin check must run before the action's first database call.
function guardRunsFirst(body, guard) {
  const guardAt = body.search(guard);
  const dbAt = body.search(/prisma\.|getTournamentInfo\(/);
  return guardAt !== -1 && (dbAt === -1 || guardAt < dbAt);
}

const ADMIN_GUARD = /await verify(Center|Tournament|Round|Registration)Admin\(/;

test('round management server actions require a center admin before touching the database', () => {
  const actions = exportedActions(read('src/app/actions/round-actions.ts'));
  const adminOnly = [
    'updateRoundSettings', 'updateRoundParticipants', 'updateEntryGroupId', 'updateRoundLanes',
    'updateRoundScores', 'updateFemaleChampParticipants', 'manualRegister', 'updateLaneSettings',
    'updateLaneConfig', 'autoAssignRemaining', 'updatePaymentStatus', 'deleteRegistration',
    'removeFromRound', 'updateRegistration', 'updateLuckyDrawResult', 'searchPlayers',
    'checkAndCancelUnpaidRegistrations', 'bulkRegisterParticipants', 'autoAssignEntryGroups',
    'updateSingleRegistrationGroup',
  ];
  for (const name of adminOnly) {
    assert.ok(actions.has(name), `${name} is missing`);
    assert.ok(guardRunsFirst(actions.get(name), ADMIN_GUARD), `${name} must verify center admin first`);
  }
});

test('round actions that act for a member only allow admins to act for someone else', () => {
  const actions = exportedActions(read('src/app/actions/round-actions.ts'));
  const join = actions.get('joinRound');
  assert.match(join, /if \(!sessionUserId\) throw/);
  assert.match(join, /if \(userId !== sessionUserId\) await verifyRoundAdmin\(roundId\)/);
  const draw = actions.get('drawLane');
  assert.match(draw, /if \(!userId\) throw/);
  assert.match(draw, /participant\.registration\.userId !== userId\) await verifyRoundAdmin\(roundId\)/);
});

test('tournament rule mutations require a center admin', () => {
  const actions = exportedActions(read('src/app/actions/tournament-mgmt.ts'));
  for (const name of ['updateTournamentRules', 'updateTeamHandicaps']) {
    assert.ok(guardRunsFirst(actions.get(name), /await verifyTournamentAdmin\(tournamentId\)/), name);
  }
});

test('user search that returns e-mail addresses is limited to center admins', () => {
  const actions = exportedActions(read('src/app/actions/center-members.ts'));
  assert.ok(guardRunsFirst(actions.get('searchUsers'), /await verifyCenterAdmin\(centerId\)/));
  assert.match(read('src/components/tournaments/MemberSearchModal.tsx'), /searchUsers\(query, centerId\)/);
  assert.match(actions.get('removeCenterMember'), /deleteMany\(\{\s*where: \{ id: memberId, centerId \}/);
});

test('center admin means the center owner or one of its managers', () => {
  const source = read('src/lib/auth-utils.ts');
  assert.match(source, /center\.ownerId === userId \|\| center\.managers\.some\(manager => manager\.id === userId\)/);
});

test('real credentials and member data stay out of the repository', () => {
  for (const removed of ['scripts/fix-local-user.js', 'scripts/create-test-user.ts', 'member-backup.json', 'prisma/dev.db.bak']) {
    assert.equal(fs.existsSync(path.join(root, removed)), false, removed);
  }
  const script = read('scripts/create-test-user.js');
  assert.doesNotMatch(script, /@naver\.com|1234qwer/);
  assert.match(script, /process\.env\.TEST_USER_PASSWORD/);
  const ignore = read('.gitignore');
  assert.match(ignore, /^\/public\/uploads\/\*$/m);
  assert.match(ignore, /^\/member-backup\*\.json$/m);
});
