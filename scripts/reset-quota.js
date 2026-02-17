
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const email = 'sangdy85@naver.com';

    // 1. Find User
    const user = await prisma.user.findUnique({
        where: { email },
    });

    if (!user) {
        console.error(`User not found: ${email}`);
        process.exit(1);
    }

    // 2. Get Today's Date (KST)
    const today = new Date(new Date().getTime() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];

    // 3. Reset Quota
    try {
        const updated = await prisma.userApiUsage.update({
            where: {
                userId_date: {
                    userId: user.id,
                    date: today
                }
            },
            data: { count: 0 }
        });
        console.log(`Quota reset for ${email} on ${today}. Previous count cleared.`);
    } catch (e) {
        if (e.code === 'P2025') {
            console.log(`No usage record found for ${email} on ${today}. Creating one with count 0.`);
            // Create if not exists (though likely exists if they ran out)
            await prisma.userApiUsage.create({
                data: {
                    userId: user.id,
                    date: today,
                    count: 0,
                    id: require('crypto').randomUUID()
                }
            });
        } else {
            console.error("Error resetting quota:", e);
        }
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
