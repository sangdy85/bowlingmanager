
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function restore() {
    const backupPath = path.join(process.cwd(), 'member-backup.json');
    if (!fs.existsSync(backupPath)) {
        console.error('Backup file not found!');
        process.exit(1);
    }

    const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    console.log(`Restoring ${backupData.length} memberships...`);

    for (const item of backupData) {
        try {
            await prisma.teamMember.create({
                data: {
                    userId: item.userId,
                    teamId: item.teamId,
                    joinedAt: new Date(item.joinedAt),
                    alias: null // Default to null (using User.name)
                }
            });
            console.log(`Restored membership for User ${item.userId} in Team ${item.teamId}`);
        } catch (e: any) {
            console.error(`Failed to restore User ${item.userId} in Team ${item.teamId}:`, e.message);
        }
    }

    console.log('Restore completed.');
}

restore()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
