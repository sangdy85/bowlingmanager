import prisma from "@/lib/prisma";
import {
    mobileScoreOrderBy,
    mobileScoreSelect,
    mobileScoreWhere,
    toMobileScoreItem,
} from "@/lib/mobile-api/score-record";

function roundAverage(value: number) {
    return Math.round(value * 100) / 100;
}

export async function getMobileDashboard(userId: string) {
    const where = mobileScoreWhere(userId);

    const [summary, recentScoreRecords] = await Promise.all([
        prisma.score.aggregate({
            where,
            _avg: { score: true },
            _max: { score: true },
            _count: { _all: true },
        }),
        prisma.score.findMany({
            where,
            orderBy: mobileScoreOrderBy,
            take: 10,
            select: mobileScoreSelect,
        }),
    ]);

    const recentScores = recentScoreRecords.map(toMobileScoreItem);
    const recentTotal = recentScores.reduce((total, item) => total + item.score, 0);

    return {
        average: roundAverage(summary._avg.score ?? 0),
        highScore: summary._max.score ?? 0,
        gameCount: summary._count._all,
        recentScores,
        recentAverage: recentScores.length > 0
            ? roundAverage(recentTotal / recentScores.length)
            : 0,
    };
}
