import { Prisma } from "@prisma/client";

export const mobileScoreSelect = {
    id: true,
    score: true,
    gameDate: true,
    gameType: true,
    memo: true,
    Team: {
        select: {
            id: true,
            name: true,
        },
    },
} satisfies Prisma.ScoreSelect;

export const mobileScoreOrderBy: Prisma.ScoreOrderByWithRelationInput[] = [
    { gameDate: "desc" },
    { createdAt: "desc" },
];

export function mobileScoreWhere(userId: string): Prisma.ScoreWhereInput {
    return {
        userId,
        score: {
            gte: 0,
            lte: 300,
        },
    };
}

type MobileScoreRecord = Prisma.ScoreGetPayload<{
    select: typeof mobileScoreSelect;
}>;

export function toMobileScoreItem({ Team, ...score }: MobileScoreRecord) {
    return {
        ...score,
        team: Team,
    };
}
