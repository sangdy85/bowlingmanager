
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const tournaments = await prisma.tournament.findMany({
        select: {
            id: true,
            name: true,
            status: true,
            centerId: true
        }
    });

    console.log('Tournaments:', tournaments);

    const joining = tournaments.filter(t => t.status === 'JOINING');
    console.log(`Found ${joining.length} tournaments with status 'JOINING'.`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
