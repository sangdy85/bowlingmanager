const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function fixUser(email, name, password) {
    console.log(`Checking/Fixing user: ${email}...`);
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
    console.log(`Success! User ${email} is now verified and ready.`);
}

async function main() {
    try {
        await fixUser('sangdy85@naver.com', '이강욱', '1234qwer');
        await fixUser('aaa@naver.com', '테스트유저', '1234qwer');
    } catch (error) {
        console.error('Error fixing users:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
