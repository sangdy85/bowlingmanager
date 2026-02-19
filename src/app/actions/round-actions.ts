'use server';

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { auth } from "@/auth";
import { formatLane, parseKSTDate } from "@/lib/tournament-utils";
import { updateTournamentBasicInfo } from "./tournament-center";

// Helper to get tournament info for revalidation
async function getTournamentInfo(roundId: string) {
    const rounds: any[] = await prisma.$queryRaw`SELECT "tournamentId" FROM "LeagueRound" WHERE id = ${roundId}`;
    if (rounds.length > 0) {
        const tournamentId = rounds[0].tournamentId;
        const tournaments: any[] = await prisma.$queryRaw`SELECT "centerId" FROM "Tournament" WHERE id = ${tournamentId}`;
        if (tournaments.length > 0) {
            return { centerId: tournaments[0].centerId, tournamentId };
        }
    }
    return null;
}

// 1. Update Round Settings (Date, Time)
// 1. Update Round Settings (Date, Time, Lane Movement)
export async function updateRoundSettings(
    roundId: string,
    data: {
        date: string;
        regStart: string;
        regEnd: string;
        moveLaneType?: string;
        moveLaneCount?: number;
        hasFemaleChamp?: boolean;
        // Minus handicap settings (Tournament level but managed here)
        minusHandicapRank1?: number;
        minusHandicapRank2?: number;
        minusHandicapRank3?: number;
        minusHandicapFemale?: number;
    }
) {
    try {
        const date = parseKSTDate(data.date);
        const regStart = parseKSTDate(data.regStart);
        const regEnd = parseKSTDate(data.regEnd);
        const type = data.moveLaneType || null;
        const count = data.moveLaneCount || null;
        const femaleChamp = data.hasFemaleChamp || false;

        // 1. Update Round Dates
        await prisma.$executeRaw`
        UPDATE "LeagueRound" 
        SET "date" = ${date}, 
            "registrationStart" = ${regStart}, 
            "registrationEnd" = ${regEnd},
            "moveLaneType" = ${type},
            "moveLaneCount" = ${count},
            "hasFemaleChamp" = ${femaleChamp}
        WHERE "id" = ${roundId}
    `;

        // 2. Update Tournament-wide settings if minus handicaps are provided (CHAMP only)
        if (data.minusHandicapRank1 !== undefined) {
            const round = await prisma.leagueRound.findUnique({
                where: { id: roundId },
                select: { tournamentId: true }
            });

            if (round) {
                const tournament = await prisma.tournament.findUnique({
                    where: { id: round.tournamentId },
                    select: { settings: true }
                });

                if (tournament) {
                    const settings = tournament.settings ? JSON.parse(tournament.settings) : {};
                    settings.minusHandicapRank1 = data.minusHandicapRank1;
                    settings.minusHandicapRank2 = data.minusHandicapRank2;
                    settings.minusHandicapRank3 = data.minusHandicapRank3;
                    settings.minusHandicapFemale = data.minusHandicapFemale;

                    await prisma.tournament.update({
                        where: { id: round.tournamentId },
                        data: { settings: JSON.stringify(settings) }
                    });
                }
            }
        }

        const info = await getTournamentInfo(roundId);
        if (info) revalidatePath(`/centers/${info.centerId}/tournaments/${info.tournamentId}/rounds/${roundId}`);

        return { success: true };
    } catch (error) {
        console.error("Failed to update round settings:", error);
        throw new Error("설정 저장에 실패했습니다.");
    }
}

