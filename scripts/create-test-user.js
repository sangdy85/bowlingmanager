const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// Usage (local development DB only):
//   TEST_USER_EMAIL=me@example.com TEST_USER_PASSWORD=... TEST_USER_NAME=테스트 node scripts/create-test-user.js
// Credentials are never stored in this file. The script upserts, so it
// resets the password of an existing account with the same e-mail.
async function main() {
    const email = process.env.TEST_USER_EMAIL;
    const password = process.env.TEST_USER_PASSWORD;
    const name = process.env.TEST_USER_NAME || '테스트유저';

    if (!email || !password) {
        console.error('TEST_USER_EMAIL and TEST_USER_PASSWORD are required.');
        process.exitCode = 1;
        return;
    }
    if (process.env.NODE_ENV === 'production') {
        console.error('Refusing to run with NODE_ENV=production.');
        process.exitCode = 1;
        return;
    }

    console.log(`Creating test user: ${email}...`);

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await prisma.user.upsert({
            where: { email },
            update: {
                name,
                password: hashedPassword,
                emailVerified: new Date(),
            },
            create: {
                email,
                name,
                password: hashedPassword,
                emailVerified: new Date(),
            },
        });

        console.log('Success! User created/updated:', user.email);
    } catch (error) {
        console.error('Error creating user:', error);
        process.exitCode = 1;
    } finally {
        await prisma.$disconnect();
    }
}

main();
