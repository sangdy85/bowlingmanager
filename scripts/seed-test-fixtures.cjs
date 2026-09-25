const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const TEAM_ID = 'local-fixture-team-bowler-hidden';
const TEAM_CODE = 'TEST_TEAM';
const CONFIRMATION = '--confirm-local-test-fixture';

function assertTestFixtureEnvironment(env = process.env, argv = process.argv.slice(2)) {
  if (env.NODE_ENV === 'production' || env.APP_ENV === 'production') {
    throw new Error('Test fixture seed is disabled in production.');
  }
  if (!argv.includes(CONFIRMATION)) {
    throw new Error(`Explicit confirmation is required: ${CONFIRMATION}`);
  }
  const url = env.DATABASE_URL ?? '';
  if (!url.startsWith('file:') || !/(test|dev|local)/i.test(url)) {
    throw new Error('Test fixture seed requires an explicitly local SQLite test/dev database URL.');
  }
}

async function seedTestFixtures(prisma = new PrismaClient()) {
  const ownsClient = arguments.length === 0;
  const password = await bcrypt.hash('1234', 10);
  try {
    for (let index = 1; index <= 10; index += 1) {
      const id = `local-fixture-user-test${index}`;
      const email = `test${index}@local.test`;
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing && existing.id !== id) throw new Error(`Fixture email collision: ${email}`);
      const idOwner = await prisma.user.findUnique({ where: { id } });
      if (idOwner && idOwner.email !== email) throw new Error(`Fixture user id collision: ${id}`);
      await prisma.user.upsert({
        where: { id },
        create: { id, email, name: `test${index}`, password, emailVerified: new Date('2026-01-01T00:00:00.000Z') },
        update: { email, name: `test${index}`, password, emailVerified: new Date('2026-01-01T00:00:00.000Z') },
      });
    }

    const codeOwner = await prisma.team.findUnique({ where: { code: TEAM_CODE } });
    if (codeOwner && codeOwner.id !== TEAM_ID) throw new Error(`Fixture team code collision: ${TEAM_CODE}`);
    const idOwner = await prisma.team.findUnique({ where: { id: TEAM_ID } });
    if (idOwner && idOwner.code !== TEAM_CODE) throw new Error(`Fixture team id collision: ${TEAM_ID}`);
    await prisma.team.upsert({
      where: { id: TEAM_ID },
      create: {
        id: TEAM_ID, code: TEAM_CODE, name: 'test', ownerId: 'local-fixture-user-test1',
        bowlerHiddenEnabled: true, seasonRankingEnabled: true,
        User: { connect: { id: 'local-fixture-user-test2' } },
      },
      update: {
        name: 'test', ownerId: 'local-fixture-user-test1', isActive: true,
        bowlerHiddenEnabled: true, seasonRankingEnabled: true,
        User: { set: [{ id: 'local-fixture-user-test2' }] },
      },
    });
    for (let index = 1; index <= 10; index += 1) {
      await prisma.teamMember.upsert({
        where: { userId_teamId: { userId: `local-fixture-user-test${index}`, teamId: TEAM_ID } },
        create: {
          id: `local-fixture-member-test${index}`, userId: `local-fixture-user-test${index}`,
          teamId: TEAM_ID, alias: `test${index}`,
        },
        update: { alias: `test${index}` },
      });
    }
    await prisma.teamSeason.upsert({
      where: { id: 'local-fixture-season-2026' },
      create: {
        id: 'local-fixture-season-2026', teamId: TEAM_ID, name: 'TEST 2026',
        startDate: new Date('2026-01-01T00:00:00.000Z'), endDate: new Date('2026-12-31T23:59:59.999Z'),
        enabled: true, status: 'ACTIVE', scoringMode: 'PODIUM', pointsConfig: '[5,3,1]',
      },
      update: { enabled: true, status: 'ACTIVE' },
    });
    await prisma.teamEvent.upsert({
      where: { id: 'local-fixture-individual-event' },
      create: {
        id: 'local-fixture-individual-event', teamId: TEAM_ID, createdById: 'local-fixture-user-test1',
        title: 'TEST 개인전', eventDate: new Date('2026-10-01T00:00:00.000Z'), eventTime: '19:00',
        location: 'TEST LANES', gameType: '정기전', competitionEnabled: true,
        competitionType: 'INDIVIDUAL', competitionMode: 'MINI', competitionStatus: 'ATTENDANCE_OPEN',
      },
      update: { competitionEnabled: true, competitionType: 'INDIVIDUAL', competitionMode: 'MINI' },
    });
    for (let index = 1; index <= 10; index += 1) {
      await prisma.teamEventAttendance.upsert({
        where: { eventId_memberId: { eventId: 'local-fixture-individual-event', memberId: `local-fixture-member-test${index}` } },
        create: {
          eventId: 'local-fixture-individual-event', memberId: `local-fixture-member-test${index}`,
          memberDisplayName: `test${index}`, status: 'ATTENDING',
        },
        update: { memberDisplayName: `test${index}`, status: 'ATTENDING' },
      });
    }
    for (const [id, name] of [['local-fixture-guest-1', 'guest1'], ['local-fixture-guest-2', 'guest2']]) {
      await prisma.teamEventGuest.upsert({
        where: { id }, create: { id, eventId: 'local-fixture-individual-event', name }, update: { name },
      });
    }
    const sampleCounts = new Map([
      [1, { total: 60, regular: 35 }],
      [2, { total: 50, regular: 12 }],
      [3, { total: 50, regular: 29 }],
      [4, { total: 50, regular: 11 }],
      [5, { total: 49, regular: 20 }],
      [6, { total: 50, regular: 12 }],
    ]);
    for (const [userNumber, sample] of sampleCounts) {
      const { total, regular } = sample;
      for (let game = 1; game <= total; game += 1) {
        const score = 150 + ((userNumber * 7 + game) % 60);
        const gameDate = new Date(Date.UTC(2026, 0, 1 + game));
        const gameType = game <= regular ? '정기전' : '벙개';
        await prisma.score.upsert({
          where: { id: `local-fixture-score-test${userNumber}-${game}` },
          create: {
            id: `local-fixture-score-test${userNumber}-${game}`, userId: `local-fixture-user-test${userNumber}`,
            teamId: TEAM_ID, score, gameDate, gameType,
          },
          update: { score, gameDate, gameType },
        });
      }
    }
    return { teamId: TEAM_ID, users: 10, guests: 2 };
  } finally {
    if (ownsClient) await prisma.$disconnect();
  }
}

if (require.main === module) {
  try {
    assertTestFixtureEnvironment();
    seedTestFixtures().then(result => {
      console.log(`Created local fixture ${TEAM_CODE}: ${result.users} users, ${result.guests} guests.`);
    }).catch(error => { console.error(error.message); process.exitCode = 1; });
  } catch (error) {
    console.error(error.message); process.exitCode = 1;
  }
}

module.exports = { assertTestFixtureEnvironment, seedTestFixtures, TEAM_ID, TEAM_CODE, CONFIRMATION };
