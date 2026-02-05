import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma?: PrismaClient };

const getPrisma = () => {
    if (globalForPrisma.prisma) return globalForPrisma.prisma;

    const client = new PrismaClient({
        log: ['error', 'warn'],
    });

    if (process.env.NODE_ENV !== 'production') {
        globalForPrisma.prisma = client;
    }
    return client;
};

// Use a proxy to export the prisma object lazily
// This prevents module-load time crashes if environment/client is not ready
export const prisma = new Proxy({} as PrismaClient, {
    get: (target, prop) => {
        const client = getPrisma();
        return (client as any)[prop];
    }
});

export { getPrisma };