// 2. Update Round Participants (Bulk Selection from existing)
export async function updateRoundParticipants(roundId: string, registrationIds: string[], manualRegIds: string[]) {
    try {
        const current: any[] = await prisma.$queryRaw`
            SELECT "registrationId" FROM "RoundParticipant" WHERE "roundId" = ${roundId}
        `;
        const currentIds = current.map((c: any) => c.registrationId);

        const toAdd = registrationIds.filter((id: string) => !currentIds.includes(id));
        const toRemove = currentIds.filter((id: string) => !registrationIds.includes(id));

        if (toRemove.length > 0) {
            await prisma.$executeRaw`
                DELETE FROM "RoundParticipant" 
                WHERE "roundId" = ${roundId} 
                AND "registrationId" IN (${toRemove.map(id => `'${id}'`).join(',')})
            `;
        }

        if (toAdd.length > 0) {
            const data = toAdd.map((regId: string) => ({
                roundId,
                registrationId: regId,
                createdAt: new Date(),
                lane: null,
                isManual: false // Default to false, will be updated below if in manualRegIds
            }));
            await prisma.roundParticipant.createMany({ data });
        }

        // Fix for isManual update via raw query as Prisma Client might have issues
        const participants: any[] = await prisma.$queryRaw`
            SELECT "id", "registrationId" FROM "RoundParticipant" WHERE "roundId" = ${roundId}
        `;

        await prisma.$transaction(
            participants.map((p: any) => {
                const isManual = manualRegIds.includes(p.registrationId);
                return prisma.$executeRaw`
                    UPDATE "RoundParticipant" SET "isManual" = ${isManual} WHERE "id" = ${p.id}
                `;
            })
        );

        const info = await getTournamentInfo(roundId);
        if (info) revalidatePath(`/centers/${info.centerId}/tournaments/${info.tournamentId}/rounds/${roundId}`);

        return { success: true };
    } catch (error) {
        console.error("Failed to update participants:", error);
        throw new Error("참가자 명단 업데이트 실패");
    }
}

// 3. Update Lane Assignment (Manual with Smart Swap)
export async function updateRoundLanes(roundId: string, laneData: { participantId: string, lane: number }[]) {
    try {
        const round = await prisma.leagueRound.findUnique({
            where: { id: roundId },
            include: { participants: true }
        });
        if (!round) throw new Error("라운드 정보를 찾을 수 없습니다.");

        // Helper to find all available slots
        const getAvailableSlots = (participants: any[]) => {
            const laneConfig = round.laneConfig ? JSON.parse(round.laneConfig) : {};
            const takenSlots = new Set(participants.filter((p: any) => p.lane).map((p: any) => p.lane));
            const available: number[] = [];

            if (Object.keys(laneConfig).length > 0) {
                for (const [laneStr, slots] of Object.entries(laneConfig)) {
                    const lane = parseInt(laneStr);
                    const activeSlots = slots as number[];
                    activeSlots.forEach(slot => {
                        const encoded = lane * 10 + slot;
                        if (!takenSlots.has(encoded)) available.push(encoded);
                    });
                }
            } else if ((round as any).startLane && (round as any).endLane) {
                for (let i = (round as any).startLane; i <= (round as any).endLane; i++) {
                    for (let k = 1; k <= 3; k++) {
                        const encoded = i * 10 + k;
                        if (!takenSlots.has(encoded)) available.push(encoded);
                    }
                }
            }
            return available;
        };

        for (const item of laneData) {
            // 1. Check if the target lane is occupied
            const currentParticipants: any[] = await prisma.$queryRaw`
                SELECT id FROM "RoundParticipant" 
                WHERE "roundId" = ${roundId} AND "lane" = ${item.lane} AND "id" != ${item.participantId}
            `;

            if (currentParticipants.length > 0) {
                const occupantId = currentParticipants[0].id;

                // 2. Find a new place for the occupant
                // We need fresh list of participants to avoid conflicts within the same batch
                const updatedParticipants: any[] = await prisma.$queryRaw`
                    SELECT id, lane FROM "RoundParticipant" WHERE "roundId" = ${roundId}
                `;
                const available = getAvailableSlots(updatedParticipants);

                if (available.length > 0) {
                    // Move occupant to first available
                    await prisma.$executeRaw`
                        UPDATE "RoundParticipant" 
                        SET "lane" = ${available[0]}, "isManual" = ${true}
                        WHERE "id" = ${occupantId}
                    `;
                } else {
                    // Nowhere to go, just unassign
                    await prisma.$executeRaw`
                        UPDATE "RoundParticipant" 
                        SET "lane" = null, "isManual" = ${true}
                        WHERE "id" = ${occupantId}
                    `;
                }
            }

            // 3. Assign the target participant
            await prisma.$executeRaw`
                UPDATE "RoundParticipant" 
                SET "lane" = ${item.lane}, "isManual" = ${true}
                WHERE "id" = ${item.participantId}
            `;
        }

        const info = await getTournamentInfo(roundId);
        if (info) revalidatePath(`/centers/${info.centerId}/tournaments/${info.tournamentId}/rounds/${roundId}`);

        return { success: true };
    } catch (error) {
        console.error("Lane update failed:", error);
        throw new Error("레인 배정 저장 실패");
    }
}

