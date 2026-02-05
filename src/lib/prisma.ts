import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

if (process.env.NODE_ENV === 'production') {
    if (!process.env.DATABASE_URL) {
        console.error("CRITICAL: DATABASE_URL is missing in production environment!");
    } else {
        console.log("DATABASE_URL is present in production.");
    }
}

export const prisma =
    globalForPrisma.prisma ||
    new PrismaClient({
        log: ['query', 'error', 'warn'],
    });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
