'use server';

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export interface BulkScoreData {
    memberName: string;
    scores: number[];
    memo?: string;
}

export async function bulkAddScores(data: BulkScoreData[], gameDateStr: string, gameType: string = "정기전") {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, message: "로그인이 필요합니다." };
    }

    // Verify team membership via TeamMember
    const membership = await prisma.teamMember.findFirst({
        where: { userId: session.user.id },
        include: { team: true }
    });

    if (!membership) {
        return { success: false, message: "팀에 소속되어 있지 않습니다." };
    }

    const currentTeam = membership.team;

    // Ownership check using raw query
    const teamData = await prisma.$queryRaw<{ ownerId: string }[]>`SELECT ownerId FROM Team WHERE id = ${currentTeam.id}`;
    const realOwnerId = teamData[0]?.ownerId;

    if (!realOwnerId || realOwnerId !== session.user.id) {
        return { success: false, message: "권한이 없습니다. 팀 생성자만 일괄 등록할 수 있습니다." };
    }

    if (!data || data.length === 0) {
        return { success: false, message: "등록할 데이터가 없습니다." };
    }

    if (!gameDateStr) {
        return { success: false, message: "날짜가 선택되지 않았습니다." };
    }
    const gameDate = new Date(gameDateStr);
    if (isNaN(gameDate.getTime())) {
        return { success: false, message: "유효하지 않은 날짜입니다." };
    }

    // Cache team members for lookup (supporting Aliases)
    const teamMembers = await prisma.teamMember.findMany({
        where: { teamId: currentTeam.id },
        include: { user: true }
    });

    // Map Name (Alias or Real Name) -> User ID
    const memberMap = new Map(teamMembers.map(m => [m.alias || m.user.name, m.userId]));
    let successCount = 0;
    let failCount = 0;

    try {
        await prisma.$transaction(async (tx) => {
            for (const row of data) {
                let userId: string | null = memberMap.get(row.memberName) || null;
                const guestName = !userId ? row.memberName : null;

                for (const score of row.scores) {
                    if (isNaN(score) || score < 0 || score > 300) continue;

                    const created = await tx.score.create({
                        data: {
                            userId: userId,
                            guestName: guestName,
                            score,
                            teamId: currentTeam.id,
                            gameDate,
                            gameType: gameType // Use passed gameType
                        }
                    });

                    if (row.memo) {
                        await tx.$executeRaw`UPDATE Score SET memo = ${row.memo} WHERE id = ${created.id}`;
                    }
                }
                successCount++;
            }
        });

        revalidatePath("/dashboard");
        return {
            success: true,
            message: `${successCount}건의 기록이 성공적으로 저장되었습니다.`
        };

    } catch (error) {
        console.error(error);
        return { success: false, message: "일괄 등록 중 오류가 발생했습니다." };
    }
}