// 4. Update Scores
export async function updateRoundScores(
    roundId: string,
    scores: { regId: string, game: number, score: number }[],
    sideGameData?: { regId: string, basic: boolean, ball: boolean, extra: boolean }[]
) {
    try {
        // 1. Update Scores
        for (const item of scores) {
            const existing: any[] = await prisma.$queryRaw`
                SELECT id, score FROM "TournamentScore" 
                WHERE "registrationId" = ${item.regId} 
                AND "roundId" = ${roundId} 
                AND "gameNumber" = ${item.game}
            `;

            if (existing.length > 0) {
                if (existing[0].score !== item.score) {
                    await prisma.$executeRaw`
                        UPDATE "TournamentScore" SET "score" = ${item.score} WHERE "id" = ${existing[0].id}
                    `;
                }
            } else {
                if (item.score > 0) {
                    const id = randomUUID();
                    await prisma.$executeRaw`
                       INSERT INTO "TournamentScore" ("id", "registrationId", "roundId", "gameNumber", "score", "createdAt")
                       VALUES (${id}, ${item.regId}, ${roundId}, ${item.game}, ${item.score}, ${new Date()})
                   `;
                }
            }
        }

        // 2. Update Side Game Flags
        if (sideGameData && sideGameData.length > 0) {
            for (const data of sideGameData) {
                await prisma.$executeRaw`
                    UPDATE "RoundParticipant"
                    SET "sideBasic" = ${data.basic ? 1 : 0},
                        "sideBall" = ${data.ball ? 1 : 0},
                        "sideExtra" = ${data.extra ? 1 : 0}
                    WHERE "roundId" = ${roundId} AND "registrationId" = ${data.regId}
                `;
            }
        }

        const info = await getTournamentInfo(roundId);
        if (info) revalidatePath(`/centers/${info.centerId}/tournaments/${info.tournamentId}/rounds/${roundId}`);

        return { success: true };
    } catch (error) {
        console.error("Score update failed:", error);
        throw new Error("점수 저장 실패");
    }
}

// 4-1. Update Participant Female Champ Status
export async function updateFemaleChampParticipants(roundId: string, femaleChampParticipantIds: string[]) {
    try {
        // Reset all for this round first
        await prisma.$executeRaw`
            UPDATE "RoundParticipant" SET "isFemaleChamp" = 0 WHERE "roundId" = ${roundId}
        `;

        // Set selected ones
        if (femaleChampParticipantIds.length > 0) {
            for (const pId of femaleChampParticipantIds) {
                await prisma.$executeRaw`
                    UPDATE "RoundParticipant" SET "isFemaleChamp" = 1 WHERE "id" = ${pId}
                `;
            }
        }

        const info = await getTournamentInfo(roundId);
        if (info) revalidatePath(`/centers/${info.centerId}/tournaments/${info.tournamentId}/rounds/${roundId}`);

        return { success: true };
    } catch (error) {
        console.error("Female champ update failed:", error);
        throw new Error("여성 챔프 설정 저장 실패");
    }
}

