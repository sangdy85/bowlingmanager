'use server';

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export interface BulkScoreData {
    memberName: string;
    scores: number[];
    memo?: string;
    gameDate?: string; // Optional per-record date
}

export async function bulkAddScores(data: BulkScoreData[], defaultGameDateStr?: string, defaultGameType: string = "정기전") {
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

    // Check permissions: Owner or Manager
    const teamRecord = await prisma.team.findUnique({
        where: { id: currentTeam.id },
        include: {
            managers: {
                where: { id: session.user.id }
            }
        }
    });

    const isOwner = teamRecord?.ownerId === session.user.id;
    const isManager = (teamRecord?.managers?.length ?? 0) > 0;

    if (!isOwner && !isManager) {
        return { success: false, message: "권한이 없습니다. 팀장 또는 매니저만 일괄 등록할 수 있습니다." };
    }

    if (!data || data.length === 0) {
        return { success: false, message: "등록할 데이터가 없습니다." };
    }

    // Cache team members for lookup (supporting Aliases)
    const teamMembers = await prisma.teamMember.findMany({
        where: { teamId: currentTeam.id },
        include: { user: true }
    });

    // Map Name (Alias or Real Name) -> User ID
    const memberMap = new Map(teamMembers.map(m => [m.alias || m.user.name, m.userId]));
    let successCount = 0;

    try {
        await prisma.$transaction(async (tx) => {
            for (const row of data) {
                // Determine the date for this row
                const dateStr = row.gameDate || defaultGameDateStr;
                if (!dateStr) continue;

                const gameDate = new Date(dateStr);
                if (isNaN(gameDate.getTime())) continue;

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
                            gameType: defaultGameType
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
            message: `${successCount}명의 기록이 성공적으로 저장되었습니다.`
        };

    } catch (error) {
        console.error("Bulk add error:", error);
        return { success: false, message: "일괄 등록 중 오류가 발생했습니다." };
    }
}
