const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const data = await prisma.tournament.findMany({
    where: { status: 'FINISHED' },
    include: {
      leagueRounds: {
        orderBy: { roundNumber: "asc" }
      }
    }
  });
  console.log(JSON.stringify(data, null, 2));
}

main().finally(() => prisma.$disconnect());
