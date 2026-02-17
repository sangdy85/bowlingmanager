
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
    const teams = await prisma.team.findMany({
        take: 20,
        orderBy: { name: 'asc' },
        select: { id: true, name: true }
    });
    console.log("Teams:", JSON.stringify(teams, null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
