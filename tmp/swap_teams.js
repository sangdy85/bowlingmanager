const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  // 매치업 1: 마볼러스 B -> A
  const update1 = await prisma.leagueMatchup.update({
    where: { id: 'cmm21phl2005513o057v05790' },
    data: { teamASquad: 'A' }
  });
  console.log('Updated Matchup 1 (JK vs 마볼러스): Squad B -> A');

  // 매치업 2: 마볼러스 A -> B
  const update2 = await prisma.leagueMatchup.update({
    where: { id: 'cmm21phl2005713o0b8fh1o8q' },
    data: { teamASquad: 'B' }
  });
  console.log('Updated Matchup 2 (떼굴떼굴 B vs 마볼러스): Squad A -> B');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
