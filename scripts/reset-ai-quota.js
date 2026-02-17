
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function resetQuota() {
    const email = 'sangdy85@naver.com';
    console.log(`Searching for user with email: ${email}`);

    const user = await prisma.user.findUnique({
        where: { email },
    });

    if (!user) {
        console.error('User not found!');
        return;
    }

    console.log(`User found: ${user.name} (${user.id})`);

    // Delete all UserApiUsage records for this user to fully reset
    const deleteResult = await prisma.userApiUsage.deleteMany({
        where: { userId: user.id },
    });

    console.log(`Deleted ${deleteResult.count} usage records for user.`);
    console.log('AI Quota reset successfully.');
}

resetQuota()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