// 5. Manual Register (Guest or Member by Search)
export async function manualRegister(roundId: string, input: {
    type: 'MEMBER' | 'GUEST',
    userId?: string,
    guestName?: string,
    guestTeam?: string,
    handicap?: number
}) {
    try {
        const info = await getTournamentInfo(roundId);
        if (!info) throw new Error("Round info not found");

        let registrationId = '';

        if (input.type === 'MEMBER' && input.userId) {
            const existing: any[] = await prisma.$queryRaw`
                SELECT id FROM "TournamentRegistration" 
                WHERE "tournamentId" = ${info.tournamentId} AND "userId" = ${input.userId}
            `;

            if (existing.length > 0) {
                registrationId = existing[0].id;
            } else {
                registrationId = randomUUID();
                const centerMembers: any[] = await prisma.$queryRaw`
                    SELECT "teamId" FROM "CenterMember" 
                    WHERE "userId" = ${input.userId} AND "centerId" = ${info.centerId}
                `;
                const teamId = centerMembers.length > 0 ? centerMembers[0].teamId : null;
                const handicapVal = input.handicap !== undefined ? input.handicap : null;

                // Fixed: Removed createdAt, updatedAt. Used joinedAt.
                await prisma.$executeRaw`
                    INSERT INTO "TournamentRegistration" ("id", "tournamentId", "userId", "createdAt", "teamId", "guestName", "guestTeamName", "handicap")
                    VALUES (${registrationId}, ${info.tournamentId}, ${input.userId}, ${new Date()}, ${teamId}, null, null, ${handicapVal})
                `;
            }
        } else if (input.type === 'GUEST' && input.guestName) {
            registrationId = randomUUID();
            // Fixed: Removed createdAt, updatedAt. Used joinedAt.
            const handicapVal = input.handicap !== undefined ? input.handicap : null;
            await prisma.$executeRaw`
                INSERT INTO "TournamentRegistration" ("id", "tournamentId", "userId", "createdAt", "teamId", "guestName", "guestTeamName", "handicap")
                VALUES (${registrationId}, ${info.tournamentId}, null, ${new Date()}, null, ${input.guestName}, ${input.guestTeam || null}, ${handicapVal})
            `;
        } else {
            throw new Error("Invalid input");
        }

        const inRound: any[] = await prisma.$queryRaw`
            SELECT id FROM "RoundParticipant" WHERE "roundId" = ${roundId} AND "registrationId" = ${registrationId}
        `;

        if (inRound.length === 0) {
            const rpId = randomUUID();
            await prisma.$executeRaw`
                INSERT INTO "RoundParticipant" ("id", "roundId", "registrationId", "createdAt", "lane")
                VALUES (${rpId}, ${roundId}, ${registrationId}, ${new Date()}, null)
            `;
        }

        if (info) revalidatePath(`/centers/${info.centerId}/tournaments/${info.tournamentId}/rounds/${roundId}`);
        return { success: true };

    } catch (e: any) {
        console.error(e);
        throw new Error("수동 등록 실패: " + e.message);
    }
}

// 6. Join Round (Online User)
export async function joinRound(roundId: string, userId: string) {
    try {
        const info = await getTournamentInfo(roundId);
        if (!info) throw new Error("라운드 정보를 찾을 수 없습니다.");

        const round: any[] = await prisma.$queryRaw`
            SELECT lr."date", lr."registrationStart", lr."registrationEnd", t."leagueTime"
            FROM "LeagueRound" lr
            JOIN "Tournament" t ON lr."tournamentId" = t."id"
            WHERE lr."id" = ${roundId}
        `;
        if (round.length === 0) throw new Error("라운드 없음");

        const leagueTime = round[0].leagueTime;
        const now = new Date();
        const start = round[0].registrationStart ? new Date(round[0].registrationStart) : null;

        let end = round[0].registrationEnd ? new Date(round[0].registrationEnd) : null;
        if (!end && round[0].date) {
            end = new Date(round[0].date);
            if (leagueTime) {
                const [h, m] = leagueTime.split(':').map(Number);
                if (!isNaN(h) && !isNaN(m)) end.setHours(h, m, 0, 0);
            }
        }

        if (start && now < start) throw new Error("접수 기간이 아닙니다.");
        if (end && now > end) throw new Error("접수가 마감되었습니다.");

        let registrationId = '';
        const existing: any[] = await prisma.$queryRaw`
                SELECT id FROM "TournamentRegistration" 
                WHERE "tournamentId" = ${info.tournamentId} AND "userId" = ${userId}
            `;

        if (existing.length > 0) {
            registrationId = existing[0].id;
        } else {
            registrationId = randomUUID();
            // Look up user's team preference for this center
            const centerMembers: any[] = await prisma.$queryRaw`
                SELECT "teamId" FROM "CenterMember" 
                WHERE "userId" = ${userId} AND "centerId" = ${info.centerId}
            `;
            const teamId = centerMembers.length > 0 ? centerMembers[0].teamId : null;

            // Fixed: Removed createdAt, updatedAt. Used joinedAt.
            await prisma.$executeRaw`
                INSERT INTO "TournamentRegistration" ("id", "tournamentId", "userId", "createdAt", "teamId", "guestName", "guestTeamName")
                VALUES (${registrationId}, ${info.tournamentId}, ${userId}, ${new Date()}, ${teamId}, null, null)
            `;
        }

        const inRound: any[] = await prisma.$queryRaw`
            SELECT id FROM "RoundParticipant" WHERE "roundId" = ${roundId} AND "registrationId" = ${registrationId}
        `;

        if (inRound.length === 0) {
            const rpId = randomUUID();
            await prisma.$executeRaw`
                INSERT INTO "RoundParticipant" ("id", "roundId", "registrationId", "createdAt", "lane")
                VALUES (${rpId}, ${roundId}, ${registrationId}, ${new Date()}, null)
            `;
        } else {
            return { success: false, message: "이미 신청했습니다." };
        }

        revalidatePath(`/centers/${info.centerId}/tournaments/${info.tournamentId}`);
        return { success: true };

    } catch (e: any) {
        console.error(e);
        throw new Error(e.message);
    }
}

