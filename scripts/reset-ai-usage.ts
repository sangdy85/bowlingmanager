import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // 1. Get email from command line arguments
    const email = process.argv[2];

    if (!email) {
        console.error('Usage: npx ts-node scripts/reset-ai-usage.ts <email>');
        console.error('Example: npx ts-node scripts/reset-ai-usage.ts sangdy85@gmail.com');
        process.exit(1);
    }

    try {
        console.log(`Searching for user: ${email}`);

        // 2. Find the user
        const user = await prisma.user.findUnique({
            where: { email },
            select: { id: true, email: true }
        });

        if (!user) {
            console.error(`Error: User with email "${email}" not found.`);
            process.exit(1);
        }

        // 3. Calculate today's KST date
        const kstDate = new Date(new Date().getTime() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];

        console.log(`Resetting AI usage for: ${user.email} (ID: ${user.id})`);
        console.log(`Target Date (KST): ${kstDate}`);

        // 4. Update usage count to 0
        const result = await prisma.userApiUsage.updateMany({
            where: {
                userId: user.id,
                date: kstDate
            },
            data: {
                count: 0
            }
        });

        if (result.count > 0) {
            console.log(`Successfully reset usage for ${user.email}. (Updated ${result.count} record(s))`);
        } else {
            console.log(`No usage record found for ${user.email} on ${kstDate}. (Already 0 or not used yet)`);

            // Proactively create a 0-count record if it doesn't exist, to "pre-reset" it
            // (Optional, based on how checkUserAiQuota works)
        }

        console.log('Done.');
    } catch (error: any) {
        console.error('Error occurred while resetting usage:', error.message);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
