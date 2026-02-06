import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function GET() {
    const email = 'sangdy85@naver.com';
    const name = '이강욱';
    const password = '1234qwer';

    try {
        const prisma = getPrisma();
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

        return NextResponse.json({
            success: true,
            message: `User ${user.email} created/updated successfully on Vercel.`
        });
    } catch (error: any) {
        console.error('Diag user creation error:', error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}
