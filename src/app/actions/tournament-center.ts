'use server';

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { parseKSTDate } from "@/lib/tournament-utils";
import { redirect } from "next/navigation";
import { verifyCenterAdmin } from "@/lib/auth-utils";

export async function createTournament(centerId: string, formData: FormData) {
    throw new Error("대표에 의해 차단된 기능입니다");
    await verifyCenterAdmin(centerId);

    const type = formData.get("type") as string;
    const iterationStr = formData.get("iteration") as string;
    const iteration = iterationStr ? parseInt(iterationStr) : null;

    let name = formData.get("name") as string;
    if (type === 'LEAGUE' && iteration) {
        name = `제 ${iteration}회차 상주리그`;
    }

    const description = formData.get("description") as string;
    const startDate = parseKSTDate(formData.get("startDate") as string) || new Date();
    const endDate = parseKSTDate(formData.get("endDate") as string) || startDate;
    const maxParticipantsStr = formData.get("maxParticipants") as string;
    const maxParticipants = maxParticipantsStr ? parseInt(maxParticipantsStr) : 0;

    // Validation for CHAMP and EVENT types
    if ((type === 'CHAMP' || type === 'EVENT') && maxParticipants <= 0) {
        throw new Error("참가 정원(최대 인원)을 1명 이상 입력해 주세요.");
    }

    const leagueDayStr = formData.get("leagueDay") as string;
    const leagueDay = leagueDayStr ? parseInt(leagueDayStr) : null;
    const leagueTime = formData.get("leagueTime") as string;

    // Champ specific settings
    const settingsObj: any = {};
    if (type === 'CHAMP') {
        settingsObj.startDateText = formData.get("startDateText");
        settingsObj.gameCount = formData.get("gameCount") ? parseInt(formData.get("gameCount") as string) : 3;
        settingsObj.gameMethod = `올핀 ${settingsObj.gameCount}게임 진행`;
        settingsObj.target = formData.get("target");
        settingsObj.entryFeeText = formData.get("entryFeeText");
        settingsObj.bankAccount = formData.get("bankAccount");
        settingsObj.handicapInfo = formData.get("handicapInfo");
        settingsObj.minusHandicapInfo = formData.get("minusHandicapInfo");
        settingsObj.pattern = formData.get("pattern");
        settingsObj.hasGrandFinale = formData.get("hasGrandFinale");
    } else if (type === 'EVENT') {
        settingsObj.gameMode = formData.get("gameMode"); // INDIVIDUAL, TEAM_2, etc.
        settingsObj.gameCount = formData.get("gameCount") ? parseInt(formData.get("gameCount") as string) : 3;
        settingsObj.gameMethod = `올핀 ${settingsObj.gameCount}게임 진행`;
        settingsObj.target = formData.get("target");
        settingsObj.entryFeeText = formData.get("entryFeeText");
        settingsObj.bankAccount = formData.get("bankAccount");
        settingsObj.handicapInfo = formData.get("handicapInfo");
        settingsObj.pattern = formData.get("pattern");
        settingsObj.registrationStart = formData.get("registrationStart");

        // Multi-person team validation for maxParticipants
        const gameMode = settingsObj.gameMode;
        if (gameMode && gameMode.startsWith('TEAM_')) {
            const teamSize = parseInt(gameMode.split('_')[1]);
            if (maxParticipants % teamSize !== 0) {
                throw new Error(`${teamSize}인조 경기는 참가 정원이 ${teamSize}의 배수여야 합니다. (입력값: ${maxParticipants})`);
            }
        }
    }
    const settings = Object.keys(settingsObj).length > 0 ? JSON.stringify(settingsObj) : null;

    const tournament = await prisma.tournament.create({
        data: {
            name,
            description,
            type,
            iteration,
            startDate,
            endDate: type === 'EVENT' ? startDate : endDate, // For EVENT, end date is same as start
            maxParticipants,
            leagueDay,
            leagueTime,
            settings,
            centerId,
            status: 'PLANNING',
        } as any,
    });

    // Handle CHAMPS round creation
    if (type === 'CHAMP') {
        const roundCountStr = formData.get("roundCount") as string;
        const roundCount = roundCountStr ? parseInt(roundCountStr) : 1;

        if (roundCount > 0) {
            const roundsData = Array.from({ length: roundCount }, (_, i) => ({
                tournamentId: tournament.id,
                roundNumber: i + 1,
            }));

            await (prisma.leagueRound as any).createMany({
                data: roundsData
            });
        }
    } else if (type === 'EVENT') {
        // Create a single round for EVENT type to handle lane assignments and scores
        const round = await (prisma.leagueRound as any).create({
            data: {
                tournamentId: tournament.id,
                roundNumber: 1,
                date: startDate,
                registrationStart: parseKSTDate(settingsObj.registrationStart),
            }
        });

        revalidatePath(`/centers/${centerId}`);
        // For EVENT type, go directly to the round settings page as requested
        redirect(`/centers/${centerId}/tournaments/${tournament.id}/rounds/${round.id}?tab=settings`);
        return;
    }

    revalidatePath(`/centers/${centerId}`);
    redirect(`/centers/${centerId}/tournaments/${tournament.id}`);
}

