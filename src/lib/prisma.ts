import { PrismaClient } from '@prisma/client';

const prismaClientSingleton = () => {
  const client = new PrismaClient();
  enableSqliteWal(client);
  return client;
};

/**
 * WAL lets readers keep working while a write is in progress, which avoids most
 * "database is locked" errors when many people enter scores at once. The mode
 * is stored in the database file, so running it once per process is enough.
 * Waiting on a lock is controlled by `socket_timeout` in DATABASE_URL
 * (Prisma's SQLite busy timeout, default 5 seconds).
 *
 * WAL keeps recent writes in `<db>-wal` until a checkpoint, so a backup must
 * use `sqlite3 <db> ".backup <file>"` (or copy the -wal and -shm files too).
 */
function enableSqliteWal(client: PrismaClient) {
  const url = process.env.DATABASE_URL ?? '';
  if (!url.startsWith('file:') || process.env.PRISMA_SQLITE_WAL === 'off') return;
  client
    .$queryRawUnsafe('PRAGMA journal_mode = WAL;')
    .catch((error: unknown) => {
      console.error('Could not enable SQLite WAL mode:', error instanceof Error ? error.message : error);
    });
}

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientSingleton | undefined;
};

const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

export default prisma;
export const getPrisma = () => prisma;

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
