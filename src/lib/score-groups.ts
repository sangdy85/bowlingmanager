export type ScoreGroupSource = "PERSONAL" | "LEAGUE" | "TOURNAMENT";

export type GroupableScore = {
    id: string;
    source: ScoreGroupSource;
    score: number;
    gameDate: Date;
    gameType: string | null;
    memo: string | null;
    team: { id: string; name: string } | null;
    createdAt?: Date;
    sessionId?: string | null;
    gameOrder?: number | null;
};

export type ScoreGameGroup = {
    id: string;
    source: ScoreGroupSource;
    gameDate: Date;
    gameType: string | null;
    team: { id: string; name: string } | null;
    scores: { id: string; score: number; memo: string | null }[];
    total: number;
    average: number;
    gameCount: number;
};

const calendarDate = (value: Date) => value.toISOString().slice(0, 10);
const normalizeGameType = (value: string | null) => value?.trim() || null;
const encodeKeyPart = (value: string | null) => encodeURIComponent(value ?? "");

function groupKey(record: GroupableScore) {
    return [
        record.source,
        calendarDate(record.gameDate),
        encodeKeyPart(normalizeGameType(record.gameType)),
        encodeKeyPart(record.team?.id ?? null),
        encodeKeyPart(record.sessionId ?? null),
    ].join(":");
}

function compareScores(a: GroupableScore, b: GroupableScore) {
    const orderA = a.gameOrder ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.gameOrder ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;
    const createdA = a.createdAt?.getTime() ?? a.gameDate.getTime();
    const createdB = b.createdAt?.getTime() ?? b.gameDate.getTime();
    if (createdA !== createdB) return createdA - createdB;
    return a.id.localeCompare(b.id);
}

/** Groups complete score data. Callers must not pass a row-paginated subset. */
export function groupScores(records: GroupableScore[]): ScoreGameGroup[] {
    const groups = new Map<string, GroupableScore[]>();
    for (const record of records) {
        const key = groupKey(record);
        const group = groups.get(key);
        if (group) group.push(record);
        else groups.set(key, [record]);
    }

    return [...groups.entries()].map(([id, group]) => {
        const ordered = [...group].sort(compareScores);
        const latestDate = group.reduce(
            (latest, record) => record.gameDate > latest ? record.gameDate : latest,
            group[0].gameDate,
        );
        const total = ordered.reduce((sum, record) => sum + record.score, 0);
        const latestCreatedAt = group.reduce(
            (latest, record) => Math.max(
                latest,
                record.createdAt?.getTime() ?? record.gameDate.getTime(),
            ),
            Number.MIN_SAFE_INTEGER,
        );
        return {
            latestCreatedAt,
            value: {
                id,
                source: group[0].source,
                gameDate: latestDate,
                gameType: normalizeGameType(group[0].gameType),
                team: group[0].team,
                scores: ordered.map(({ id: scoreId, score, memo }) => ({ id: scoreId, score, memo })),
                total,
                average: Number((total / ordered.length).toFixed(1)),
                gameCount: ordered.length,
            },
        };
    }).sort((a, b) =>
        b.value.gameDate.getTime() - a.value.gameDate.getTime()
        || b.latestCreatedAt - a.latestCreatedAt
        || a.value.id.localeCompare(b.value.id),
    ).map(({ value }) => value);
}
