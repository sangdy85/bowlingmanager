'use server';

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function addScore(prevState: any, formData: FormData) {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, message: "로그인이 필요합니다." };
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { teamMemberships: { include: { team: true } } }
    });

    if (!user || user.teamMemberships.length === 0) {
        return { success: false, message: "속해있는 팀이 없습니다." };
    }

    const teamId = formData.get("teamId") as string;
    const gameType = formData.get("gameType") as string;

    // Validate teamId
    const currentTeam = user.teamMemberships.find(tm => tm.team.id === teamId)?.team;

    if (!currentTeam) {
        return { success: false, message: "선택된 팀이 올바르지 않거나 소속되어 있지 않습니다." };
    }

    // Verify ownership or manager status
    const teamWithManagers = await prisma.team.findUnique({
        where: { id: currentTeam.id },
        include: { managers: true }
    });

    const isOwner = teamWithManagers?.ownerId === user.id;
    const isManager = teamWithManagers?.managers.some(m => m.id === user.id);

    if (!isOwner && !isManager) {
        return { success: false, message: "점수 등록 권한이 없습니다. 팀장 또는 매니저만 등록할 수 있습니다." };
    }

    const dateStr = formData.get("date") as string;
    const scores = formData.getAll("score");

    if (!dateStr) {
        return { success: false, message: "날짜를 선택해주세요." };
    }

    const validScores: number[] = [];
    for (const scoreStr of scores) {
        const score = parseInt(scoreStr as string);
        if (isNaN(score) || score < 0 || score > 300) {
            return { success: false, message: "모든 점수는 0에서 300 사이여야 합니다." };
        }
        validScores.push(score);
    }

    if (validScores.length === 0) {
        return { success: false, message: "최소 1개 이상의 점수를 입력해주세요." };
    }

    try {
        const gameDate = new Date(dateStr);

        const targetUserId = formData.get("targetUserId") as string || session.user.id!;
        const guestName = formData.get("guestName") as string | null;

        // Validation for Guest vs Member
        if (targetUserId === 'guest') {
            if (!guestName || guestName.trim() === '') {
                return { success: false, message: "비회원 이름을 입력해주세요." };
            }
        } else {
            // If targeting someone else (Member), verify they are in the same team
            if (targetUserId !== session.user.id) {
                const targetUser = await prisma.user.findUnique({
                    where: { id: targetUserId },
                    include: { teamMemberships: { include: { team: true } } }
                });

                const isTeamMember = targetUser?.teamMemberships.some(tm => tm.teamId === currentTeam.id);

                if (!isTeamMember) {
                    throw new Error("Invalid target user");
                }
            }
        }

        const memo = formData.get("memo") as string || null;

        await prisma.$transaction(async (tx) => {
            for (const score of validScores) {
                const isGuest = targetUserId === 'guest';

                const created = await tx.score.create({
                    data: {
                        score,
                        userId: isGuest ? null : targetUserId,
                        guestName: isGuest ? guestName : null,
                        gameDate: gameDate,
                        teamId: currentTeam.id,
                        gameType: gameType
                    }
                });

                if (memo) {
                    await tx.$executeRaw`UPDATE Score SET memo = ${memo} WHERE id = ${created.id}`;
                }
            }
        });

        revalidatePath("/dashboard");
        return { success: true, message: "점수가 성공적으로 등록되었습니다." };
    } catch (error) {
        console.error(error);
        return { success: false, message: "점수 등록 중 오류가 발생했습니다." };
    }
}

export async function addBulkScores(
    commonData: {
        teamId: string;
        gameType: string;
        date: string;
        memo?: string;
    },
    rows: {
        memberName: string;
        scores: number[];
    }[]
) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, message: "로그인이 필요합니다." };

    console.log("Bulk Save Request:", commonData, rows);

    try {
        const gameDate = new Date(commonData.date);

        // Fetch team and members for name matching
        const team = await prisma.team.findUnique({
            where: { id: commonData.teamId },
            include: {
                members: { include: { user: true } },
                managers: true
            }
        });

        if (!team) return { success: false, message: "팀을 찾을 수 없습니다." };

        // Check Permissions
        const isOwner = team.ownerId === session.user.id;
        const isManager = team.managers.some(m => m.id === session.user.id);
        const isMember = team.members.some(m => m.userId === session.user.id);

        if (!isOwner && !isManager && !isMember) {
            return { success: false, message: "팀 구성원만 점수를 등록할 수 있습니다." };
        }

        if (!isOwner && !isManager) {
            return { success: false, message: "권한이 없습니다 (팀장/매니저 전용)." };
        }

        // Prepare records
        const recordsToCreate: {
            score: number;
            userId: string | null;
            guestName: string | null;
            gameDate: Date;
            teamId: string;
            gameType: string;
            memo: string | null;
        }[] = [];

        for (const row of rows) {
            const cleanName = row.memberName.trim();
            // Try to find member by name
            const matchedMember = team.members.find(m => m.user.name === cleanName || m.alias === cleanName);

            const targetUserId = matchedMember ? matchedMember.userId : null;
            const guestName = matchedMember ? null : cleanName;

            for (const scoreVal of row.scores) {
                recordsToCreate.push({
                    score: scoreVal,
                    userId: targetUserId,
                    guestName: guestName,
                    gameDate: gameDate,
                    teamId: commonData.teamId,
                    gameType: commonData.gameType,
                    memo: commonData.memo || null
                });
            }
        }

        if (recordsToCreate.length === 0) {
            return { success: false, message: "저장할 데이터가 없습니다." };
        }

        await prisma.$transaction(async (tx) => {
            for (const data of recordsToCreate) {
                await tx.score.create({ data });
            }
        });

        revalidatePath("/dashboard");
        return { success: true, message: `${recordsToCreate.length}건의 점수가 저장되었습니다.` };

    } catch (e) {
        console.error(e);
        return { success: false, message: "일괄 저장 중 오류가 발생했습니다." };
    }
}