// 7. Update Lane Settings (Start/End Lane)
export async function updateLaneSettings(roundId: string, startLane: number, endLane: number) {
    try {
        // Use raw query to bypass potential Prisma client type issues with startLane/endLane
        await prisma.$executeRaw`
            UPDATE "LeagueRound"
            SET "startLane" = ${startLane}, "endLane" = ${endLane}
            WHERE "id" = ${roundId}
        `;
        const info = await getTournamentInfo(roundId);
        if (info) revalidatePath(`/centers/${info.centerId}/tournaments/${info.tournamentId}/rounds/${roundId}`);
        return { success: true };
    } catch (error) {
        console.error("Lane settings update failed:", error);
        throw new Error("레인 설정 저장 실패");
    }
}

// 7-1. Update Lane Config (JSON)
export async function updateLaneConfig(roundId: string, config: string) {
    try {
        await prisma.leagueRound.update({
            where: { id: roundId },
            data: {
                laneConfig: config
            }
        });

        const info = await getTournamentInfo(roundId);
        if (info) revalidatePath(`/centers/${info.centerId}/tournaments/${info.tournamentId}/rounds/${roundId}`);

        return { success: true };
    } catch (error) {
        console.error("Lane config update failed:", error);
        throw new Error("레인 상세 설정 저장 실패");
    }
}

// 8. Auto Assign Remaining Danes (Admin)
export async function autoAssignRemaining(roundId: string) {
    try {
        const round = await prisma.leagueRound.findUnique({
            where: { id: roundId },
            include: { participants: true }
        });

        if (!round) throw new Error("Round not found");

        const laneConfig = round.laneConfig ? JSON.parse(round.laneConfig) : {};
        const allSlots: { lane: number, slot: number }[] = [];

        // Build all available slots based on config
        for (const [laneStr, slots] of Object.entries(laneConfig)) {
            const lane = parseInt(laneStr);
            const activeSlots = slots as number[];
            activeSlots.forEach(slot => {
                allSlots.push({ lane, slot }); // Slot logic is just for count, but we track them if needed. 
                // Actually, simple lane assignment just needs to know capacity. 
                // If config says lane 1 has slots [1,2,3], it means capacity is 3. 
            });
        }

        // If no config, fallback to default (start-end, 3 per lane?) 
        // Better to require config for this advanced feature, or fallback to start-end with 3 per lane.
        if (Object.keys(laneConfig).length === 0 && (round as any).startLane && (round as any).endLane) {
            for (let i = (round as any).startLane; i <= (round as any).endLane; i++) {
                allSlots.push({ lane: i, slot: 1 });
                allSlots.push({ lane: i, slot: 2 });
                allSlots.push({ lane: i, slot: 3 });
            }
        }

        // Filter out taken spots
        const assignedParticipants = round.participants.filter((p: any) => p.lane);
        const takenSlots = new Set(assignedParticipants.map((p: any) => p.lane));

        // Available slots pool (encoded as lane * 10 + slot)
        const availableSlots: number[] = [];

        if (Object.keys(laneConfig).length > 0) {
            for (const [laneStr, slots] of Object.entries(laneConfig)) {
                const lane = parseInt(laneStr);
                const activeSlots = slots as number[];
                activeSlots.forEach(slot => {
                    const encoded = lane * 10 + slot;
                    if (!takenSlots.has(encoded)) {
                        availableSlots.push(encoded);
                    }
                });
            }
        } else if ((round as any).startLane && (round as any).endLane) {
            // Default logic if no config
            for (let i = (round as any).startLane; i <= (round as any).endLane; i++) {
                for (let k = 1; k <= 3; k++) {
                    const encoded = i * 10 + k;
                    if (!takenSlots.has(encoded)) {
                        availableSlots.push(encoded);
                    }
                }
            }
        }

        // Unassigned participants
        const unassigned = round.participants.filter(p => !p.lane);

        if (availableSlots.length < unassigned.length) {
            throw new Error(`자리가 부족합니다. (남은 자리: ${availableSlots.length}, 대기 인원: ${unassigned.length})`);
        }

        // Shuffle available slots
        for (let i = availableSlots.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [availableSlots[i], availableSlots[j]] = [availableSlots[j], availableSlots[i]];
        }

        // Shuffle unassigned participants for even better randomness
        const shuffledUnassigned = [...unassigned];
        for (let i = shuffledUnassigned.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffledUnassigned[i], shuffledUnassigned[j]] = [shuffledUnassigned[j], shuffledUnassigned[i]];
        }

        // Assign
        for (let i = 0; i < shuffledUnassigned.length; i++) {
            const encodedLane = availableSlots[i];
            await prisma.$executeRaw`
                UPDATE "RoundParticipant"
                SET "lane" = ${encodedLane}, "isManual" = ${false}
                WHERE "id" = ${shuffledUnassigned[i].id}
            `;
        }

        const info = await getTournamentInfo(roundId);
        if (info) revalidatePath(`/centers/${info.centerId}/tournaments/${info.tournamentId}/rounds/${roundId}`);

        return { success: true, message: `${unassigned.length}명 배정 완료` };

    } catch (error: any) {
        console.error("Auto assign failed:", error);
        throw new Error(error.message || "자동 배정 실패");
    }
}

