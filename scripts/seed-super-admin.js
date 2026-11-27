const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// Usage:
//   SUPER_ADMIN_LOGIN=<login id or e-mail> SUPER_ADMIN_PASSWORD=<strong password> node scripts/seed-super-admin.js
// Credentials are never stored in this file. The script upserts, so running it
// again resets that account's password and SUPER_ADMIN role.
async function main() {
    const login = process.env.SUPER_ADMIN_LOGIN;
    const password = process.env.SUPER_ADMIN_PASSWORD;

    if (!login || !password) {
        throw new Error('SUPER_ADMIN_LOGIN and SUPER_ADMIN_PASSWORD are required.');
    }
    if (password.length < 12) {
        throw new Error('SUPER_ADMIN_PASSWORD must be at least 12 characters.');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.upsert({
        where: { email: login },
        update: {
            password: passwordHash,
            role: 'SUPER_ADMIN',
            emailVerified: new Date(),
            updatedAt: new Date(),
        },
        create: {
            email: login,
            name: '슈퍼관리자',
            password: passwordHash,
            role: 'SUPER_ADMIN',
            emailVerified: new Date(),
            updatedAt: new Date(),
        },
        select: { id: true, email: true, role: true },
    });

    console.log('Super Admin created/updated:', user);
}

main()
    .catch((e) => {
        console.error(e instanceof Error ? e.message : e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
