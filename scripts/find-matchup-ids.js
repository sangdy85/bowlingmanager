const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // 1. Find the tournament
  const tournament = await prisma.tournament.findFirst({
    where: { name: { contains: '19차 상주리그' } }
  });
  
  if (!tournament) {
    console.log("Tournament not found");
    return;
  }
  console.log(`Tournament found: ${tournament.name} (${tournament.id})`);

  // 2. Find Round 16
  const round = await prisma.leagueRound.findFirst({
    where: { 
      tournamentId: tournament.id,
      roundNumber: 16
    }
  });

  if (!round) {
    console.log("Round 16 not found");
    return;
  }
  console.log(`Round 16 found: ID ${round.id}`);

  // 3. Find matchups for "마볼러스"
  const matchups = await prisma.leagueMatchup.findMany({
    where: { roundId: round.id },
    include: {
      teamA: true,
      teamB: true
    }
  });

  const mavolousMatchups = matchups.filter(m => 
    m.teamA?.name?.includes('마볼러스') || m.teamB?.name?.includes('마볼러스')
  );

  console.log("Mavolous Matchups in Round 16:");
  console.log(JSON.stringify(mavolousMatchups.map(m => ({
    id: m.id,
    teamA: m.teamA?.name,
    teamASquad: m.teamASquad,
    teamB: m.teamB?.name,
    teamBSquad: m.teamBSquad
  })), null, 2));
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
