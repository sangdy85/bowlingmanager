const { PrismaClient } = require('@prisma/client');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
    console.log('--- Prisma Diagnostic ---');
    console.log('Current working directory:', process.cwd());
    console.log('DATABASE_URL from env:', process.env.DATABASE_URL);

    try {
        // Try to find the first user and check its role
        const userCount = await prisma.user.count();
        console.log('Total users in DB:', userCount);

        const firstUser = await prisma.user.findFirst();
        if (firstUser) {
            console.log('Example User Email:', firstUser.email);
            console.log('Example User Role:', firstUser.role);
        } else {
            console.log('No users found in DB.');
        }

        // Check schema info if possible (SQLite specific)
        const tableInfo = await prisma.$queryRaw`PRAGMA table_info(User)`;
        console.log('User table columns:', tableInfo.map(c => c.name).join(', '));

        if (tableInfo.some(c => c.name === 'role')) {
            console.log('✅ "role" column EXISTS in this database.');
        } else {
            console.log('❌ "role" column MISSING in this database.');
        }

    } catch (error) {
        console.error('❌ Diagnostic failed:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