export async function updateTournamentStatus(tournamentId: string, status: string) {
    const tournament = await prisma.tournament.findUnique({
        where: { id: tournamentId },
        select: { centerId: true }
    });

    if (!tournament) throw new Error("Tournament not found");
    await verifyCenterAdmin(tournament.centerId);

    await prisma.tournament.update({
        where: { id: tournamentId },
        data: { status },
    });

    revalidatePath(`/centers/${tournament.centerId}/tournaments/${tournamentId}`);
}

export async function deleteTournament(tournamentId: string) {
    try {
        const tournament = await prisma.tournament.findUnique({
            where: { id: tournamentId },
            select: { centerId: true, name: true }
        });

        if (!tournament) throw new Error("Tournament not found");
        await verifyCenterAdmin(tournament.centerId);

        console.log(`[DeleteTournament] Deleting tournament: ${tournament.name} (${tournamentId})`);

        await prisma.tournament.delete({
            where: { id: tournamentId },
        });

        revalidatePath(`/centers/${tournament.centerId}`);
        redirect(`/centers/${tournament.centerId}`);
    } catch (error: any) {
        console.error(`[DeleteTournament] Failed to delete tournament ${tournamentId}:`, error);
        throw error;
    }
}

export async function updateTournamentDescription(tournamentId: string, description: string) {
    const tournament = (await (prisma.tournament as any).findUnique({
        where: { id: tournamentId },
        select: { centerId: true }
    })) as any;

    if (!tournament) throw new Error("Tournament not found");
    await verifyCenterAdmin(tournament.centerId);

    await (prisma.tournament as any).update({
        where: { id: tournamentId },
        data: { description },
    });

    revalidatePath(`/centers/${tournament.centerId}/tournaments/${tournamentId}`);
}

export async function uploadTournamentAttachment(tournamentId: string, formData: FormData) {
    const tournament = (await (prisma.tournament as any).findUnique({
        where: { id: tournamentId },
        select: { centerId: true }
    })) as any;

    if (!tournament) throw new Error("Tournament not found");
    await verifyCenterAdmin(tournament.centerId);

    const name = formData.get("name") as string;
    const url = formData.get("url") as string;
    const type = formData.get("type") as string;
    const size = parseInt(formData.get("size") as string) || null;

    await (prisma as any).tournamentAttachment.create({
        data: {
            name,
            url,
            type,
            size,
            tournamentId,
        },
    });

    revalidatePath(`/centers/${tournament.centerId}/tournaments/${tournamentId}`);
}

export async function deleteTournamentAttachment(attachmentId: string) {
    const attachment = (await (prisma as any).tournamentAttachment.findUnique({
        where: { id: attachmentId },
        include: { tournament: true }
    })) as any;

    if (!attachment) throw new Error("Attachment not found");
    await verifyCenterAdmin(attachment.tournament.centerId);

    await (prisma as any).tournamentAttachment.delete({
        where: { id: attachmentId },
    });

    revalidatePath(`/centers/${attachment.tournament.centerId}/tournaments/${attachment.tournamentId}`);
}

export async function updateGrandFinaleSettings(tournamentId: string, grandFinaleSettings: any) {
    const tournament = await (prisma.tournament as any).findUnique({
        where: { id: tournamentId },
        select: { centerId: true, settings: true }
    });

    if (!tournament) throw new Error("Tournament not found");
    await verifyCenterAdmin(tournament.centerId);

    const currentSettings = tournament.settings ? JSON.parse(tournament.settings) : {};
    const newSettings = {
        ...currentSettings,
        ...grandFinaleSettings
    };

    await (prisma.tournament as any).update({
        where: { id: tournamentId },
        data: { settings: JSON.stringify(newSettings) },
    });

    revalidatePath(`/centers/${tournament.centerId}/tournaments/${tournamentId}`);
    return { success: true };
}

