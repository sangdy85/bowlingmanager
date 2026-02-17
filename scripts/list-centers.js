const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const centers = await prisma.bowlingCenter.findMany();
    console.log('Centers:', JSON.stringify(centers, null, 2));
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
