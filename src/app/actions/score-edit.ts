'use server';

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function saveDailyScores(
    teamId: string,
    targetUserId: string,
    currentDateStr: string,
    scores: { id?: string, score: number }[],
    currentGuestName?: string,
    newDateStr?: string,
    newGuestName?: string
) {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, message: "로그인이 필요합니다." };
    }

    // 1. Permission Verification (Owner or Manager)
    const team = await prisma.team.findUnique({
        where: { id: teamId },
        include: { managers: true }
    });

    if (!team) {
        return { success: false, message: "팀 정보를 찾을 수 없습니다." };
    }

    const isOwner = team.ownerId === session.user.id;
    const isManager = team.managers.some(m => m.id === session.user.id);

    if (!isOwner && !isManager) {
        return { success: false, message: "점수 수정 권한이 없습니다. 팀장 또는 매니저만 수정할 수 있습니다." };
    }

    const currentDate = new Date(currentDateStr);
    const startOfCurrentDay = new Date(currentDate); startOfCurrentDay.setHours(0, 0, 0, 0);
    const endOfCurrentDay = new Date(currentDate); endOfCurrentDay.setHours(23, 59, 59, 999);

    const targetDate = newDateStr ? new Date(newDateStr) : currentDate;
    const targetGuestName = newGuestName !== undefined ? newGuestName : currentGuestName;

    try {
        await prisma.$transaction(async (tx) => {
            // Find existing scores based on Member OR Guest
            let existingScores;
            if (currentGuestName) {
                existingScores = await tx.score.findMany({
                    where: {
                        teamId: teamId,
                        guestName: currentGuestName,
                        gameDate: {
                            gte: startOfCurrentDay,
                            lte: endOfCurrentDay
                        }
                    }
                });
            } else {
                existingScores = await tx.score.findMany({
                    where: {
                        teamId: teamId,
                        userId: targetUserId,
                        gameDate: {
                            gte: startOfCurrentDay,
                            lte: endOfCurrentDay
                        }
                    }
                });
            }

            const existingIds = existingScores.map(s => s.id);
            const incomingIds = scores.map(s => s.id).filter(id => id !== undefined) as string[];

            // Delete removed scores (if scores array is empty, this handles "Delete All")
            const toDelete = existingIds.filter(id => !incomingIds.includes(id));
            if (toDelete.length > 0) {
                await tx.score.deleteMany({
                    where: { id: { in: toDelete } }
                });
            }

            // Update or Create
            for (const item of scores) {
                if (item.id && existingIds.includes(item.id)) {
                    await tx.score.update({
                        where: { id: item.id },
                        data: {
                            score: item.score,
                            gameDate: targetDate,
                            guestName: targetGuestName || null
                        }
                    });
                } else if (item.score > 0) { // Only create if score is valid
                    await tx.score.create({
                        data: {
                            score: item.score,
                            teamId: teamId,
                            gameDate: targetDate,
                            userId: targetGuestName ? null : targetUserId,
                            guestName: targetGuestName || null
                        }
                    });
                }
            }
        });

        revalidatePath(`/team/${teamId}`);
        return { success: true, message: "저장되었습니다." };
    } catch (error) {
        console.error("Score update error:", error);
        return { success: false, message: "저장 중 오류가 발생했습니다." };
    }
}

export async function updateDailyGroupInfo(
    teamId: string,
    currentDateStr: string,
    newDateStr: string,
    newGameType: string,
    newMemo: string
) {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, message: "로그인이 필요합니다." };
    }

    // Permission Verification (Owner or Manager)
    const team = await prisma.team.findUnique({
        where: { id: teamId },
        include: { managers: true }
    });

    if (!team) {
        return { success: false, message: "팀 정보를 찾을 수 없습니다." };
    }

    const isOwner = team.ownerId === session.user.id;
    const isManager = team.managers.some(m => m.id === session.user.id);

    if (!isOwner && !isManager) {
        return { success: false, message: "수정 권한이 없습니다." };
    }

    const currentDate = new Date(currentDateStr);
    const startOfCurrentDay = new Date(currentDate); startOfCurrentDay.setHours(0, 0, 0, 0);
    const endOfCurrentDay = new Date(currentDate); endOfCurrentDay.setHours(23, 59, 59, 999);

    const targetDate = new Date(newDateStr);

    try {
        await prisma.score.updateMany({
            where: {
                teamId: teamId,
                gameDate: {
                    gte: startOfCurrentDay,
                    lte: endOfCurrentDay
                }
            },
            data: {
                gameDate: targetDate,
                gameType: newGameType || null,
                memo: newMemo || null
            }
        });

        revalidatePath(`/team/${teamId}`);
        return { success: true, message: "일괄 수정되었습니다." };
    } catch (error) {
        console.error("Score group update error:", error);
        return { success: false, message: "수정 중 오류가 발생했습니다." };
    }
}
