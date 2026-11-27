const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// Local development only: creates test1..test10@test.com with a weak shared password.
async function main() {
    // The production database is also named dev.db, so require an explicit opt-in.
    if (process.env.NODE_ENV === 'production' || process.env.ALLOW_TEST_USERS !== 'yes') {
        console.error('Refusing to run: set ALLOW_TEST_USERS=yes, and only against a local development database.');
        process.exitCode = 1;
        return;
    }
    const passwordHash = await bcrypt.hash('1234', 10);

    for (let i = 1; i <= 10; i++) {
        const email = `test${i}@test.com`;
        const name = `test${i}`;

        const user = await prisma.user.upsert({
            where: { email },
            update: {
                password: passwordHash,
                emailVerified: new Date(),
                name: name,
                role: 'USER',
                updatedAt: new Date(),
            },
            create: {
                email,
                name,
                password: passwordHash,
                emailVerified: new Date(),
                role: 'USER',
                updatedAt: new Date(),
            },
        });

        console.log(`User created/updated: ${user.email}`);
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
