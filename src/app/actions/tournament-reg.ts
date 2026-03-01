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
        }
    }

    // Assign a unique group ID for this registration session
    const entryGroupId = uuidv4();

    // Perform registration in a transaction
    const results = await prisma.$transaction(async (tx) => {
        const regResults = [];

        for (const p of participants) {
            let registrationId: string;
            let registrationTeamId = p.isMe ? null : p.teamId;

            if (p.isMe) {
                // Check if already has a registration for this tournament (to avoid duplicates)
                const existingReg = await tx.tournamentRegistration.findUnique({
                    where: {
                        tournamentId_userId: {
                            tournamentId,
                            userId: session.user.id
                        }
                    }
                });

                if (existingReg) {
                    registrationId = existingReg.id;
                    // If CHAMP, check if already in the target round
                    if (tournament.type === 'CHAMP' && targetRoundId) {
                        const inRound = await tx.roundParticipant.findUnique({
                            where: {
                                roundId_registrationId: {
                                    roundId: targetRoundId,
                                    registrationId: registrationId
                                }
                            }
                        });
                        if (inRound) throw new Error("이미 해당 회차에 신청하셨습니다.");
                    }
                } else {
                    const centerMember = await tx.centerMember.findUnique({
                        where: {
                            userId_centerId: {
                                userId: session.user.id,
                                centerId: tournament.centerId
                            }
                        }
                    });
                    registrationTeamId = centerMember?.teamId || null;

                    const newReg = await tx.tournamentRegistration.create({
                        data: {
                            tournamentId,
                            userId: session.user.id,
                            teamId: registrationTeamId,
                            handicap: p.handicap || 0,
                            entryGroupId: entryGroupId,
                            paymentStatus: 'PENDING',
                        }
                    });
                    registrationId = newReg.id;
                }
            } else {
                // For guests, always create a new registration (they are logically distinct per session)
                const guestReg = await tx.tournamentRegistration.create({
                    data: {
                        tournamentId,
                        guestName: p.name,
                        guestTeamName: p.teamName,
                        handicap: p.handicap || 0,
                        entryGroupId: entryGroupId,
                        paymentStatus: 'PENDING',
                    }
                });
                registrationId = guestReg.id;
            }

            // Join rounds
            if (tournament.type === 'CHAMP' && targetRoundId) {
                await (tx as any).roundParticipant.create({
                    data: {
                        roundId: targetRoundId,
                        registrationId,
                    }
                });
            } else if (tournament.type === 'EVENT' && tournament.leagueRounds.length > 0) {
                // For EVENT, usually joins all rounds assigned to it
                for (const round of tournament.leagueRounds) {
                    await (tx as any).roundParticipant.upsert({
                        where: {
                            roundId_registrationId: {
                                roundId: round.id,
                                registrationId,
                            }
                        },
                        create: {
                            roundId: round.id,
                            registrationId,
                        },
                        update: {}
                    });
                }
            }
            // For results tracking in return
            regResults.push({ id: registrationId });
        }
        return regResults;
    });

    revalidatePath(`/centers/${tournament.centerId}/tournaments/${tournamentId}`);

    return {
        success: true,
    };
}

export async function cancelRegistration(tournamentId: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const tournament = await prisma.tournament.findUnique({
        where: { id: tournamentId },
        include: { leagueRounds: true }
    });

    if (!tournament) throw new Error("Tournament not found");

    if (tournament.type === 'CHAMP') {
        // For CHAMP, we only cancel the participation in the CURRENT recruiting round
        const settings = tournament.settings ? JSON.parse(tournament.settings) : {};
        const leagueTime = settings.leagueTime;

        const recruitingRound = tournament.leagueRounds.find(r => {
            const effectiveDate = getEffectiveRoundDate(r.date, leagueTime);
            const status = calculateTournamentStatus(effectiveDate, r.registrationStart, r.date, tournament.status);
            return status === 'OPEN' || status === 'CLOSED' || status === 'ONGOING';
        });

        if (recruitingRound) {
            // Find the registration first
            const registration = await prisma.tournamentRegistration.findUnique({
                where: {
                    tournamentId_userId: {
                        tournamentId,
                        userId: session.user.id
                    }
                }
            });

            if (registration) {
                await prisma.roundParticipant.delete({
                    where: {
                        roundId_registrationId: {
                            roundId: recruitingRound.id,
                            registrationId: registration.id
                        }
                    }
                });

                // If this was the ONLY round participant for this registration across ALL rounds,
                // we COULD delete the registration too, but keeping it for history/center settings is safer.
                // For now, just removing from round is the goal.
            }
        }
    } else {
        // For EVENT or others, delete the whole registration (cascades)
        await prisma.tournamentRegistration.deleteMany({
            where: {
                tournamentId,
                userId: session.user.id
            }
        });
    }

    revalidatePath(`/centers/${tournament.centerId}/tournaments/${tournamentId}`);
}
