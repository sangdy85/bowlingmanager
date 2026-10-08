import { PrismaClient } from '@prisma/client';

// Local BAND staging never opens the site's default production/dev SQLite file.
if (process.env.APP_ENV === 'band-staging') {
  if (process.env.DATABASE_URL !== 'file:./band-staging.db' ||
      process.env.BAND_EXTERNAL_POSTING_ENABLED === 'true') {
    throw new Error('BAND staging requires its isolated SQLite database and disabled external posting.');
  }
}

const prismaClientSingleton = () => {
  return new PrismaClient();
};

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientSingleton | undefined;
};

const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

export default prisma;
export const getPrisma = () => prisma;

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
