const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    const superAdminId = 'sangdy85';
    const superAdminPassword = await bcrypt.hash('01rkddnr', 10);

    const user = await prisma.user.upsert({
        where: { email: superAdminId },
        update: {
            password: superAdminPassword,
            role: 'SUPER_ADMIN',
            emailVerified: new Date(),
        },
        create: {
            id: 'super-admin-id',
            email: superAdminId,
            name: '슈퍼관리자',
            password: superAdminPassword,
            role: 'SUPER_ADMIN',
            emailVerified: new Date(),
        },
    });

    console.log('Super Admin created/updated:', user);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
