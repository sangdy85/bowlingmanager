'use server';

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";

export async function updateChampScores(tournamentId: string, roundId: string, formData: FormData) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    // Verify manager permission
    const tournament = await prisma.tournament.findUnique({
        where: { id: tournamentId },
        include: { center: { include: { managers: true } } }
    });

    if (!tournament) throw new Error("Tournament not found");

    // Check if user is manager or owner
    const isManager = tournament.center.managers.some(m => m.id === session.user.id) || tournament.center.ownerId === session.user.id;
    if (!isManager) throw new Error("Permission denied");

    // Process scores
    const entries = Array.from(formData.entries());

    // Group scores by registrationId
    // Key format: score_{regId}_{gameNumber}
    const scoresToUpdate: { regId: string, game: number, score: number }[] = [];

    for (const [key, value] of entries) {
        if (key.startsWith('score_')) {
            const parts = key.split('_');
            if (parts.length === 3) {
                const regId = parts[1];
                const game = parseInt(parts[2]);
                const score = parseInt(value as string);

                if (!isNaN(score)) {
                    scoresToUpdate.push({ regId, game, score });
                }
            }
        }
    }

    // Batch update (using transaction for atomic updates per user/game is overkill, just loop)
    // Since we don't have unique constraint on (regId, roundId, gameNumber), we check existence manually 
    // or delete previous for this round/reg/game and create new.
    // Safer: Find existing and update, or create.

    for (const item of scoresToUpdate) {
        // Use 'as any' for now due to potential type generation issues
        const existing = await (prisma.tournamentScore as any).findFirst({
            where: {
                registrationId: item.regId,
                roundId: roundId,
                gameNumber: item.game
            }
        });

        if (existing) {
            if (existing.score !== item.score) {
                await (prisma.tournamentScore as any).update({
                    where: { id: existing.id },
                    data: { score: item.score }
                });
            }
        } else {
            if (item.score > 0) {
                await (prisma.tournamentScore as any).create({
                    data: {
                        registrationId: item.regId,
                        roundId: roundId,
                        gameNumber: item.game,
                        score: item.score
                    }
                });
            }
        }
    }

    revalidatePath(`/centers/${tournament.centerId}/tournaments/${tournamentId}`);
}