export async function updateTournamentBasicInfo(tournamentId: string, formData: FormData) {
    const tournament = await prisma.tournament.findUnique({
        where: { id: tournamentId },
        select: { centerId: true, type: true, settings: true, startDate: true }
    });

    if (!tournament) throw new Error("Tournament not found");
    await verifyCenterAdmin(tournament.centerId);

    const name = formData.get("name") as string;
    const startDateRaw = formData.get("startDate") as string;
    const startDate = (startDateRaw && startDateRaw.trim()) ? parseKSTDate(startDateRaw) : tournament.startDate;

    if (!startDate || isNaN(new Date(startDate).getTime())) {
        throw new Error("올바른 대회 시작 날짜를 입력해주세요.");
    }

    const maxParticipants = parseInt(formData.get("maxParticipants") as string);

    // Validation for CHAMP and EVENT types
    if ((tournament.type === 'CHAMP' || tournament.type === 'EVENT') && (isNaN(maxParticipants) || maxParticipants <= 0)) {
        throw new Error("참가 정원(최대 인원)을 1명 이상 입력해 주세요.");
    }

    const data: any = {
        name,
        startDate,
        maxParticipants: isNaN(maxParticipants) ? 0 : maxParticipants,
    };

    if (tournament.type === 'EVENT' || tournament.type === 'CHAMP') {
        const currentSettings = tournament.settings ? JSON.parse(tournament.settings) : {};
        const newSettings = {
            ...currentSettings,
        };

        if (tournament.type === 'EVENT') {
            newSettings.gameMode = formData.get("gameMode");
            newSettings.gameCount = formData.get("gameCount") ? parseInt(formData.get("gameCount") as string) : 3;
            newSettings.gameMethod = `올핀 ${formData.get("gameCount")}게임 진행`;
            newSettings.target = formData.get("target");
            newSettings.entryFeeText = formData.get("entryFeeText");
            newSettings.bankAccount = formData.get("bankAccount");
            newSettings.handicapInfo = formData.get("handicapInfo");
            newSettings.pattern = formData.get("pattern");
            newSettings.registrationStart = formData.get("registrationStart") ? parseKSTDate(formData.get("registrationStart") as string) : currentSettings.registrationStart;
        } else if (tournament.type === 'CHAMP') {
            newSettings.gameMode = formData.get("gameMode");
            newSettings.startDateText = formData.get("startDateText") || currentSettings.startDateText;
            newSettings.gameCount = formData.get("gameCount") ? parseInt(formData.get("gameCount") as string) : 3;
            newSettings.gameMethod = `올핀 ${newSettings.gameCount}게임 진행`;
            newSettings.target = formData.get("target");
            newSettings.entryFeeText = formData.get("entryFeeText");
            newSettings.bankAccount = formData.get("bankAccount");
            newSettings.handicapInfo = formData.get("handicapInfo");
            newSettings.pattern = formData.get("pattern");
            newSettings.registrationStart = formData.get("registrationStart") ? parseKSTDate(formData.get("registrationStart") as string) : currentSettings.registrationStart;

            // New minus handicap settings
            newSettings.minusHandicapRank1 = formData.get("minusHandicapRank1") ? parseInt(formData.get("minusHandicapRank1") as string) : 0;
            newSettings.minusHandicapRank2 = formData.get("minusHandicapRank2") ? parseInt(formData.get("minusHandicapRank2") as string) : 0;
            newSettings.minusHandicapRank3 = formData.get("minusHandicapRank3") ? parseInt(formData.get("minusHandicapRank3") as string) : 0;
            newSettings.minusHandicapFemale = formData.get("minusHandicapFemale") ? parseInt(formData.get("minusHandicapFemale") as string) : 0;
        }

        // Multi-person team validation for maxParticipants
        const gameMode = newSettings.gameMode;
        if (gameMode && gameMode.startsWith('TEAM_')) {
            const teamSize = parseInt(gameMode.split('_')[1]);
            if (maxParticipants % teamSize !== 0) {
                throw new Error(`${teamSize}인조 경기는 참가 정원이 ${teamSize}의 배수여야 합니다. (입력값: ${maxParticipants})`);
            }
        }

        data.settings = JSON.stringify(newSettings);

        // Also update the associate round date/registrationStart for EVENT
        if (tournament.type === 'EVENT') {
            const rounds = await (prisma.leagueRound as any).findMany({
                where: { tournamentId }
            });

            if (rounds.length > 0) {
                await (prisma.leagueRound as any).update({
                    where: { id: rounds[0].id },
                    data: {
                        date: startDate,
                        registrationStart: newSettings.registrationStart,
                    }
                });
            }
        }
    }

    await prisma.tournament.update({
        where: { id: tournamentId },
        data,
    });

    revalidatePath(`/centers/${tournament.centerId}/tournaments/${tournamentId}`);
    return { success: true };
}
