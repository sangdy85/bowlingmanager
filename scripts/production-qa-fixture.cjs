const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const {
  removeStoredPostImagePathsStrict,
  storedPostImagePath,
} = require('../src/lib/post-image-storage-path.cjs');

const CONFIRMATION = '--confirm-production-qa-fixture';
const DRY_RUN = '--dry-run';
const TEAM_CODE = 'TEST_TEAM';
const TEAM_ID = 'production-qa-fixture-team';
const SEASON_ID = 'production-qa-fixture-season';
const PASSWORD = '1234';
const USER_COUNT = 10;
const USER_ID_PREFIX = 'production-qa-fixture-user-test';
const MEMBER_ID_PREFIX = 'production-qa-fixture-member-test';

const users = Array.from({ length: USER_COUNT }, (_, offset) => {
  const number = offset + 1;
  return {
    id: `${USER_ID_PREFIX}${number}`,
    memberId: `${MEMBER_ID_PREFIX}${number}`,
    email: `test${number}@local.test`,
    name: `test${number}`,
  };
});
const userIds = users.map((user) => user.id);
const emails = users.map((user) => user.email);

class QaFixtureSafetyError extends Error {}

function parseArguments(argv = process.argv.slice(2)) {
  const action = argv[0];
  if (action !== 'create' && action !== 'remove') {
    throw new QaFixtureSafetyError('Use either the create or remove QA fixture action.');
  }
  const dryRun = argv.includes(DRY_RUN);
  if (!dryRun && !argv.includes(CONFIRMATION)) {
    throw new QaFixtureSafetyError(`A mutating run requires explicit confirmation: ${CONFIRMATION}`);
  }
  return { action, dryRun };
}

function assertDatabaseConfiguration(env = process.env) {
  const databaseUrl = env.DATABASE_URL ?? '';
  if (!databaseUrl.startsWith('file:') || databaseUrl === 'file::memory:') {
    throw new QaFixtureSafetyError('The QA fixture tool requires the configured SQLite database.');
  }
}

async function loadIdentityState(prisma) {
  const [teamByCode, teamById, matchingUsers, matchingMembers] = await Promise.all([
    prisma.team.findUnique({
      where: { code: TEAM_CODE },
      include: {
        members: { select: { id: true, userId: true } },
        User: { select: { id: true } },
        seasons: { where: { id: SEASON_ID }, select: { id: true, name: true, status: true, enabled: true } },
      },
    }),
    prisma.team.findUnique({ where: { id: TEAM_ID }, select: { id: true, code: true } }),
    prisma.user.findMany({
      where: { OR: [{ id: { in: userIds } }, { email: { in: emails } }] },
      select: { id: true, email: true, name: true, role: true, password: true, emailVerified: true },
    }),
    prisma.teamMember.findMany({
      where: { id: { in: users.map((user) => user.memberId) } },
      select: { id: true, userId: true, teamId: true },
    }),
  ]);
  return { teamByCode, teamById, matchingUsers, matchingMembers };
}

