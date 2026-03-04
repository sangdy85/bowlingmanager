const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const targetName = '2026년 상반기 챔프전';
    const targetType = 'CHAMP';
    const targetTimestamp = '2026-02-18T08:03:4'; // Matches all from 40.x to 41.x

    console.log(`Searching for duplicates of "${targetName}" (${targetType}) created around ${targetTimestamp}...`);

    const duplicates = await prisma.tournament.findMany({
        where: {
            name: targetName,
            type: targetType,
            createdAt: {
                gte: new Date('2026-02-18T08:03:40Z'),
                lte: new Date('2026-02-18T08:03:42Z')
            }
        },
        select: { id: true, name: true, createdAt: true }
    });

    console.log(`Found ${duplicates.length} potentially duplicate tournaments.`);

    if (duplicates.length <= 1) {
        console.log('Keep-one rule: Only one or zero found. Nothing to prune.');
        return;
    }

    // Keep the first one found (oldest usually), delete the rest
    const [toKeep, ...toDelete] = duplicates;

    console.log(`KEEPING: ${toKeep.name} (ID: ${toKeep.id}, Created: ${toKeep.createdAt})`);
    console.log(`DELETING ${toDelete.length} duplicates...`);

    for (const item of toDelete) {
        try {
            await prisma.tournament.delete({ where: { id: item.id } });
            console.log(`- Deleted: ${item.id}`);
        } catch (e) {
            console.error(`- Failed to delete ${item.id}:`, e.message);
        }
    }

    console.log('\n✅ Cleanup Finished.');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