// 9. Draw Lane (User Lottery)
export async function drawLane(roundId: string, registrationId: string) {
    const session = await auth();
    const userId = session?.user?.id;

    try {
        const round = await prisma.leagueRound.findUnique({
            where: { id: roundId },
            include: {
                participants: {
                    include: { registration: true }
                },
                tournament: true
            }
        });
        if (!round) throw new Error("Round not found");

        // 2. Identify participant
        let participant;
        if (registrationId) {
            participant = round.participants.find(p => p.registrationId === registrationId);
        } else if (userId) {
            participant = round.participants.find(p => p.registration.userId === userId);
        }

        if (!participant) throw new Error("참가자가 아니거나 권한이 없습니다.");
        if (participant.lane) throw new Error(`이미 ${formatLane(participant.lane)}번 레인을 배정받았습니다.`);

        // 3. Find available slots (Encoded as Lane * 10 + Slot)
        const laneConfig = round.laneConfig ? JSON.parse(round.laneConfig) : {};
        const assignedParticipants = round.participants.filter((p: any) => p.lane);
        const takenSlots = new Set(assignedParticipants.map((p: any) => p.lane));

        const availableSlots: number[] = [];
        if (Object.keys(laneConfig).length > 0) {
            for (const [laneStr, slots] of Object.entries(laneConfig)) {
                const lane = parseInt(laneStr);
                const activeSlots = slots as number[];
                activeSlots.forEach(slot => {
                    const encoded = lane * 10 + slot;
                    if (!takenSlots.has(encoded)) {
                        availableSlots.push(encoded);
                    }
                });
            }
        } else if ((round as any).startLane && (round as any).endLane) {
            for (let i = (round as any).startLane; i <= (round as any).endLane; i++) {
                for (let k = 1; k <= 3; k++) {
                    const encoded = i * 10 + k;
                    if (!takenSlots.has(encoded)) {
                        availableSlots.push(encoded);
                    }
                }
            }
        }

        if (availableSlots.length === 0) throw new Error("남은 레인이 없습니다.");

        // --- Team Set Assignment Logic ---
        const entryGroupId = participant.registration.entryGroupId;
        if (entryGroupId) {
            const groupMembers = round.participants.filter((p: any) => p.registration.entryGroupId === entryGroupId)
                .sort((a: any, b: any) => a.registration.createdAt.getTime() - b.registration.createdAt.getTime());

            const groupSize = groupMembers.length;

            // Find valid contiguous blocks
            const validBlocks: number[][] = [];
            for (let i = 0; i < availableSlots.length; i++) {
                const block = [availableSlots[i]];
                for (let j = 1; j < groupSize; j++) {
                    const next = availableSlots.find((s: number) => s === availableSlots[i] + j);
                    if (next) block.push(next);
                }

                if (block.length === groupSize) {
                    // Check if contiguous (same lane)
                    const isContiguous = block.every((slot: number) => Math.floor(slot / 10) === Math.floor(block[0] / 10));
                    if (isContiguous) {
                        const anyAssigned = groupMembers.some((m: any) => m.lane);
                        if (!anyAssigned) {
                            validBlocks.push(block);
                        }
                    }
                }
            }

            if (validBlocks.length === 0) throw new Error("팀원들이 나란히 앉을 수 있는 연속된 자리가 부족합니다.");

            // Pick random block
            const randomBlockIndex = Math.floor(Math.random() * validBlocks.length);
            const pickedBlock = validBlocks[randomBlockIndex];

            // Assign ALL members in the group
            await prisma.$transaction(
                groupMembers.map((member: any, idx: number) =>
                    prisma.$executeRaw`
                        UPDATE "RoundParticipant"
                        SET "lane" = ${pickedBlock[idx]}, "isManual" = ${false}
                        WHERE "id" = ${member.id}
                    `
                )
            );

            const info = await getTournamentInfo(roundId);
            if (info) revalidatePath(`/centers/${info.centerId}/tournaments/${info.tournamentId}/rounds/${roundId}`);

            const myIdxInGroup = groupMembers.findIndex((m: any) => m.id === participant.id);
            return { success: true, lane: pickedBlock[myIdxInGroup] };
        }

        // --- Original Single Participant Logic ---
        // Pick random
        const randomIndex = Math.floor(Math.random() * availableSlots.length);
        const pickedSlot = availableSlots[randomIndex];

        // Save
        await prisma.$executeRaw`
            UPDATE "RoundParticipant"
            SET "lane" = ${pickedSlot}, "isManual" = ${false}
            WHERE "id" = ${participant.id}
        `;

        const info = await getTournamentInfo(roundId);
        if (info) revalidatePath(`/centers/${info.centerId}/tournaments/${info.tournamentId}/rounds/${roundId}`);

        return { success: true, lane: pickedSlot };

    } catch (error: any) {
        console.error("Draw lane failed:", error);
        throw new Error(error.message || "추첨 실패");
    }
}

