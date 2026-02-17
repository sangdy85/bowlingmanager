import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const email = 'sangdy85@naver.com';

async function main() {
    const user = await prisma.user.findUnique({
        where: { email }
    });

    if (!user) {
        console.error(`User with email ${email} not found.`);
        return;
    }

    const kstDate = new Date(new Date().getTime() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];

    console.log(`Resetting usage for user: ${user.name} (${user.id}) on date: ${kstDate}`);

    const result = await prisma.userApiUsage.updateMany({
        where: {
            userId: user.id,
            date: kstDate
        },
        data: {
            count: 0
        }
    });

    console.log(`Success: Updated ${result.count} records.`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
