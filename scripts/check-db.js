const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tournaments = await prisma.tournament.findMany({
    select: { id: true, name: true, status: true }
  });
  console.log(JSON.stringify(tournaments, null, 2));
}

main().finally(() => prisma.$disconnect());
