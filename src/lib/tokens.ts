
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '@/lib/prisma';

export async function generateVerificationToken(email: string) {
    // Generate 6 digit code
    const token = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(new Date().getTime() + 10 * 60 * 1000); // 10 minutes

    const existingToken = await prisma.verificationToken.findFirst({
        where: { identifier: email },
    });

    if (existingToken) {
        await prisma.verificationToken.delete({
            where: {
                identifier_token: {
                    identifier: existingToken.identifier,
                    token: existingToken.token,
                },
            },
        });
    }

    const verificationToken = await prisma.verificationToken.create({
        data: {
            identifier: email,
            token,
            expires,
        },
    });

    return verificationToken;
}

export async function getVerificationTokenByToken(token: string) {
    try {
        const verificationToken = await prisma.verificationToken.findUnique({
            where: { token },
        });
        return verificationToken;
    } catch {
        return null;
    }
}
