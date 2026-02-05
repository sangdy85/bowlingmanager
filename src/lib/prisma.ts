import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma?: PrismaClient };

export const getPrisma = () => {
    if (globalForPrisma.prisma) return globalForPrisma.prisma;

    console.log("Creating new PrismaClient instance...");
    const client = new PrismaClient({
        log: ['error', 'warn'],
    });

    if (process.env.NODE_ENV !== 'production') {
        globalForPrisma.prisma = client;
    }
    return client;
};

// For backward compatibility while we refactor
export const prisma = globalForPrisma.prisma || getPrisma();
