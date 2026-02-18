const { PrismaClient } = require('@prisma/client');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
    console.log('--- Prisma Diagnostic ---');
    console.log('Current working directory:', process.cwd());
    console.log('DATABASE_URL from env:', process.env.DATABASE_URL);

    try {
        // Check User table
        const userCount = await prisma.user.count();
        console.log('Total users in DB:', userCount);

        // Check VerificationToken table
        const tokenCount = await prisma.verificationToken.count();
        console.log('Total verification tokens in DB:', tokenCount);

        const firstToken = await prisma.verificationToken.findFirst();
        if (firstToken) {
            console.log('✅ VerificationToken table is queryable.');
        }

        // Check schema info if possible (SQLite specific)
        const userTableInfo = await prisma.$queryRaw`PRAGMA table_info(User)`;
        console.log('User table columns:', userTableInfo.map(c => c.name).join(', '));

        const tokenTableInfo = await prisma.$queryRaw`PRAGMA table_info(VerificationToken)`;
        console.log('VerificationToken columns:', tokenTableInfo.map(c => c.name).join(', '));

        if (userTableInfo.some(c => c.name === 'role')) {
            console.log('✅ "role" column EXISTS in User table.');
        } else {
            console.log('❌ "role" column MISSING in User table.');
        }

    } catch (error) {
        console.error('❌ Diagnostic failed:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
