// Mission points are derived from current, valid evidence. Never write to season point ledgers.
export const MISSION_KINDS = ["ATTENDANCE", "REGULAR_AVERAGE", "REGULAR_SCORE", "ALL_COVER", "INDIVIDUAL_RANK", "TEAM_WIN"] as const;
export type MissionKind = typeof MISSION_KINDS[number];
export const HIDDEN_MISSIONS: readonly string[] = ["INDIVIDUAL_RANK", "TEAM_WIN"];
export class MissionError extends Error {
    constructor(public readonly code: string, message: string, public readonly status: number) { super(message); }
}
export function parseMission(input: Record<string, unknown>) {
    const { kind, threshold, points } = input;
    const validKind = typeof kind === "string" && MISSION_KINDS.includes(kind as MissionKind);
    const validThreshold = Number.isSafeInteger(threshold) && (threshold as number) >= 1 &&
        (kind === "ATTENDANCE" ? (threshold as number) <= 100 && (threshold as number) % 10 === 0 :
            kind === "REGULAR_AVERAGE" || kind === "REGULAR_SCORE" ? (threshold as number) <= 300 :
                kind === "TEAM_WIN" ? threshold === 1 : (threshold as number) <= 10000);
    if (!validKind || !validThreshold || !Number.isSafeInteger(points) || (points as number) < 0 || (points as number) > 1000000) {
        throw new MissionError("INVALID_MISSION", "미션 종류, 기준과 미션 포인트를 확인해주세요.", 400);
    }
    return { kind: kind as MissionKind, threshold: threshold as number, points: points as number };
}
export type MissionScore = { score: number; userId: string | null; gameDate: Date; teamEventId: string | null };
export type MissionRank = { memberId: string; type: "INDIVIDUAL" | "TEAM"; rank: number; date: Date };
export function missionProgress(input: {
    scores: readonly MissionScore[]; events: readonly { id: string; date: Date }[]; ranks: readonly MissionRank[]; userId: string; memberId: string;
    start: Date; end: Date; joinedAt: Date; now: Date; allCoverCount: number;
}) {
    const key = (date: Date) => new Date(date.getTime() + 9 * 3600000).toISOString().slice(0, 10);
    const startKey = key(input.start), endKey = key(input.end), today = key(input.now);
    const calendar = input.events.filter(event => key(event.date) >= startKey && key(event.date) <= endKey);
    const calendarById = new Map(calendar.map(event => [event.id, event]));
    const eligible = input.scores.filter(row => Number.isInteger(row.score) && row.score >= 0 && row.score <= 300 &&
        key(row.gameDate) >= startKey && key(row.gameDate) <= endKey && key(row.gameDate) <= today &&
        (!row.teamEventId || !calendarById.has(row.teamEventId) || key(calendarById.get(row.teamEventId)!.date) <= today));
    // Full-season schedule denominator, including future regular meetings. RSVP is not attendance.
    // Unscheduled score rows cannot invent attendance opportunities.
    const active = new Set(calendar.map(event => event.id));
    const own = eligible.filter(row => row.userId === input.userId);
    const attended = new Set<string>();
    for (const row of own) {
        if (row.teamEventId && calendarById.has(row.teamEventId)) attended.add(row.teamEventId);
        else {
            const onDate = calendar.filter(event => key(event.date) === key(row.gameDate));
            if (onDate.length === 1 && key(onDate[0].date) <= today) attended.add(onDate[0].id);
        }
    }
    const sessions = new Map<string, number[]>();
    for (const row of own) {
        const id = row.teamEventId ?? key(row.gameDate); const values = sessions.get(id) ?? [];
        values.push(row.score); sessions.set(id, values);
    }
    const ranks = input.ranks.filter(row => row.memberId === input.memberId && key(row.date) >= startKey && key(row.date) <= endKey && key(row.date) <= today);
    return {
        ATTENDANCE: active.size ? attended.size / active.size * 100 : 0,
        REGULAR_AVERAGE: Math.max(0, ...[...sessions.values()].map(values => values.reduce((a, b) => a + b, 0) / values.length)),
        REGULAR_SCORE: Math.max(0, ...own.map(row => row.score)),
        ALL_COVER: key(input.now) < startKey ? 0 : input.allCoverCount,
        INDIVIDUAL_RANK: Math.min(Infinity, ...ranks.filter(row => row.type === "INDIVIDUAL").map(row => row.rank)),
        TEAM_WIN: ranks.some(row => row.type === "TEAM" && row.rank === 1) ? 1 : 0,
        attendedCount: attended.size, activityCount: active.size,
    };
}
export function evaluateMission(mission: { id: string; kind: string; threshold: number; points: number }, progress: ReturnType<typeof missionProgress>) {
    const value = progress[mission.kind as MissionKind];
    const achieved = mission.kind === "ATTENDANCE" ? progress.activityCount > 0 && progress.attendedCount * 100 >= mission.threshold * progress.activityCount :
        mission.kind === "INDIVIDUAL_RANK" ? value <= mission.threshold :
        mission.kind === "REGULAR_AVERAGE" || mission.kind === "REGULAR_SCORE" ? value > 0 && value >= mission.threshold : value >= mission.threshold;
    return { ...mission, progress: Number.isFinite(value) ? value : null, achieved, earnedPoints: achieved ? mission.points : 0 };
}
export function snapshotMissionRanks(snapshot: string, type: string, date: Date): MissionRank[] {
    try {
        const data = JSON.parse(snapshot);
        if (data.version !== 1 || (type !== "INDIVIDUAL" && type !== "TEAM")) return [];
        const rows = type === "INDIVIDUAL" ? data.rows : data.individual;
        if (!Array.isArray(rows)) return [];
        return rows.flatMap(row => {
            const rank = type === "INDIVIDUAL" ? row.rank : Array.isArray(data.teams)
                ? data.teams.find((team: { competitionTeamId: unknown }) => team.competitionTeamId === row.competitionTeamId)?.finalRank : null;
            return typeof row.memberId === "string" && Number.isInteger(rank) && rank >= 1
                ? [{ memberId: row.memberId, type, rank, date }] : [];
        });
    } catch { return []; }
}
