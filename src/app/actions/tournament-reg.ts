'use server';

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { getEffectiveRoundDate, calculateTournamentStatus } from "@/lib/tournament-utils";

import { v4 as uuidv4 } from 'uuid';

export async function registerForTournament(tournamentId: string, participants: any[]) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("로그인이 필요합니다.");

    const tournament = await prisma.tournament.findUnique({
        where: { id: tournamentId },
        include: {
            registrations: true,
            leagueRounds: true
        }
    });

    if (!tournament) throw new Error("대회를 찾을 수 없습니다.");

    // Check if tournament is recruiting
    const now = new Date();
    let isRecruiting = tournament.status === 'JOINING' || tournament.status === 'ONGOING';

    // ... (rest of recruiting check logic stays the same)
    if (tournament.type === 'CHAMP') {
        const settings = tournament.settings ? JSON.parse(tournament.settings) : {};
        const leagueTime = settings.leagueTime;
        isRecruiting = tournament.leagueRounds.some(r => {
            const effectiveDate = getEffectiveRoundDate(r.date, leagueTime);
            const status = calculateTournamentStatus(effectiveDate, r.registrationStart, r.date, tournament.status);
            return status === 'OPEN' || status === 'CLOSED' || status === 'ONGOING';
        });
    } else if (tournament.type === 'EVENT') {
        let regStart = null;
        if (tournament.settings) {
            try {
                const settings = JSON.parse(tournament.settings);
                if (settings.registrationStart) regStart = new Date(settings.registrationStart);
            } catch (e) { }
        }
        const status = calculateTournamentStatus(tournament.startDate, regStart, tournament.endDate, tournament.status);
        isRecruiting = (status === 'OPEN' || status === 'CLOSED' || status === 'ONGOING') && tournament.status !== 'FINISHED';
    }

    if (!isRecruiting) throw new Error("현재 모집 중인 대회가 아닙니다.");

    // CHAMP type specific: Find the target round for registration
    let targetRoundId: string | null = null;
    if (tournament.type === 'CHAMP') {
        const settings = tournament.settings ? JSON.parse(tournament.settings) : {};
        const leagueTime = settings.leagueTime;

        const recruitingRound = tournament.leagueRounds.find(r => {
            const effectiveDate = getEffectiveRoundDate(r.date, leagueTime);
            const status = calculateTournamentStatus(effectiveDate, r.registrationStart, r.date, tournament.status);
            return status === 'OPEN' || status === 'CLOSED' || status === 'ONGOING';
        });

        if (recruitingRound) {
            targetRoundId = recruitingRound.id;
            const alreadyInRound = await prisma.roundParticipant.findFirst({
                where: {
                    roundId: targetRoundId,
                    registration: {
                        userId: session.user.id,
                        tournamentId: tournamentId
                    }
                }
            });
            if (alreadyInRound) throw new Error("이미 해당 회차에 신청하셨습니다.");
        }
    }

    // Assign a unique group ID for this registration session
    const entryGroupId = uuidv4();

    // Perform registration in a transaction to ensure atomic team registration
    const results = await prisma.$transaction(async (tx) => {
        const regResults = [];

        for (const p of participants) {
            const registration = await tx.tournamentRegistration.create({
                data: {
                    tournamentId,
                    userId: p.isMe ? session.user.id : null,
                    guestName: p.isMe ? null : p.name,
                    guestTeamName: p.isMe ? null : p.teamName,
                    handicap: p.handicap || 0,
                    entryGroupId: entryGroupId,
                    paymentStatus: 'PENDING',
                }
            });

            // Join rounds
            if (tournament.type === 'CHAMP' && targetRoundId) {
                await (tx as any).roundParticipant.create({
                    data: {
                        roundId: targetRoundId,
                        registrationId: registration.id,
                    }
                });
            } else if (tournament.type === 'EVENT' && tournament.leagueRounds.length > 0) {
                const roundParticipantsData = tournament.leagueRounds.map((round: any) => ({
                    roundId: round.id,
                    registrationId: registration.id,
                }));

                await (tx as any).roundParticipant.createMany({
                    data: roundParticipantsData
                });
            }
            regResults.push(registration);
        }
        return regResults;
    });

    const rank = await prisma.tournamentRegistration.count({
        where: {
            tournamentId: tournamentId,
            createdAt: { lt: results[0].createdAt }
        }
    });

    const isWaitlisted = rank >= tournament.maxParticipants;
    const waitlistNo = isWaitlisted ? rank - tournament.maxParticipants + 1 : 0;

    revalidatePath(`/centers/${tournament.centerId}/tournaments/${tournamentId}`);

    return {
        success: true,
        rank: rank + 1,
        isWaitlisted,
        waitlistNo
    };
}

export async function cancelRegistration(tournamentId: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    await prisma.tournamentRegistration.deleteMany({
        where: {
            tournamentId,
            userId: session.user.id
        }
    });

    const tournament = await prisma.tournament.findUnique({
        where: { id: tournamentId },
        select: { centerId: true }
    });

    revalidatePath(`/centers/${tournament?.centerId}/tournaments/${tournamentId}`);
}
