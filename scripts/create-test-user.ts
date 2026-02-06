import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    const email = 'sangdy85@naver.com';
    const name = '이강욱';
    const password = '1234qwer';

    console.log(`Creating test user: ${email}...`);

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await prisma.user.upsert({
            where: { email },
            update: {
                name,
                password: hashedPassword,
            },
            create: {
                email,
                name,
                password: hashedPassword,
            },
        });

        console.log('Success! User created/updated:', user.email);
    } catch (error) {
        console.error('Error creating user:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
