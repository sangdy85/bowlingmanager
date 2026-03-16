const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const rounds = await prisma.leagueRound.findMany({
    where: {
      roundNumber: 16
    }
  });

  console.log('Rounds with number 16:');
  console.log(JSON.stringify(rounds, null, 2));

  for (const round of rounds) {
    const matchups = await prisma.leagueMatchup.findMany({
      where: {
        roundId: round.id,
        OR: [
          { teamA: { name: { contains: '마볼러스' } } },
          { teamB: { name: { contains: '마볼러스' } } },
          { teamASquad: { contains: '마볼러스' } },
          { teamBSquad: { contains: '마볼러스' } }
        ]
      },
      include: {
        teamA: true,
        teamB: true
      }
    });
    if (matchups.length > 0) {
        console.log(`Matchups for Round ${round.id} (Tournament ${round.tournamentId}):`);
        console.log(JSON.stringify(matchups, null, 2));
    }
  }

  const registrations = await prisma.tournamentRegistration.findMany({
    where: {
      OR: [
        { guestTeamName: { contains: '마볼러스' } },
        { squad: { contains: '마볼러스' } }
      ]
    }
  });
  console.log('Registrations with "마볼러스":');
  console.log(JSON.stringify(registrations, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
