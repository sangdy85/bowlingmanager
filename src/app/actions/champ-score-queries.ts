'use server';

import prisma from "@/lib/prisma";

export async function getChampRoundScores(roundId: string) {
    try {
        // Use raw query to bypass potential Prisma Client generation issues
        // We select * from TournamentScore where roundId matches
        const scores = await prisma.$queryRaw`
            SELECT * FROM "TournamentScore" WHERE "roundId" = ${roundId}
        `;
        return scores as any[];
    } catch (error) {
        console.error("Failed to fetch champ scores:", error);
        return [];
    }
}
