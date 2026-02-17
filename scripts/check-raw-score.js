
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkRawScores() {
    // Get the latest RawLaneScore entry to verify upload
    const latest = await prisma.rawLaneScore.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' }
    });
    console.log(JSON.stringify(latest, null, 2));
}

checkRawScores()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
