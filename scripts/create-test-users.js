const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
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
