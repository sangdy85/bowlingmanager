const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const tournaments = await prisma.tournament.findMany({
        orderBy: { startDate: 'desc' }
    });

    console.log(`--- All Tournaments (Found: ${tournaments.length}) ---`);
    tournaments.forEach(t => {
        console.log(`ID: ${t.id} | Name: ${t.name} | Type: ${t.type} | StartDate: ${t.startDate.toISOString()}`);
    });
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