// 10. Update Payment Status
export async function updatePaymentStatus(registrationId: string, status: string) {
    try {
        await prisma.$executeRaw`
            UPDATE "TournamentRegistration" SET "paymentStatus" = ${status} WHERE "id" = ${registrationId}
        `;
        // We need to revalidate paths. Since we don't have roundId directly here, 
        // we'll fetch it or just rely on the client refreshing. 
        // Fetching tournamentId to revalidate broadly.
        const regs: any[] = await prisma.$queryRaw`SELECT "tournamentId" FROM "TournamentRegistration" WHERE id = ${registrationId}`;
        if (regs.length > 0) {
            const tournamentId = regs[0].tournamentId;
            const tournaments: any[] = await prisma.$queryRaw`SELECT "centerId" FROM "Tournament" WHERE id = ${tournamentId}`;
            if (tournaments.length > 0) {
                revalidatePath(`/centers/${tournaments[0].centerId}/tournaments/${tournamentId}`);
            }
        }
        return { success: true };
    } catch (e: any) {
        throw new Error("입금 상태 업데이트 실패");
    }
}

// 10. Delete Registration
export async function deleteRegistration(registrationId: string) {
    try {
        const regs: any[] = await prisma.$queryRaw`SELECT "tournamentId" FROM "TournamentRegistration" WHERE id = ${registrationId}`;
        if (regs.length === 0) throw new Error("Registration not found");

        const tournamentId = regs[0].tournamentId;
        const tournaments: any[] = await prisma.$queryRaw`SELECT "centerId" FROM "Tournament" WHERE id = ${tournamentId}`;

        // Delete Registration (Cascades will handle RoundParticipant and TournamentScore)
        await prisma.$executeRaw`DELETE FROM "TournamentRegistration" WHERE id = ${registrationId}`;

        if (tournaments.length > 0) {
            revalidatePath(`/centers/${tournaments[0].centerId}/tournaments/${tournamentId}`);
        }
        return { success: true };
    } catch (e: any) {
        console.error(e);
        throw new Error("참가자 삭제 실패");
    }
}

// 11. Update Registration (Edit info)
export async function updateRegistration(
    registrationId: string,
    data: { guestName?: string, guestTeamName?: string, handicap?: number }
) {
    try {
        const regs: any[] = await prisma.$queryRaw`SELECT "tournamentId" FROM "TournamentRegistration" WHERE id = ${registrationId}`;
        if (regs.length === 0) throw new Error("Registration not found");

        const handicapVal = data.handicap !== undefined ? data.handicap : undefined;

        // Use Prisma Client for simpler conditional updates if possible, 
        // but since we've been using raw queries for RoundParticipant, 
        // let's stick to standard prisma for this simple update.
        await (prisma as any).tournamentRegistration.update({
            where: { id: registrationId },
            data: {
                guestName: data.guestName,
                guestTeamName: data.guestTeamName,
                handicap: handicapVal
            }
        });

        const tournamentId = regs[0].tournamentId;
        const tournaments: any[] = await prisma.$queryRaw`SELECT "centerId" FROM "Tournament" WHERE id = ${tournamentId}`;
        if (tournaments.length > 0) {
            revalidatePath(`/centers/${tournaments[0].centerId}/tournaments/${tournamentId}`);
        }

        return { success: true };
    } catch (e: any) {
        console.error(e);
        throw new Error("정보 수정 실패: " + e.message);
    }
}