async function assertKnownFixtureIdentity(prisma, { allowAbsent = false } = {}) {
  const state = await loadIdentityState(prisma);
  const { teamByCode, teamById, matchingUsers, matchingMembers } = state;
  if (teamByCode && teamByCode.id !== TEAM_ID) {
    throw new QaFixtureSafetyError('TEST_TEAM is already used by data that is not the QA fixture.');
  }
  if (teamById && teamById.code !== TEAM_CODE) {
    throw new QaFixtureSafetyError('The reserved QA team id is already used by another team.');
  }

  for (const existing of matchingUsers) {
    const expected = users.find((user) => user.id === existing.id && user.email === existing.email);
    if (!expected) {
      throw new QaFixtureSafetyError('A reserved QA user id or email collides with existing data.');
    }
    if (
      existing.name !== expected.name
      || existing.role !== 'USER'
      || !existing.emailVerified
      || !existing.password
      || !(await bcrypt.compare(PASSWORD, existing.password))
    ) {
      throw new QaFixtureSafetyError('An existing QA namespace user does not match the managed fixture.');
    }
  }
  for (const member of matchingMembers) {
    const expected = users.find((user) => user.memberId === member.id);
    if (!expected || member.userId !== expected.id || member.teamId !== TEAM_ID) {
      throw new QaFixtureSafetyError('A reserved QA member id collides with existing data.');
    }
  }

  if (teamByCode) {
    if (
      teamByCode.name !== 'test'
      || teamByCode.ownerId !== users[0].id
      || teamByCode.bowlerHiddenEnabled !== true
      || teamByCode.seasonRankingEnabled !== true
      || teamByCode.isActive !== true
    ) {
      throw new QaFixtureSafetyError('TEST_TEAM does not match the managed QA fixture.');
    }
    const actualManagers = teamByCode.User.map((user) => user.id).sort();
    if (actualManagers.length !== 1 || actualManagers[0] !== users[1].id) {
      throw new QaFixtureSafetyError('TEST_TEAM manager assignments are contaminated.');
    }
    const actualMembers = teamByCode.members.map((member) => member.userId).sort();
    if (actualMembers.some((id) => !userIds.includes(id))) {
      throw new QaFixtureSafetyError('TEST_TEAM contains a user outside the QA namespace.');
    }
  }

  const isAbsent = !teamByCode && matchingUsers.length === 0 && matchingMembers.length === 0;
  if (!allowAbsent && isAbsent) return { ...state, isAbsent, isComplete: false };
  const expectedMemberIds = new Set(users.map((user) => user.memberId));
  const isComplete = Boolean(
    teamByCode
    && matchingUsers.length === USER_COUNT
    && teamByCode.members.length === USER_COUNT
    && teamByCode.members.every((member) => expectedMemberIds.has(member.id))
    && teamByCode.seasons.length === 1,
  );
  return { ...state, isAbsent, isComplete };
}

async function createQaFixture(prisma, { dryRun = false } = {}) {
  const state = await assertKnownFixtureIdentity(prisma, { allowAbsent: true });
  if (state.isComplete) {
    return {
      action: 'create', dryRun, status: 'already-present', teamCode: TEAM_CODE,
      accounts: emails, teams: 0, users: 0, members: 0, seasons: 0,
    };
  }
  const existingUserIds = new Set(state.matchingUsers.map((user) => user.id));
  const existingMemberIds = new Set(state.matchingMembers.map((member) => member.id));
  const plan = {
    action: 'create',
    dryRun,
    status: dryRun ? 'planned' : 'created',
    teamCode: TEAM_CODE,
    accounts: emails,
    teams: state.teamByCode ? 0 : 1,
    users: users.filter((user) => !existingUserIds.has(user.id)).length,
    members: users.filter((user) => !existingMemberIds.has(user.memberId)).length,
    seasons: state.teamByCode?.seasons.length === 1 ? 0 : 1,
  };
  if (dryRun) return plan;

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  await prisma.$transaction(async (tx) => {
    for (const user of users) {
      if (!existingUserIds.has(user.id)) {
        await tx.user.create({
          data: {
            id: user.id,
            email: user.email,
            name: user.name,
            password: passwordHash,
            role: 'USER',
            emailVerified: new Date('2026-01-01T00:00:00.000Z'),
          },
        });
      }
    }
    if (!state.teamByCode) {
      await tx.team.create({
        data: {
          id: TEAM_ID,
          code: TEAM_CODE,
          name: 'test',
          ownerId: users[0].id,
          isActive: true,
          bowlerHiddenEnabled: true,
          seasonRankingEnabled: true,
          User: { connect: { id: users[1].id } },
        },
      });
    }
    for (const user of users) {
      if (!existingMemberIds.has(user.memberId)) {
        await tx.teamMember.create({
          data: { id: user.memberId, userId: user.id, teamId: TEAM_ID, alias: user.name },
        });
      }
    }
    if (state.teamByCode?.seasons.length !== 1) {
      await tx.teamSeason.create({
        data: {
          id: SEASON_ID,
          teamId: TEAM_ID,
          name: 'TEST 2026',
          startDate: new Date('2026-01-01T00:00:00.000Z'),
          endDate: new Date('2026-12-31T23:59:59.999Z'),
          enabled: true,
          status: 'ACTIVE',
          scoringMode: 'PODIUM',
          pointsConfig: '[5,3,1]',
        },
      });
    }
  });
  const completed = await assertKnownFixtureIdentity(prisma, { allowAbsent: false });
  if (!completed.isComplete) throw new QaFixtureSafetyError('QA fixture creation did not complete atomically.');
  return plan;
}

