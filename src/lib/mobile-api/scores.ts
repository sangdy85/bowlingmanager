import prisma from "@/lib/prisma";
import {
    mobileScoreOrderBy,
    mobileScoreSelect,
    mobileScoreWhere,
    toMobileScoreItem,
} from "@/lib/mobile-api/score-record";
import { groupScores } from "@/lib/score-groups";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function parsePositiveInteger(value: string | null, fallback: number) {
    if (!value) return fallback;

    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function parseMobileScorePagination(searchParams: URLSearchParams) {
    const page = parsePositiveInteger(searchParams.get("page"), DEFAULT_PAGE);
    const requestedLimit = parsePositiveInteger(searchParams.get("limit"), DEFAULT_LIMIT);

    return {
        page,
        limit: Math.min(requestedLimit, MAX_LIMIT),
    };
}

export async function getMobileScores(userId: string, page: number, limit: number) {
    const where = mobileScoreWhere(userId);

    const [scoreRecords, total] = await prisma.$transaction([
        prisma.score.findMany({
            where,
            orderBy: mobileScoreOrderBy,
            skip: (page - 1) * limit,
            take: limit,
            select: mobileScoreSelect,
        }),
        prisma.score.count({ where }),
    ]);

    const items = scoreRecords.map(toMobileScoreItem);

    return {
        items,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
}

export async function getMobileScoreGroups(userId: string, page: number, limit: number) {
    const scoreRecords = await prisma.score.findMany({
        where: mobileScoreWhere(userId),
        orderBy: mobileScoreOrderBy,
        select: {
            ...mobileScoreSelect,
            createdAt: true,
        },
    });
    const groups = groupScores(scoreRecords.map(({ Team, ...score }) => ({
        ...score,
        source: "PERSONAL" as const,
        team: Team,
    })));
    const total = groups.length;
    const start = (page - 1) * limit;

    return {
        items: groups.slice(start, start + limit),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
}
