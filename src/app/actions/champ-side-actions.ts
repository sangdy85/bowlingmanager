'use server';

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";

export async function updateSideGameParticipation(
    roundId: string,
    participationData: { regId: string, basic: boolean, ball: boolean, extra: boolean }[]
) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const round = await prisma.leagueRound.findUnique({
        where: { id: roundId },
        include: { tournament: { include: { center: { include: { managers: true } } } } }
    });

    if (!round) throw new Error("Round not found");

    const isManager = round.tournament.center.managers.some(m => m.id === session.user.id) ||
        round.tournament.center.ownerId === session.user.id;

    if (!isManager) throw new Error("Permission denied");

    // Batch update via transaction or loop
    // Using $executeRaw for performance on multiple rows if needed, or simple update
    for (const data of participationData) {
        let finalRegId = data.regId;

        // Auto-register league players if they don't have a registration yet
        if (finalRegId.startsWith('LEAGUE_PLAYER|')) {
            const [_, userId, playerName, teamId] = finalRegId.split('|');

            let reg = await prisma.tournamentRegistration.findFirst({
                where: {
                    tournamentId: round.tournamentId,
                    AND: [
                        userId ? { userId } : { guestName: playerName }
                    ]
                }
            });

            if (!reg) {
                reg = await prisma.tournamentRegistration.create({
                    data: {
                        tournamentId: round.tournamentId,
                        userId: userId || null,
                        guestName: userId ? null : playerName,
                        teamId: teamId || null,
                        paymentStatus: 'PENDING'
                    }
                });
            }
            finalRegId = reg.id;
        }

        await (prisma as any).roundParticipant.upsert({
            where: {
                roundId_registrationId: {
                    roundId: roundId,
                    registrationId: finalRegId
                }
            },
            create: {
                roundId: roundId,
                registrationId: finalRegId,
                sideBasic: data.basic,
                sideBall: data.ball,
                sideExtra: data.extra
            },
            update: {
                sideBasic: data.basic,
                sideBall: data.ball,
                sideExtra: data.extra
            }
        });
    }

    revalidatePath(`/centers/${round.tournament.centerId}/tournaments/${round.tournamentId}/rounds/${roundId}/results`);
    return { success: true };
}