async function assertRemovalIsIsolated(prisma, teamExists) {
  const [foreignMembers, outsideMemberships, teamPosts, teamScores, externalRelations] = await Promise.all([
    teamExists ? prisma.teamMember.count({ where: { teamId: TEAM_ID, userId: { notIn: userIds } } }) : 0,
    prisma.teamMember.count({ where: { userId: { in: userIds }, teamId: { not: TEAM_ID } } }),
    teamExists ? prisma.post.findMany({ where: { teamId: TEAM_ID }, select: { authorId: true } }) : [],
    teamExists ? prisma.score.findMany({ where: { teamId: TEAM_ID }, select: { userId: true } }) : [],
    Promise.all([
      prisma.team.count({ where: { ownerId: { in: userIds }, id: { not: TEAM_ID } } }),
      prisma.team.count({ where: { User: { some: { id: { in: userIds } } }, id: { not: TEAM_ID } } }),
      prisma.teamEvent.count({ where: { createdById: { in: userIds }, teamId: { not: TEAM_ID } } }),
      prisma.post.count({ where: { authorId: { in: userIds }, teamId: { not: TEAM_ID } } }),
      prisma.score.count({
        where: { userId: { in: userIds }, teamId: { not: null }, NOT: { teamId: TEAM_ID } },
      }),
      prisma.centerMember.count({ where: { OR: [{ userId: { in: userIds } }, { teamId: TEAM_ID }] } }),
      prisma.bowlingCenter.count({ where: { OR: [{ ownerId: { in: userIds } }, { managers: { some: { id: { in: userIds } } } }] } }),
      prisma.tournamentRegistration.count({ where: { OR: [{ userId: { in: userIds } }, { teamId: TEAM_ID }] } }),
      prisma.leagueMatchup.count({ where: { OR: [{ teamAId: TEAM_ID }, { teamBId: TEAM_ID }] } }),
      prisma.leagueMatchupIndividualScore.count({ where: { OR: [{ userId: { in: userIds } }, { teamId: TEAM_ID }] } }),
      prisma.teamEventAttendance.count({
        where: { member: { userId: { in: userIds } }, event: { teamId: { not: TEAM_ID } } },
      }),
      prisma.teamEventLaneAssignment.count({
        where: { member: { userId: { in: userIds } }, event: { teamId: { not: TEAM_ID } } },
      }),
      prisma.teamCompetitionTeam.count({
        where: { captain: { userId: { in: userIds } }, event: { teamId: { not: TEAM_ID } } },
      }),
      prisma.teamCompetitionParticipant.count({
        where: { member: { userId: { in: userIds } }, event: { teamId: { not: TEAM_ID } } },
      }),
      prisma.teamCompetitionDraftPick.count({
        where: { captain: { userId: { in: userIds } }, event: { teamId: { not: TEAM_ID } } },
      }),
      prisma.eventCompetitionParticipant.count({
        where: { member: { userId: { in: userIds } }, event: { teamId: { not: TEAM_ID } } },
      }),
      prisma.seasonFinalParticipant.count({
        where: { member: { userId: { in: userIds } }, tournament: { teamId: { not: TEAM_ID } } },
      }),
    ]),
  ]);
  if (foreignMembers > 0 || outsideMemberships > 0) {
    throw new QaFixtureSafetyError('QA fixture membership is contaminated; removal stopped.');
  }
  if (teamPosts.some((post) => !userIds.includes(post.authorId))) {
    throw new QaFixtureSafetyError('TEST_TEAM contains a post owned by a user outside the QA namespace.');
  }
  if (teamScores.some((score) => score.userId !== null && !userIds.includes(score.userId))) {
    throw new QaFixtureSafetyError('TEST_TEAM contains a score owned by a user outside the QA namespace.');
  }
  if (externalRelations.some((count) => count > 0)) {
    throw new QaFixtureSafetyError('QA fixture is linked to non-QA team, center, or tournament data; removal stopped.');
  }
}

