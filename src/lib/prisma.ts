// Extreme Mock for Diagnosis
export const prisma: any = new Proxy({}, {
    get: () => () => ({
        findUnique: async () => null,
        findMany: async () => [],
        create: async () => ({}),
    })
});

export const getPrisma = () => prisma;
