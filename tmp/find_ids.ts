import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tournaments = await prisma.tournament.findMany({
    where: {
      name: {
        contains: '상주리그',
      },
    },
    select: {
      id: true,
      name: true,
    },
  });

  console.log('Tournaments found:');
  console.log(JSON.stringify(tournaments, null, 2));

  for (const t of tournaments) {
    if (t.name.includes('19')) {
      const rounds = await prisma.leagueRound.findMany({
        where: {
          tournamentId: t.id,
          roundNumber: 16,
        },
      });
      console.log(`Rounds for ${t.name} (Round 16):`);
      console.log(JSON.stringify(rounds, null, 2));
      
      if (rounds.length > 0) {
        const matchups = await prisma.leagueMatchup.findMany({
          where: {
            roundId: rounds[0].id,
            OR: [
              { teamA: { name: { contains: '마볼러스' } } },
              { teamB: { name: { contains: '마볼러스' } } },
            ],
          },
          include: {
            teamA: true,
            teamB: true,
          },
        });
        console.log('Matchups involving "마볼러스":');
        console.log(JSON.stringify(matchups, null, 2));
      }
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