async function inventoryQaFixture(prisma) {
  const team = await prisma.team.findUnique({ where: { code: TEAM_CODE }, select: { id: true } });
  const teamExists = team?.id === TEAM_ID;
  await assertRemovalIsIsolated(prisma, teamExists);
  const eventWhere = { event: { teamId: TEAM_ID } };
  const finalWhere = { tournament: { teamId: TEAM_ID } };
  const seasonWhere = { season: { teamId: TEAM_ID } };
  const [
    userCount, memberCount, scoreCount, refreshTokenCount, eventCount, attendanceCount,
    guestCount, slotCount, assignmentCount, competitionTeamCount, competitionParticipantCount,
    draftPickCount, eventParticipantCount, ballotCount, votePickCount, seasonCount,
    publicationCount, pointEntryCount, finalCount, finalParticipantCount, finalNodeCount,
    finalScoreCount, finalResultCount, postCount, images,
  ] = await Promise.all([
    prisma.user.count({ where: { id: { in: userIds }, email: { in: emails } } }),
    prisma.teamMember.count({ where: { teamId: TEAM_ID, userId: { in: userIds } } }),
    prisma.score.count({ where: { OR: [{ teamId: TEAM_ID }, { userId: { in: userIds } }] } }),
    prisma.mobileRefreshToken.count({ where: { userId: { in: userIds } } }),
    prisma.teamEvent.count({ where: { teamId: TEAM_ID } }),
    prisma.teamEventAttendance.count({ where: eventWhere }),
    prisma.teamEventGuest.count({ where: eventWhere }),
    prisma.teamEventLaneSlot.count({ where: eventWhere }),
    prisma.teamEventLaneAssignment.count({ where: eventWhere }),
    prisma.teamCompetitionTeam.count({ where: eventWhere }),
    prisma.teamCompetitionParticipant.count({ where: eventWhere }),
    prisma.teamCompetitionDraftPick.count({ where: eventWhere }),
    prisma.eventCompetitionParticipant.count({ where: eventWhere }),
    prisma.eventCompetitionBallot.count({ where: eventWhere }),
    prisma.eventCompetitionVotePick.count({ where: { ballot: eventWhere } }),
    prisma.teamSeason.count({ where: { teamId: TEAM_ID } }),
    prisma.seasonPointPublication.count({ where: seasonWhere }),
    prisma.seasonPointEntry.count({ where: seasonWhere }),
    prisma.seasonFinalTournament.count({ where: { teamId: TEAM_ID } }),
    prisma.seasonFinalParticipant.count({ where: finalWhere }),
    prisma.seasonFinalNode.count({ where: finalWhere }),
    prisma.seasonFinalScore.count({ where: { participant: finalWhere } }),
    prisma.seasonFinalNodeResult.count({ where: { participant: finalWhere } }),
    prisma.post.count({ where: { teamId: TEAM_ID } }),
    prisma.postImage.findMany({ where: { post: { teamId: TEAM_ID } }, select: { url: true } }),
  ]);
  return {
    teamExists,
    images,
    counts: {
      teams: teamExists ? 1 : 0,
      users: userCount,
      teamMembers: memberCount,
      scores: scoreCount,
      refreshTokens: refreshTokenCount,
      events: eventCount,
      attendance: attendanceCount,
      guests: guestCount,
      laneSlots: slotCount,
      laneAssignments: assignmentCount,
      competitionTeams: competitionTeamCount,
      competitionParticipants: competitionParticipantCount,
      draftPicks: draftPickCount,
      eventParticipants: eventParticipantCount,
      ballots: ballotCount,
      votePicks: votePickCount,
      seasons: seasonCount,
      seasonPublications: publicationCount,
      seasonPointEntries: pointEntryCount,
      seasonFinals: finalCount,
      finalParticipants: finalParticipantCount,
      finalNodes: finalNodeCount,
      finalScores: finalScoreCount,
      finalResults: finalResultCount,
      posts: postCount,
      postImages: images.length,
    },
  };
}

