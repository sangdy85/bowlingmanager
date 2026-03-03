'use server';

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { auth } from "@/auth";
import { formatLane, parseKSTDate } from "@/lib/tournament-utils";
import { updateTournamentBasicInfo } from "./tournament-center";

// Helper to get tournament info for revalidation
async function getTournamentInfo(roundId: string) {
    const rounds: any[] = await prisma.$queryRaw`SELECT tournamentId FROM LeagueRound WHERE id = ${roundId}`;
    if (rounds.length > 0) {
        const tournamentId = rounds[0].tournamentId;
        const tournaments: any[] = await prisma.$queryRaw`SELECT centerId, type FROM Tournament WHERE id = ${tournamentId}`;
        if (tournaments.length > 0) {
            return { centerId: tournaments[0].centerId, tournamentId, type: tournaments[0].type };
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
        maxParticipants?: number;
    }
) {
    try {
        // 1. Fetch current round to preserve dates if not provided
        const currentRound = await prisma.leagueRound.findUnique({
            where: { id: roundId },
            select: { date: true, registrationStart: true, registrationEnd: true }
        });

        const date = data.date ? parseKSTDate(data.date) : currentRound?.date;
        const regStart = data.regStart ? parseKSTDate(data.regStart) : currentRound?.registrationStart;
        const regEnd = data.regEnd ? parseKSTDate(data.regEnd) : currentRound?.registrationEnd;

        const type = data.moveLaneType || null;
        const count = data.moveLaneCount || null;
        const femaleChamp = data.hasFemaleChamp || false;

        // 2. Update Round Dates
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
                select: { tournamentId: true, roundNumber: true }
            });

            if (round) {
                const tournament = await prisma.tournament.findUnique({
                    where: { id: round.tournamentId },
                    select: { settings: true }
                });

                if (tournament) {
                    const settings = tournament.settings ? JSON.parse(tournament.settings) : {};
                    // Store round-specific minus handicaps
                    if (!settings.roundMinusHandicaps) {
                        settings.roundMinusHandicaps = {};
                    }
                    settings.roundMinusHandicaps[round.roundNumber] = {
                        rank1: data.minusHandicapRank1,
                        rank2: data.minusHandicapRank2,
                        rank3: data.minusHandicapRank3,
                        female: data.minusHandicapFemale
                    };

                    // Store round-specific max participants
                    if (data.maxParticipants !== undefined) {
                        if (!settings.roundMaxParticipants) {
                            settings.roundMaxParticipants = {};
                        }
                        settings.roundMaxParticipants[round.roundNumber] = data.maxParticipants;
                    }

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
            const regs = await prisma.tournamentRegistration.findMany({
                where: { id: { in: toAdd } },
                select: { id: true, handicap: true }
            });
            const data = regs.map((r: any) => ({
                roundId,
                registrationId: r.id,
                handicap: r.handicap ?? 0,
                createdAt: new Date(),
                lane: null,
                isManual: false
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

// 2-1. Update Entry Group ID (Explicit Grouping for Event Tournaments)
export async function updateEntryGroupId(roundId: string, registrationIds: string[], groupId: string | null) {
    try {
        if (registrationIds.length > 0) {
            await prisma.tournamentRegistration.updateMany({
                where: { id: { in: registrationIds } },
                data: { entryGroupId: groupId }
            });
        }

        const info = await getTournamentInfo(roundId);
        if (info) revalidatePath(`/centers/${info.centerId}/tournaments/${info.tournamentId}/rounds/${roundId}`);

        return { success: true };
    } catch (error) {
        console.error("Failed to update entryGroupId:", error);
        throw new Error("그룹화 저장 실패");
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
                const cappedScore = Math.min(item.score, 300);
                if (existing[0].score !== cappedScore) {
                    await prisma.$executeRaw`
                        UPDATE "TournamentScore" SET "score" = ${cappedScore} WHERE "id" = ${existing[0].id}
                    `;
                }
            } else {
                if (item.score > 0) {
                    const id = randomUUID();
                    const cappedScore = Math.min(item.score, 300);
                    await prisma.$executeRaw`
                       INSERT INTO "TournamentScore" ("id", "registrationId", "roundId", "gameNumber", "score", "createdAt")
                       VALUES (${id}, ${item.regId}, ${roundId}, ${item.game}, ${cappedScore}, ${new Date()})
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

        const isChampOrLeague = info.type === 'CHAMP' || info.type === 'LEAGUE';
        let registrationId = '';

        if (input.type === 'MEMBER' && input.userId) {
            // Check for existing registration in this tournament
            const existing = await prisma.tournamentRegistration.findFirst({
                where: {
                    tournamentId: info.tournamentId,
                    userId: input.userId
                }
            });

            if (existing) {
                registrationId = existing.id;
            } else {
                registrationId = randomUUID();
                // Fetch User name and Team name for snapshotting
                const userMember = await prisma.centerMember.findUnique({
                    where: { userId_centerId: { userId: input.userId, centerId: info.centerId } },
                    include: { User: true, Team: true }
                });

                const teamId = userMember?.teamId || null;
                const snapName = userMember?.User?.name || null;
                const snapTeamName = userMember?.Team?.name || null;
                const handicapVal = input.handicap !== undefined ? input.handicap : (userMember?.User?.handicap || 0);

                await prisma.tournamentRegistration.create({
                    data: {
                        id: registrationId,
                        tournamentId: info.tournamentId,
                        userId: input.userId,
                        teamId: teamId,
                        guestName: snapName,
                        guestTeamName: snapTeamName,
                        handicap: handicapVal,
                        paymentStatus: 'PENDING'
                    }
                });
            }
        } else if (input.type === 'GUEST' && input.guestName) {
            // [LINKING LOGIC] Check if this guest is actually a member of this center
            const trimmedName = input.guestName.trim();
            const trimmedTeam = input.guestTeam?.trim() || '';

            const memberMatch = await prisma.centerMember.findFirst({
                where: {
                    centerId: info.centerId,
                    OR: [
                        { User: { name: trimmedName } },
                        { alias: trimmedName }
                    ],
                    ...(trimmedTeam
                        ? { Team: { name: trimmedTeam } }
                        : { teamId: null }
                    )
                },
                include: { Team: true, User: true }
            });

            // [CRITICAL] Check if this member is already registered in the tournament
            let existing: any = null;
            if (memberMatch?.userId) {
                existing = await prisma.tournamentRegistration.findFirst({
                    where: { tournamentId: info.tournamentId, userId: memberMatch.userId }
                });
            } else {
                // If pure guest, check by name+team
                existing = await prisma.tournamentRegistration.findFirst({
                    where: {
                        tournamentId: info.tournamentId,
                        userId: null,
                        guestName: trimmedName,
                        guestTeamName: trimmedTeam || null
                    }
                });
            }

            if (existing) {
                registrationId = existing.id;
            } else {
                registrationId = randomUUID();
                const handicapVal = input.handicap !== undefined ? input.handicap : null;

                await prisma.tournamentRegistration.create({
                    data: {
                        id: registrationId,
                        tournamentId: info.tournamentId,
                        userId: memberMatch?.userId || null,
                        teamId: memberMatch?.teamId || null,
                        guestName: trimmedName,
                        guestTeamName: trimmedTeam || null,
                        handicap: handicapVal,
                        paymentStatus: 'PENDING'
                    }
                });
            }
        } else {
            throw new Error("Invalid input");
        }

        const inRound = await prisma.roundParticipant.findUnique({
            where: {
                roundId_registrationId: {
                    roundId,
                    registrationId
                }
            }
        });

        if (!inRound) {
            const rpId = randomUUID();
            // Use input handicap if provided, otherwise fallback to registration's handicap
            let finalHandicap = input.handicap;
            if (finalHandicap === undefined) {
                const reg = await prisma.tournamentRegistration.findUnique({
                    where: { id: registrationId },
                    select: { handicap: true }
                });
                finalHandicap = reg?.handicap ?? 0;
            }

            await prisma.roundParticipant.create({
                data: {
                    id: rpId,
                    roundId,
                    registrationId,
                    lane: null,
                    handicap: finalHandicap
                }
            });
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

        const round = await prisma.leagueRound.findUnique({
            where: { id: roundId },
            include: { tournament: true }
        });

        if (!round) throw new Error("라운드 없음");

        const leagueTime = round.tournament.leagueTime;
        const now = new Date();
        const start = round.registrationStart ? new Date(round.registrationStart) : null;

        let end = round.registrationEnd ? new Date(round.registrationEnd) : null;
        if (!end && round.date) {
            end = new Date(round.date);
            if (leagueTime) {
                const [h, m] = leagueTime.split(':').map(Number);
                if (!isNaN(h) && !isNaN(m)) end.setHours(h, m, 0, 0);
            }
        }

        if (start && now < start) throw new Error("접수 기간이 아닙니다.");
        if (end && now > end) throw new Error("접수가 마감되었습니다.");

        let registrationId = '';
        const existing = await prisma.tournamentRegistration.findFirst({
            where: {
                tournamentId: info.tournamentId,
                userId: userId
            }
        });

        if (existing.length > 0) {
            registrationId = (existing[0] as any).id;
        } else {
            // [LINKING LOGIC] Check if there's a manual GUEST registration with matching Name + Team
            const userMember = await prisma.centerMember.findUnique({
                where: { userId_centerId: { userId, centerId: info.centerId } },
                include: { User: true, Team: true }
            });

            const userName = userMember?.User?.name || null;
            const userTeamName = userMember?.Team?.name || '';

            const manualMatch = await prisma.tournamentRegistration.findFirst({
                where: {
                    tournamentId: info.tournamentId,
                    userId: null,
                    guestName: userName,
                    guestTeamName: userTeamName || null
                }
            });

            if (manualMatch) {
                registrationId = manualMatch.id;
                // Link this manual registration to the user
                await prisma.tournamentRegistration.update({
                    where: { id: registrationId },
                    data: {
                        userId: userId,
                        teamId: userMember?.teamId || null
                    }
                });
            } else {
                registrationId = randomUUID();
                await prisma.tournamentRegistration.create({
                    data: {
                        id: registrationId,
                        tournamentId: info.tournamentId,
                        userId: userId,
                        teamId: userMember?.teamId || null,
                        paymentStatus: 'PENDING'
                    }
                });
            }
        }

        const inRound = await prisma.roundParticipant.findUnique({
            where: {
                roundId_registrationId: {
                    roundId,
                    registrationId
                }
            }
        });

        if (!inRound) {
            const rpId = randomUUID();
            // Fetch registration's handicap as the default for this round
            const regData = await prisma.tournamentRegistration.findUnique({
                where: { id: registrationId },
                select: { handicap: true }
            });
            const finalHandicap = regData?.handicap ?? 0;

            await prisma.roundParticipant.create({
                data: {
                    id: rpId,
                    roundId,
                    registrationId,
                    lane: null,
                    handicap: finalHandicap
                }
            });
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
            include: {
                participants: {
                    include: { registration: true }
                },
                tournament: true
            }
        });

        if (!round) throw new Error("Round not found");

        // 1. Determine team size from settings
        const settings = round.tournament.settings ? JSON.parse(round.tournament.settings) : {};
        const gameMode = settings.gameMode || 'INDIVIDUAL';
        const teamSize = gameMode.startsWith('TEAM_') ? parseInt(gameMode.split('_')[1]) : 1;

        // 2. Fetch all participants of this round, sorted by registration date to establish "sequence"
        const maxParticipants = round.tournament.maxParticipants || settings.maxParticipants || 0;
        const allParticipants = [...round.participants].sort((a: any, b: any) =>
            new Date(a.createdAt).valueOf() - new Date(b.createdAt).valueOf()
        );

        const waitlistedRegIds = new Set(
            allParticipants
                .filter((_, idx) => maxParticipants > 0 && idx + 1 > maxParticipants)
                .map(p => p.registrationId)
        );

        const laneConfig = round.laneConfig ? JSON.parse(round.laneConfig) : {};
        const assignedParticipants = round.participants.filter((p: any) => p.lane);
        const takenSlots = new Set(assignedParticipants.map((p: any) => p.lane));

        // Group available slots by lane
        const laneToSlots = new Map<number, number[]>();
        if (Object.keys(laneConfig).length > 0) {
            for (const [laneStr, slots] of Object.entries(laneConfig)) {
                const lane = parseInt(laneStr);
                const activeSlots = slots as number[];
                activeSlots.forEach(slot => {
                    const encoded = lane * 10 + slot;
                    if (!takenSlots.has(encoded)) {
                        if (!laneToSlots.has(lane)) laneToSlots.set(lane, []);
                        laneToSlots.get(lane)!.push(encoded);
                    }
                });
            }
        } else if ((round as any).startLane && (round as any).endLane) {
            for (let i = (round as any).startLane; i <= (round as any).endLane; i++) {
                for (let k = 1; k <= 3; k++) {
                    const encoded = i * 10 + k;
                    if (!takenSlots.has(encoded)) {
                        if (!laneToSlots.has(i)) laneToSlots.set(i, []);
                        laneToSlots.get(i)!.push(encoded);
                    }
                }
            }
        }

        // Unassigned participants (Excluding waitlisted)
        const unassigned = round.participants.filter((p: any) => !p.lane && !waitlistedRegIds.has(p.registrationId));
        const totalAvailableCount = Array.from(laneToSlots.values()).reduce((acc, curr) => acc + curr.length, 0);

        if (totalAvailableCount < unassigned.length) {
            throw new Error(`자리가 부족합니다. (남은 자리: ${totalAvailableCount}, 배정 필요한 인원: ${unassigned.length})`);
        }

        // Explicit Groups Check: Ensure they match the team size (Excluding waitlisted)
        const matchableParticipants = allParticipants.filter(p => !waitlistedRegIds.has(p.registrationId));
        const explicitGroups = new Map<string, any[]>();

        matchableParticipants.forEach(p => {
            if (p.registration.entryGroupId) {
                if (!explicitGroups.has(p.registration.entryGroupId)) explicitGroups.set(p.registration.entryGroupId, []);
                explicitGroups.get(p.registration.entryGroupId)!.push(p);
            }
        });

        // 3a. Validation: Check if any group violates the team size rules
        const errorDetails = [];
        for (const [groupId, members] of Array.from(explicitGroups.entries())) {
            if (members.length > teamSize) {
                const groupNum = groupId.startsWith('group_') ? groupId.replace('group_', '') : groupId;
                errorDetails.push(`${groupNum}조 인원이 초과되었습니다. (정원: ${teamSize}명, 현재: ${members.length}명)`);
            } else if (members.length < teamSize) {
                const groupNum = groupId.startsWith('group_') ? groupId.replace('group_', '') : groupId;
                errorDetails.push(`${groupNum}조 인원이 미달입니다. (정원: ${teamSize}명, 현재: ${members.length}명)`);
            }
        }

        if (errorDetails.length > 0) {
            throw new Error(errorDetails.join('\n'));
        }

        const groups: any[][] = [];
        const groupedParticipantIds = new Set<string>();

        explicitGroups.forEach(members => {
            groups.push(members);
            members.forEach(m => groupedParticipantIds.add(m.id));
        });

        // 3b. Group remaining by sequence (Excluding waitlisted)
        const remainingParticipants = matchableParticipants.filter(p => !groupedParticipantIds.has(p.id));
        for (let i = 0; i < remainingParticipants.length; i += teamSize) {
            groups.push(remainingParticipants.slice(i, i + teamSize));
        }

        // 4. Filter groups that have unassigned members
        const groupsWithUnassigned = Array.from(groups.values()).filter(g => g.some(p => !p.lane));

        // Randomly shuffle unassigned groups for fairness in lane picking
        for (let i = groupsWithUnassigned.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [groupsWithUnassigned[i], groupsWithUnassigned[j]] = [groupsWithUnassigned[j], groupsWithUnassigned[i]];
        }

        const assignments: { id: string, lane: number }[] = [];

        // 5. Assign groups
        if (teamSize === 2) {
            // Special logic for TEAM_2: Fill slots sequentially across lanes to avoid gaps
            const allAvailableSlots: number[] = [];
            const sortedLanes = Array.from(laneToSlots.keys()).sort((a, b) => a - b);
            sortedLanes.forEach(lane => {
                const slots = laneToSlots.get(lane)!.sort((a, b) => a - b);
                allAvailableSlots.push(...slots);
            });

            for (const group of groupsWithUnassigned) {
                const unassignedInGroup = group.filter(p => !p.lane);
                unassignedInGroup.forEach(p => {
                    if (allAvailableSlots.length > 0) {
                        const pickedSlot = allAvailableSlots.shift()!;
                        assignments.push({ id: p.id, lane: pickedSlot });
                    }
                });
            }
        } else {
            // Default logic for other sizes: Try to fit in a single lane
            for (const group of groupsWithUnassigned) {
                const unassignedInGroup = group.filter(p => !p.lane);
                const sizeNeeded = unassignedInGroup.length;

                // Try to find a lane that can fit everyone unassigned in this group
                const availableLanes = Array.from(laneToSlots.keys());
                // Randomly shuffle lanes to check
                for (let i = availableLanes.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [availableLanes[i], availableLanes[j]] = [availableLanes[j], availableLanes[i]];
                }

                let assigned = false;
                for (const lane of availableLanes) {
                    const slots = laneToSlots.get(lane)!;
                    if (slots.length >= sizeNeeded) {
                        const picked = slots.splice(0, sizeNeeded);
                        unassignedInGroup.forEach((p, idx) => {
                            assignments.push({ id: p.id, lane: picked[idx] });
                        });
                        assigned = true;
                        break;
                    }
                }

                if (!assigned) {
                    // Last resort: If no single lane has enough space, split these unassigned members 
                    // into individual pool to be handled at the end
                    unassignedInGroup.forEach(p => {
                        const allSlotsPool: number[] = [];
                        laneToSlots.forEach(s => allSlotsPool.push(...s));
                        if (allSlotsPool.length > 0) {
                            const randomIndex = Math.floor(Math.random() * allSlotsPool.length);
                            const pickedSlot = allSlotsPool[randomIndex];
                            assignments.push({ id: p.id, lane: pickedSlot });

                            // Remove from laneToSlots
                            const laneNum = Math.floor(pickedSlot / 10);
                            const slots = laneToSlots.get(laneNum)!;
                            const sIdx = slots.indexOf(pickedSlot);
                            if (sIdx > -1) slots.splice(sIdx, 1);
                        }
                    });
                }
            }
        }

        // Apply assignments
        await prisma.$transaction(
            assignments.map(a =>
                prisma.$executeRaw`
                    UPDATE "RoundParticipant"
                    SET "lane" = ${a.lane}, "isManual" = ${false}
                    WHERE "id" = ${a.id}
                `
            )
        );

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
            participant = round.participants.find((p: any) => p.registrationId === registrationId);
        } else if (userId) {
            participant = round.participants.find((p: any) => p.registration.userId === userId);
        }

        if (!participant) throw new Error("참가자가 아니거나 권한이 없습니다.");

        // --- Waitlist Check ---
        const settings = round.tournament.settings ? JSON.parse(round.tournament.settings) : {};
        const maxParticipants = round.tournament.maxParticipants || settings.maxParticipants || 0;
        const allParticipantsSorted = [...round.participants].sort((a: any, b: any) =>
            new Date(a.createdAt).valueOf() - new Date(b.createdAt).valueOf()
        );
        const waitlistRank = allParticipantsSorted.findIndex((p: any) => p.registrationId === participant.registrationId) + 1;

        if (maxParticipants > 0 && waitlistRank > maxParticipants) {
            throw new Error(`현재 대기 ${waitlistRank - maxParticipants}번입니다. 자리가 나야 레인을 배정받을 수 있습니다.`);
        }

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

        // --- Team Set Assignment Logic (Sequence Based) ---
        // 1. Determine team size from settings
        const gameMode = settings.gameMode || 'INDIVIDUAL';
        const teamSize = gameMode.startsWith('TEAM_') ? parseInt(gameMode.split('_')[1]) : 1;

        if (teamSize > 1) {
            // --- Team Set Assignment Logic (Explicit Grouping or Sequence Based) ---
            let groupMembers;
            if (participant.registration.entryGroupId) {
                groupMembers = round.participants.filter((p: any) => p.registration.entryGroupId === participant.registration.entryGroupId);
            } else {
                // Sequence grouping among those without entryGroupId
                const unexplicitParticipants = [...round.participants]
                    .filter((p: any) => !p.registration.entryGroupId)
                    .sort((a: any, b: any) =>
                        new Date(a.registration.createdAt).getTime() - new Date(b.registration.createdAt).getTime()
                    );
                const myIndex = unexplicitParticipants.findIndex((p: any) => p.id === participant.id);
                if (myIndex === -1) throw new Error("Participant not found in list");
                const groupIdx = Math.floor(myIndex / teamSize);
                groupMembers = unexplicitParticipants.filter((p: any, idx) => Math.floor(idx / teamSize) === groupIdx);
            }

            const groupSize = groupMembers.length;

            // Find valid contiguous blocks
            const validBlocks: number[][] = [];
            for (let i = 0; i <= availableSlots.length - groupSize; i++) {
                const block = [];
                if (teamSize === 2) {
                    // For TEAM_2, any two adjacent slots in the sorted available list are valid
                    block.push(availableSlots[i], availableSlots[i + 1]);
                } else {
                    // For others, must be contiguous in the same lane
                    const startSlot = availableSlots[i];
                    block.push(startSlot);
                    for (let j = 1; j < groupSize; j++) {
                        const next = availableSlots.find((s: number) => s === startSlot + j);
                        if (next && Math.floor(next / 10) === Math.floor(startSlot / 10)) {
                            block.push(next);
                        }
                    }
                }

                if (block.length === groupSize) {
                    const anyAssigned = groupMembers.some((m: any) => m.lane);
                    if (!anyAssigned) {
                        validBlocks.push(block);
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

// 10-1. Remove From Round (Specific round only, preserve registration)
export async function removeFromRound(roundId: string, registrationId: string) {
    try {
        const info = await getTournamentInfo(roundId);
        if (!info) throw new Error("라운드 정보를 찾을 수 없습니다.");

        // 1. Delete scores for this specific round and registration
        await prisma.$executeRaw`
            DELETE FROM "TournamentScore" 
            WHERE "roundId" = ${roundId} AND "registrationId" = ${registrationId}
        `;

        // 2. Delete the participant entry for this round
        await prisma.$executeRaw`
            DELETE FROM "RoundParticipant" 
            WHERE "roundId" = ${roundId} AND "registrationId" = ${registrationId}
        `;

        revalidatePath(`/centers/${info.centerId}/tournaments/${info.tournamentId}/rounds/${roundId}`);
        return { success: true };
    } catch (e: any) {
        console.error(e);
        throw new Error("회차 제외 실패: " + e.message);
    }
}

// 11. Update Registration (Edit info)
export async function updateRegistration(
    registrationId: string,
    roundId: string,
    data: { guestName?: string, guestTeamName?: string, handicap?: number }
) {
    try {
        const reg = await prisma.tournamentRegistration.findUnique({
            where: { id: registrationId },
            include: {
                roundParticipations: true,
                scores: true,
                tournament: true
            }
        });

        if (!reg) throw new Error("Registration not found");

        if (data.handicap !== undefined) {
            await prisma.roundParticipant.update({
                where: {
                    roundId_registrationId: {
                        roundId,
                        registrationId
                    }
                },
                data: { handicap: data.handicap }
            });
        }

        const hasChanges = (data.guestName !== undefined && data.guestName !== reg.guestName) ||
            (data.guestTeamName !== undefined && data.guestTeamName !== reg.guestTeamName);

        if (!hasChanges) {
            revalidatePath(`/centers/${reg.tournament.centerId}/tournaments/${reg.tournamentId}/rounds/${roundId}`);
            return { success: true };
        }

        // Check if shared with other rounds
        const sharedRounds = reg.roundParticipations.filter((rp: any) => rp.roundId !== roundId);
        const isShared = sharedRounds.length > 0;

        if (isShared) {
            // FORK: Create a new registration for THIS round only
            await prisma.$transaction(async (tx: any) => {
                const newRegId = randomUUID();
                await tx.tournamentRegistration.create({
                    data: {
                        id: newRegId,
                        tournamentId: reg.tournamentId,
                        userId: null,
                        guestName: data.guestName !== undefined ? data.guestName : (reg.guestName ?? (reg.user?.name || null)),
                        guestTeamName: data.guestTeamName !== undefined ? data.guestTeamName : (reg.guestTeamName ?? (reg.team?.name || null)),
                        handicap: data.handicap !== undefined ? data.handicap : (reg.handicap ?? 0),
                        paymentStatus: reg.paymentStatus,
                        createdAt: new Date()
                    }
                });

                // Re-link this round's participant to the NEW registration
                await tx.roundParticipant.update({
                    where: {
                        roundId_registrationId: {
                            roundId,
                            registrationId
                        }
                    },
                    data: {
                        registrationId: newRegId
                    }
                });

                // Move existing scores for this round to the new registration
                await tx.tournamentScore.updateMany({
                    where: {
                        registrationId,
                        roundId
                    },
                    data: {
                        registrationId: newRegId
                    }
                });
            });
        } else {
            // NOT SHARED: Direct update is fine
            await prisma.tournamentRegistration.update({
                where: { id: registrationId },
                data: {
                    guestName: data.guestName,
                    guestTeamName: data.guestTeamName,
                    handicap: data.handicap
                }
            });
        }

        const info = await getTournamentInfo(roundId);
        if (info) {
            revalidatePath(`/centers/${info.centerId}/tournaments/${info.tournamentId}/rounds/${roundId}`);
            revalidatePath(`/centers/${info.centerId}/tournaments/${info.tournamentId}`);
        }
        revalidatePath(`/centers`);
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
// 12. Bulk Register Participants from Excel
export async function bulkRegisterParticipants(roundId: string, participants: {
    teamName?: string,
    name: string,
    handicap?: number,
    paymentStatus?: string, // 'PAID' or 'PENDING'
    laneDisplay?: string, // '1-2'
    entryGroupId?: string // 'group_1'
}[]) {
    try {
        const info = await getTournamentInfo(roundId);
        if (!info) throw new Error("라운드 정보를 찾을 수 없습니다.");

        const round = await prisma.leagueRound.findUnique({
            where: { id: roundId },
            include: { participants: true }
        });
        if (!round) throw new Error("라운드 정보를 찾을 수 없습니다.");

        const results = {
            createdTitle: 0,
            updatedTitle: 0,
            errors: [] as string[]
        };

        const shouldResetAll = info.type === 'CHAMP' || info.type === 'LEAGUE' || info.type === 'EVENT';

        await prisma.$transaction(async (tx: any) => {
            // 1. [STRICT SYNC] Clear the total slate for THIS ROUND ONLY.
            if (shouldResetAll) {
                // Delete all round-specific data records first to avoid any leftovers
                await tx.tournamentScore.deleteMany({ where: { roundId } });
                await tx.rawLaneScore.deleteMany({ where: { roundId } });
                await tx.leagueMatchup.deleteMany({ where: { roundId } }); // Cascades to IndividualScores
                await tx.roundParticipant.deleteMany({ where: { roundId } });

                // [CRITICAL CHANGE] Do NOT delete all tournament registrations.
                // We only want to manage participants for this specific round.
            }

            let index = 0;
            const baseTime = new Date();

            // Pre-fetch all registrations for this tournament to match by name/team
            const existingRegistrations = await tx.tournamentRegistration.findMany({
                where: { tournamentId: info.tournamentId },
                include: { user: true, team: true }
            });

            // Pre-fetch all center members to match by name/team if not already registered
            const centerMembers = await tx.centerMember.findMany({
                where: { centerId: info.centerId },
                include: { user: { select: { id: true, name: true } }, team: { select: { id: true, name: true } } }
            });

            for (const pData of participants) {
                try {
                    const trimmedName = pData.name.trim();
                    const trimmedTeamName = pData.teamName?.trim() || '';
                    const seqTime = new Date(baseTime.getTime() + (index++ * 1000));
                    const handicapVal = pData.handicap !== undefined ? pData.handicap : null;
                    const status = (pData.paymentStatus === '입금완료' || pData.paymentStatus === 'PAID') ? 'PAID' : 'PENDING';

                    // [REFINED LOGIC] Find if this person is already registered in the tournament
                    // 1. First, find if they are a center member
                    const memberMatch = centerMembers.find((m: any) =>
                        (m.user?.name?.trim() === trimmedName || m.alias?.trim() === trimmedName) &&
                        (m.team?.name?.trim() || '') === trimmedTeamName
                    );

                    // 2. Then match against existing registrations by userId OR guestName+Team
                    let reg = existingRegistrations.find((r: any) =>
                        (memberMatch?.user?.id && r.userId === memberMatch.user.id) ||
                        (r.guestName && r.guestName.trim() === trimmedName && (r.guestTeamName || '') === trimmedTeamName)
                    );

                    let registrationId;

                    if (reg) {
                        registrationId = reg.id;
                        // [CRITICAL] Update payment status and group, but DO NOT overwrite handicap 
                        // as it might be different across rounds.
                        await tx.tournamentRegistration.update({
                            where: { id: registrationId },
                            data: {
                                entryGroupId: pData.entryGroupId || reg.entryGroupId,
                                paymentStatus: status
                            }
                        });
                        results.updatedTitle++;
                    } else {
                        registrationId = randomUUID();

                        // [LINKING LOGIC] Check if this person is a member of this center
                        const memberMatch = centerMembers.find((m: any) =>
                            (m.user?.name?.trim() === trimmedName || m.alias?.trim() === trimmedName) &&
                            (m.team?.name?.trim() || '') === trimmedTeamName
                        );

                        await tx.tournamentRegistration.create({
                            data: {
                                id: registrationId,
                                tournamentId: info.tournamentId,
                                userId: memberMatch?.user?.id || null,
                                teamId: memberMatch?.team?.id || null,
                                guestName: trimmedName,
                                guestTeamName: trimmedTeamName || null,
                                entryGroupId: pData.entryGroupId || null,
                                handicap: handicapVal,
                                paymentStatus: status,
                                createdAt: seqTime
                            }
                        });
                        results.createdTitle++;
                    }

                    // 3. Create RoundParticipant entry linked to the registration
                    await tx.roundParticipant.create({
                        data: {
                            id: randomUUID(),
                            roundId,
                            registrationId,
                            handicap: handicapVal, // Store round-specific handicap
                            createdAt: seqTime
                        }
                    });

                    // 4. Lane Assignment (Merged with update if possible, but keeping it simple)
                    if (pData.laneDisplay && pData.laneDisplay.includes('-')) {
                        const [lane, slot] = pData.laneDisplay.split('-').map(Number);
                        if (!isNaN(lane) && !isNaN(slot)) {
                            const encodedLane = lane * 10 + slot;
                            // Update the entry we just created
                            await tx.roundParticipant.update({
                                where: { roundId_registrationId: { roundId, registrationId } },
                                data: { lane: encodedLane, isManual: true }
                            });
                        }
                    }
                } catch (err: any) {
                    results.errors.push(`${pData.name}: ${err.message}`);
                }
            }
        });

        revalidatePath(`/centers/${info.centerId}/tournaments/${info.tournamentId}/rounds/${roundId}`);
        return { success: true, ...results };
    } catch (error: any) {
        console.error("Bulk registration failed:", error);
        throw new Error(error.message || "일괄 등록 실패");
    }
}

// 2-2. Auto Assign Entry Groups by Team Size
export async function autoAssignEntryGroups(roundId: string, teamSize: number) {
    try {
        const round = await prisma.leagueRound.findUnique({
            where: { id: roundId },
            include: {
                participants: {
                    include: {
                        registration: true
                    },
                    orderBy: {
                        createdAt: 'asc'
                    }
                },
                tournament: true
            }
        });

        if (!round) throw new Error("라운드를 찾을 수 없습니다.");

        const participants = round.participants;
        const updates = [];

        for (let i = 0; i < participants.length; i++) {
            const groupNum = Math.floor(i / teamSize) + 1;
            const groupId = `group_${groupNum}`;
            updates.push(
                prisma.tournamentRegistration.update({
                    where: { id: participants[i].registrationId },
                    data: { entryGroupId: groupId }
                })
            );
        }

        await prisma.$transaction(updates);

        revalidatePath(`/centers/${round.tournament.centerId}/tournaments/${round.tournamentId}/rounds/${roundId}`);
        return { success: true };
    } catch (error: any) {
        console.error("Auto assign groups failed:", error);
        throw new Error(error.message || "자동 조 편성 실패");
    }
}

// 2-3. Update Single Registration Group
export async function updateSingleRegistrationGroup(regId: string, groupId: string | null, roundId: string) {
    try {
        await prisma.tournamentRegistration.update({
            where: { id: regId },
            data: { entryGroupId: groupId }
        });

        const info = await getTournamentInfo(roundId);
        if (info) revalidatePath(`/centers/${info.centerId}/tournaments/${info.tournamentId}/rounds/${roundId}`);

        return { success: true };
    } catch (error: any) {
        console.error("Failed to update single entryGroupId:", error);
        throw new Error("조 번호 업데이트 실패");
    }
}
