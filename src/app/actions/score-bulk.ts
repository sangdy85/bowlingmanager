'use server';

import { auth } from "@/auth";
import {
    saveBulkScoreRows,
    ScoreBulkServiceError,
    type ScoreBulkRow,
} from "@/lib/score-bulk-service";
import { revalidatePath } from "next/cache";

export interface BulkScoreData {
    memberName: string;
    scores: number[];
    gameDate?: string;
    memo?: string;
}

export async function bulkAddScores(
    data: BulkScoreData[],
    defaultGameDateStr?: string,
    defaultGameType: string = "정기전",
    teamId?: string,
) {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, message: "로그인이 필요합니다." };
    }
    if (!data || data.length === 0) {
        return { success: false, message: "등록할 데이터가 없습니다." };
    }

    const rows: ScoreBulkRow[] = [];
    for (const row of data) {
        const dateString = row.gameDate || defaultGameDateStr;
        if (!dateString) continue;
        const gameDate = new Date(dateString);
        if (Number.isNaN(gameDate.getTime())) continue;

        rows.push({
            memberName: row.memberName,
            scores: row.scores
                .filter((score) => score !== null && score !== undefined)
                .map(Number)
                .filter((score) => !Number.isNaN(score) && score >= 0 && score <= 300),
            gameDate,
            gameType: defaultGameType,
            memo: row.memo || null,
        });
    }

    try {
        const result = await saveBulkScoreRows({
            actorUserId: session.user.id,
            teamId,
            rows,
            requireMembership: false,
            memberMatchMode: "preferred-name",
            allowEmpty: true,
        });
        revalidatePath("/dashboard");
        return {
            success: true,
            message: `${result.playerCount}명의 기록이 성공적으로 저장되었습니다.`,
        };
    } catch (error) {
        if (error instanceof ScoreBulkServiceError) {
            return { success: false, message: error.message };
        }
        console.error("Bulk add error:", error);
        return {
            success: false,
            message: `일괄 저장 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`,
        };
    }
}