async function removeQaFixture(prisma, { dryRun = false, rootDirectory = process.cwd() } = {}) {
  const state = await assertKnownFixtureIdentity(prisma, { allowAbsent: true });
  const inventory = await inventoryQaFixture(prisma);
  if (state.isAbsent && !inventory.teamExists) {
    return { action: 'remove', dryRun, status: 'not-found', teamCode: TEAM_CODE, ...inventory.counts };
  }

  const imagePaths = inventory.images.map((image) => storedPostImagePath(image.url, rootDirectory));
  if (imagePaths.some((path) => path === null)) {
    throw new QaFixtureSafetyError('A QA post image path is outside the managed upload directory.');
  }
  const result = {
    action: 'remove',
    dryRun,
    status: dryRun ? 'planned' : 'removed',
    teamCode: TEAM_CODE,
    ...inventory.counts,
  };
  if (dryRun) return result;

  await prisma.$transaction(async (tx) => {
    await tx.verificationToken.deleteMany({ where: { identifier: { in: emails } } });
    await tx.mobileRefreshToken.deleteMany({ where: { userId: { in: userIds } } });
    await tx.userApiUsage.deleteMany({ where: { userId: { in: userIds } } });
    await tx.inquiry.deleteMany({ where: { authorId: { in: userIds } } });
    await tx.post.deleteMany({ where: { teamId: TEAM_ID } });
    await tx.seasonFinalTournament.deleteMany({ where: { teamId: TEAM_ID } });
    await tx.teamEvent.deleteMany({ where: { teamId: TEAM_ID } });
    await tx.teamSeason.deleteMany({ where: { teamId: TEAM_ID } });
    await tx.score.deleteMany({ where: { OR: [{ teamId: TEAM_ID }, { userId: { in: userIds } }] } });
    await tx.teamMember.deleteMany({ where: { teamId: TEAM_ID, userId: { in: userIds } } });
    if (inventory.teamExists) {
      await tx.team.update({ where: { id: TEAM_ID }, data: { User: { set: [] } } });
      await tx.team.delete({ where: { id: TEAM_ID } });
    }
    await tx.user.deleteMany({ where: { id: { in: userIds }, email: { in: emails } } });
  });

  try {
    await removeStoredPostImagePathsStrict([...new Set(imagePaths)]);
  } catch {
    throw new QaFixtureSafetyError(
      'QA database rows were removed, but post image cleanup did not complete. Restore or clean up from the verified backup.',
    );
  }
  return result;
}

function printResult(result) {
  console.log(JSON.stringify(result, null, 2));
}

async function main() {
  const options = parseArguments();
  assertDatabaseConfiguration();
  const prisma = new PrismaClient();
  try {
    const result = options.action === 'create'
      ? await createQaFixture(prisma, options)
      : await removeQaFixture(prisma, options);
    printResult(result);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof QaFixtureSafetyError ? error.message : 'QA fixture operation failed safely.');
    process.exitCode = 1;
  });
}

module.exports = {
  CONFIRMATION,
  DRY_RUN,
  MEMBER_ID_PREFIX,
  QaFixtureSafetyError,
  SEASON_ID,
  TEAM_CODE,
  TEAM_ID,
  USER_ID_PREFIX,
  assertDatabaseConfiguration,
  createQaFixture,
  emails,
  inventoryQaFixture,
  parseArguments,
  removeQaFixture,
  users,
};
