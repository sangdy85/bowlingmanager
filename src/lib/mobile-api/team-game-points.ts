import {
    parseRankPoints,
    readRankPoints,
    serializeRankPoints,
} from "@/lib/mobile-api/bowler-hidden";

export type TeamGamePointTable = {
    gameNumber: number;
    points: { rank: number; points: number }[];
};

const DEFAULT_POINTS = [5, 3, 2, 1] as const;
const FINAL_GAME_POINTS = [6, 4, 2, 1] as const;

export function defaultTeamGamePointTables(gameCount: number): TeamGamePointTable[] {
    return Array.from({ length: gameCount }, (_, index) => ({
        gameNumber: index + 1,
        points: (gameCount >= 4 && index === gameCount - 1 ? FINAL_GAME_POINTS : DEFAULT_POINTS)
            .map((points, rank) => ({ rank: rank + 1, points })),
    }));
}

export function parseTeamGamePointTables(
    value: unknown,
    gameCount: number,
    legacyPoints: unknown = undefined,
): TeamGamePointTable[] {
    if (value === undefined || value === null) {
        const legacy = legacyPoints === undefined ? [] : parseRankPoints(legacyPoints);
        if (legacy.length > 0) {
            return Array.from({ length: gameCount }, (_, index) => ({ gameNumber: index + 1, points: legacy }));
        }
        return defaultTeamGamePointTables(gameCount);
    }
    if (!Array.isArray(value) || value.length !== gameCount) throw new Error("invalid team game points");
    return value.map((raw, index) => {
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("invalid team game points");
        const item = raw as Record<string, unknown>;
        if (item.gameNumber !== index + 1) throw new Error("invalid team game points");
        const points = parseRankPoints(item.points);
        if (points.length < 1) throw new Error("invalid team game points");
        return { gameNumber: index + 1, points };
    });
}

export function serializeTeamGamePointTables(value: readonly TeamGamePointTable[]): string {
    return JSON.stringify({
        version: 2,
        games: value.map((item) => ({
            gameNumber: item.gameNumber,
            points: JSON.parse(serializeRankPoints(item.points)) as Record<string, number>,
        })),
    });
}

export function readTeamGamePointTables(value: string, gameCount: number): TeamGamePointTable[] {
    try {
        const parsed: unknown = JSON.parse(value);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            const record = parsed as Record<string, unknown>;
            if (record.version === 2 && Array.isArray(record.games)) {
                return parseTeamGamePointTables(record.games.map((raw) => {
                    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
                    const item = raw as Record<string, unknown>;
                    const points = item.points && typeof item.points === "object" && !Array.isArray(item.points)
                        ? Object.entries(item.points as Record<string, unknown>).map(([rank, points]) => ({ rank: Number(rank), points }))
                        : item.points;
                    return { gameNumber: item.gameNumber, points };
                }), gameCount);
            }
        }
    } catch {
        // Legacy data is handled below.
    }
    const legacy = readRankPoints(value);
    if (legacy.length > 0) {
        return Array.from({ length: gameCount }, (_, index) => ({ gameNumber: index + 1, points: legacy }));
    }
    return defaultTeamGamePointTables(gameCount);
}
