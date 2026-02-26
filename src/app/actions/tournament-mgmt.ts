'use server';

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function updateTournamentRules(
    tournamentId: string,
    rules: {
        teamHandicapLimit?: number | null;
        awardMinGames?: number;
        avgTopRankCount?: number;
        avgMinParticipationPct?: number;
        reportNotice?: string | null;
    }
) {
    try {
        await prisma.tournament.update({
            where: { id: tournamentId },
            data: {
                teamHandicapLimit: rules.teamHandicapLimit,
                awardMinGames: rules.awardMinGames,
                avgTopRankCount: rules.avgTopRankCount,
                avgMinParticipationPct: rules.avgMinParticipationPct,
                reportNotice: rules.reportNotice
            } as any
        });

        revalidatePath(`/centers/[id]/tournaments/${tournamentId}`, 'layout');
        return { success: true };
    } catch (error: any) {
        console.error("Failed to update tournament rules:", error);
        throw new Error(error.message);
    }
}

export async function updateTeamHandicaps(
    tournamentId: string,
    teamHandicaps: { [teamId: string]: number }
) {
    try {
        // Find existing tournament to merge or overwrite? Usually overwrite the JSON.
        // But let's just save the whole object as string.

        await prisma.tournament.update({
            where: { id: tournamentId },
            data: {
                manualTeamHandicaps: JSON.stringify(teamHandicaps)
            }
        });

        revalidatePath(`/centers/[id]/tournaments/${tournamentId}`, 'layout');
        return { success: true };
    } catch (error: any) {
        console.error("Failed to update team handicaps:", error);
        throw new Error(error.message);
    }
}
