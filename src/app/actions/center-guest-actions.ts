"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

/**
 * 센터 관리자 여부 확인
 */
async function checkCenterManager(centerId: string, userId: string) {
    const center = await prisma.bowlingCenter.findUnique({
        where: { id: centerId },
        include: { managers: true }
    });

    if (!center) return false;
    return center.ownerId === userId || center.managers.some((m: any) => m.id === userId);
}

/**
 * 특정 센터의 모든 비회원(게스트) 이름 목록을 가져옵니다.
 */
export async function getCenterGuests(centerId: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    if (!await checkCenterManager(centerId, session.user.id)) {
        throw new Error("권한이 없습니다.");
    }

    try {
        // 1. 대회 등록 정보에서 게스트 추출
        const registrations: any[] = await prisma.$queryRaw`
            SELECT DISTINCT "guestName"
            FROM "TournamentRegistration"
            WHERE "tournamentId" IN (SELECT id FROM "Tournament" WHERE "centerId" = ${centerId})
            AND "userId" IS NULL
            AND "guestName" IS NOT NULL
        `;

        // 2. 리그 개별 기록에서 게스트 추출
        const leagueScores: any[] = await prisma.$queryRaw`
            SELECT DISTINCT "playerName" as "guestName"
            FROM "LeagueMatchupIndividualScore"
            WHERE "matchupId" IN (
                SELECT m.id 
                FROM "LeagueMatchup" m
                JOIN "LeagueRound" r ON m."roundId" = r.id
                JOIN "Tournament" t ON r."tournamentId" = t.id
                WHERE t."centerId" = ${centerId}
            )
            AND "userId" IS NULL
            AND "playerName" IS NOT NULL
        `;

        // 합치기 및 중복 제거
        const allGuestNames = new Set<string>();
        registrations.forEach(r => allGuestNames.add(r.guestName));
        leagueScores.forEach(s => allGuestNames.add(s.guestName));

        return Array.from(allGuestNames).sort();
    } catch (error) {
        console.error("Failed to fetch center guests:", error);
        return [];
    }
}

/**
 * 센터 게스트 기록을 정식 회원 계정으로 통합합니다.
 */
export async function mergeCenterGuestStats(centerId: string, guestName: string, targetUserId: string) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, message: "로그인이 필요합니다." };

    if (!await checkCenterManager(centerId, session.user.id)) {
        return { success: false, message: "권한이 없습니다." };
    }

    try {
        await prisma.$transaction(async (tx: any) => {
            // 1. 대회 등록 정보 업데이트 (TournamentRegistration)
            // 해당 센터의 대회들에서 이 게스트의 등록 정보를 모두 가져옴
            const guestRegistrations = await tx.tournamentRegistration.findMany({
                where: {
                    tournament: { centerId },
                    userId: null,
                    guestName: guestName
                }
            });

            for (const guestReg of guestRegistrations) {
                // 해당 대회에 타겟 유저가 이미 등록되어 있는지 확인
                const existingUserReg = await tx.tournamentRegistration.findUnique({
                    where: {
                        tournamentId_userId: {
                            tournamentId: guestReg.tournamentId,
                            userId: targetUserId
                        }
                    }
                });

                if (existingUserReg) {
                    // 이미 유저 등록 정보가 있는 경우: 게스트 기록을 유저 등록 정보로 이전하고 게스트 등록 정보 삭제

                    // 1-1. 라운드 참가 정보 이전
                    await tx.roundParticipant.updateMany({
                        where: { registrationId: guestReg.id },
                        data: { registrationId: existingUserReg.id }
                    });

                    // 1-2. 대회 점수 정보 이전
                    await tx.tournamentScore.updateMany({
                        where: { registrationId: guestReg.id },
                        data: { registrationId: existingUserReg.id }
                    });

                    // 1-3. 게스트 등록 정보 삭제
                    await tx.tournamentRegistration.delete({
                        where: { id: guestReg.id }
                    });
                } else {
                    // 유저 등록 정보가 없는 경우: 게스트 등록 정보를 유저 정보로 업데이트
                    await tx.tournamentRegistration.update({
                        where: { id: guestReg.id },
                        data: {
                            userId: targetUserId,
                            guestName: null
                        }
                    });
                }
            }

            // 2. 리그 개별 경기 기록 업데이트 (LeagueMatchupIndividualScore)
            // 리그 기록의 경우 중복 체크보다는 간단한 통합이 가능함 (하나의 매치업에 동일 유저가 여러 번 들어갈 수 있어도 됨)
            // 다만, 가급적이면 해당 센터의 기록만 업데이트하도록 함
            const matchups = await tx.leagueMatchup.findMany({
                where: {
                    round: {
                        tournament: { centerId }
                    }
                },
                select: { id: true }
            });
            const matchupIds = matchups.map((m: any) => m.id);

            await tx.leagueMatchupIndividualScore.updateMany({
                where: {
                    matchupId: { in: matchupIds },
                    userId: null,
                    playerName: guestName
                },
                data: {
                    userId: targetUserId,
                    playerName: null
                }
            });
        });

        revalidatePath(`/centers/${centerId}/members`);
        return { success: true, message: `'${guestName}'님의 모든 기록이 회원 계정으로 통합되었습니다.` };
    } catch (error) {
        console.error("Center guest merge failed:", error);
        return { success: false, message: "기록 통합 중 오류가 발생했습니다." };
    }
}

/**
 * 게스트 기록 삭제
 */
export async function deleteCenterGuestRecords(centerId: string, guestName: string) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, message: "로그인이 필요합니다." };

    if (!await checkCenterManager(centerId, session.user.id)) {
        return { success: false, message: "권한이 없습니다." };
    }

    try {
        await prisma.$transaction(async (tx: any) => {
            const tournaments = await tx.tournament.findMany({
                where: { centerId },
                select: { id: true }
            });
            const tournamentIds = tournaments.map((t: any) => t.id);

            // 대회 등록 정보 삭제 (Cascade로 인해 참가자 및 점수도 삭제됨)
            await tx.tournamentRegistration.deleteMany({
                where: {
                    tournamentId: { in: tournamentIds },
                    userId: null,
                    guestName: guestName
                }
            });

            // 리그 개별 기록 삭제
            const matchups = await tx.leagueMatchup.findMany({
                where: {
                    round: {
                        tournament: { centerId }
                    }
                },
                select: { id: true }
            });
            const matchupIds = matchups.map((m: any) => m.id);

            await tx.leagueMatchupIndividualScore.deleteMany({
                where: {
                    matchupId: { in: matchupIds },
                    userId: null,
                    playerName: guestName
                }
            });
        });

        revalidatePath(`/centers/${centerId}/members`);
        return { success: true, message: `'${guestName}'님의 기록을 삭제했습니다.` };
    } catch (error) {
        console.error("Delete center guest records failed:", error);
        return { success: false, message: "기록 삭제 중 오류가 발생했습니다." };
    }
}