// 12. Update Lucky Draw Result
export async function updateLuckyDrawResult(roundId: string, result: string | null) {
    try {
        await prisma.leagueRound.update({
            where: { id: roundId },
            // @ts-ignore - Field exists but prisma client generation is locked
            data: { luckyDrawResult: result }
        });

        const info = await getTournamentInfo(roundId);
        if (info) revalidatePath(`/centers/${info.centerId}/tournaments/${info.tournamentId}/rounds/${roundId}`);

        return { success: true };
    } catch (error) {
        console.error("Failed to update lucky draw result:", error);
        throw new Error("추첨 결과 저장에 실패했습니다.");
    }
}

// 13. Search Players for Manual Registration
export async function searchPlayers(query: string, centerId: string) {
    if (!query || query.length < 1) return [];
    try {
        const users: any[] = await prisma.$queryRaw`
            SELECT u.id, u.name, t.name as "teamName", u.handicap
            FROM "User" u
            JOIN "CenterMember" cm ON u.id = cm."userId"
            LEFT JOIN "Team" t ON cm."teamId" = t.id
            WHERE (u.name LIKE ${`%${query}%`} OR t.name LIKE ${`%${query}%`})
            AND cm."centerId" = ${centerId}
            ORDER BY u.name ASC
            LIMIT 50
        `;

        // Defensive deduplication in JavaScript
        const uniqueUsersMap = new Map();
        users.forEach(user => {
            if (!uniqueUsersMap.has(user.id)) {
                uniqueUsersMap.set(user.id, user);
            } else {
                // If already exists, prefer one with a team name if the current one has none
                const existing = uniqueUsersMap.get(user.id);
                if (!existing.teamName && user.teamName) {
                    uniqueUsersMap.set(user.id, user);
                }
            }
        });

        return Array.from(uniqueUsersMap.values()).slice(0, 10);
    } catch (error) {
        console.error("Search players failed:", error);
        return [];
    }
}

// 14. Auto Cancel Unpaid Registrations
export async function checkAndCancelUnpaidRegistrations(roundId: string) {
    try {
        const info = await getTournamentInfo(roundId);
        if (!info) return { count: 0 };

        // Get Pending Registrations
        const pendingRegs: any[] = await prisma.$queryRaw`
            SELECT id, "createdAt" 
            FROM "TournamentRegistration" 
            WHERE "tournamentId" = ${info.tournamentId} 
            AND "paymentStatus" = 'PENDING'
        `;

        if (!pendingRegs || pendingRegs.length === 0) return { count: 0 };

        const now = new Date();
        const idsToCancel: string[] = [];

        for (const reg of pendingRegs) {
            const createdAt = new Date(reg.createdAt);
            // Rule: 72 hours passed AND it is past 23:59:59 of that day
            const targetDate = new Date(createdAt);
            targetDate.setDate(targetDate.getDate() + 3); // +72 hours
            targetDate.setHours(23, 59, 59, 999); // End of that day

            if (now > targetDate) {
                idsToCancel.push(reg.id);
            }
        }

        if (idsToCancel.length > 0) {
            // Bulk Update Status
            // Use raw query to avoid Prisma Client type issues with isManual
            for (const id of idsToCancel) {
                await prisma.$executeRaw`
                    UPDATE "TournamentRegistration" SET "paymentStatus" = 'CANCELED' WHERE "id" = ${id}
                `;
            }

            // Remove Lane Assignment
            for (const id of idsToCancel) {
                await prisma.$executeRaw`
                    UPDATE "RoundParticipant" SET "lane" = null, "isManual" = false WHERE "registrationId" = ${id}
                `;
            }

            revalidatePath(`/centers/${info.centerId}/tournaments/${info.tournamentId}/rounds/${roundId}`);
        }

        return { count: idsToCancel.length };

    } catch (e) {
        console.error("Auto cancel failed", e);
        return { count: 0 };
    }
}
