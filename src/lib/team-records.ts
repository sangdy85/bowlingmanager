export const TEAM_GAME_TYPES = ["정기전", "벙개", "상주", "교류전", "기타"] as const;

export const TEAM_RECORD_FILTERS = [
    "ALL",
    "REGULAR",
    "CASUAL",
    "HOUSE",
    "INTERCLUB",
    "OTHER",
] as const;

export type TeamRecordFilter = typeof TEAM_RECORD_FILTERS[number];

export type TeamRecordScore = {
    id: string;
    score: number;
    gameDate: Date;
    gameType: string | null;
    userId: string | null;
    guestName: string | null;
    memo?: string | null;
    createdAt?: Date;
    user: { name: string | null } | null;
};

export type TeamRecordMember = {
    id: string;
    userId: string;
    name: string;
};

const filterTypes: Record<TeamRecordFilter, readonly string[]> = {
    ALL: TEAM_GAME_TYPES,
    REGULAR: ["정기전"],
    CASUAL: ["벙개"],
    HOUSE: ["상주"],
    INTERCLUB: ["교류전"],
    OTHER: ["기타"],
};

export function isTeamRecordFilter(value: string): value is TeamRecordFilter {
    return TEAM_RECORD_FILTERS.includes(value as TeamRecordFilter);
}

export function normalizeTeamGameType(value: string | null) {
    return value || "기타";
}

export function filterTeamRecordScores(scores: TeamRecordScore[], filter: TeamRecordFilter) {
    const allowed = filterTypes[filter];
    return scores.filter((score) => allowed.includes(normalizeTeamGameType(score.gameType)));
}

const utcDateKey = (value: Date) => value.toISOString().slice(0, 10);
export const teamActivityDateKey = (value: Date) => new Date(value.getTime() + 9 * 60 * 60 * 1000)
    .toISOString().slice(0, 10);
const oneDecimal = (value: number) => Number(value.toFixed(1));

export function calculateTeamStatistics(
    scores: TeamRecordScore[],
    members: TeamRecordMember[],
    filter: TeamRecordFilter,
) {
    const filteredScores = filterTeamRecordScores(scores, filter);
    const memberNames = new Map(members.map((member) => [member.userId, member.name]));
    const activeDates = new Set(filteredScores.map((score) => utcDateKey(score.gameDate)));
    const stats = new Map<string, {
        id: string;
        name: string;
        attendedDates: Set<string>;
        gameCount: number;
        total: number;
        months: { total: number; count: number }[];
    }>();

    for (const score of filteredScores) {
        if (!score.userId) continue;
        let stat = stats.get(score.userId);
        if (!stat) {
            const member = members.find((candidate) => candidate.userId === score.userId);
            stat = {
                id: member?.id ?? publicParticipantId("former", score.userId),
                name: memberNames.get(score.userId) || score.user?.name || "알 수 없음",
                attendedDates: new Set<string>(),
                gameCount: 0,
                total: 0,
                months: Array.from({ length: 12 }, () => ({ total: 0, count: 0 })),
            };
            stats.set(score.userId, stat);
        }
        stat.attendedDates.add(utcDateKey(score.gameDate));
        stat.gameCount += 1;
        stat.total += score.score;
        const month = score.gameDate.getMonth();
        stat.months[month].total += score.score;
        stat.months[month].count += 1;
    }

    const activityCount = activeDates.size;
    const rawMemberRows = [...stats.values()].map((stat) => {
        const attendanceRaw = activityCount > 0
            ? stat.attendedDates.size / activityCount
            : 0;
        const averageRaw = stat.gameCount > 0 ? stat.total / stat.gameCount : 0;
        return {
            id: stat.id,
            name: stat.name,
            attendanceRaw,
            attendanceRate: oneDecimal(attendanceRaw * 100),
            attended: stat.attendedDates.size,
            activityCount,
            gameCount: stat.gameCount,
            monthlyAverages: stat.months.map((month) => month.count > 0
                ? Math.round(month.total / month.count)
                : null),
            total: stat.total,
            averageRaw,
            average: oneDecimal(averageRaw),
        };
    }).sort((left, right) =>
        right.attendanceRaw - left.attendanceRaw
        || right.averageRaw - left.averageRaw,
    );
    const memberRows = rawMemberRows.map((member) => ({
        id: member.id,
        name: member.name,
        attendanceRate: member.attendanceRate,
        attended: member.attended,
        activityCount: member.activityCount,
        gameCount: member.gameCount,
        monthlyAverages: member.monthlyAverages,
        total: member.total,
        average: member.average,
    }));

    const gameCount = memberRows.reduce((sum, member) => sum + member.gameCount, 0);
    const total = memberRows.reduce((sum, member) => sum + member.total, 0);
    const monthlyAverages = Array.from({ length: 12 }, (_, month) => {
        let monthTotal = 0;
        let monthCount = 0;
        for (const stat of stats.values()) {
            monthTotal += stat.months[month].total;
            monthCount += stat.months[month].count;
        }
        return monthCount > 0 ? Math.round(monthTotal / monthCount) : null;
    });

    return {
        summary: {
            activityCount,
            memberCount: memberRows.length,
            attendanceRate: rawMemberRows.length > 0
                ? oneDecimal(rawMemberRows.reduce((sum, member) => sum + member.attendanceRaw, 0) / rawMemberRows.length * 100)
                : 0,
            gameCount,
            monthlyAverages,
            total,
            average: gameCount > 0 ? oneDecimal(total / gameCount) : 0,
        },
        members: memberRows,
    };
}

export function createTeamActivities(
    teamId: string,
    scores: TeamRecordScore[],
    members: TeamRecordMember[],
    filter: TeamRecordFilter,
) {
    const groups = new Map<string, TeamRecordScore[]>();
    for (const score of filterTeamRecordScores(scores, filter)) {
        const date = teamActivityDateKey(score.gameDate);
        const group = groups.get(date);
        if (group) group.push(score);
        else groups.set(date, [score]);
    }

    return [...groups.entries()].map(([date, group]) => {
        const participants = createActivityParticipants(teamId, group, members);
        const total = group.reduce((sum, score) => sum + score.score, 0);
        return {
            id: createTeamActivityId(date, filter),
            date,
            gameType: group.find((score) => score.gameType)?.gameType ?? null,
            participantCount: participants.length,
            gameCount: group.length,
            dailyAverage: group.length > 0 ? oneDecimal(total / group.length) : 0,
        };
    }).sort((left, right) => right.date.localeCompare(left.date) || left.id.localeCompare(right.id));
}

export function createTeamActivityDetail(
    teamId: string,
    date: string,
    scores: TeamRecordScore[],
    members: TeamRecordMember[],
    filter: TeamRecordFilter,
) {
    const matching = filterTeamRecordScores(scores, filter)
        .filter((score) => teamActivityDateKey(score.gameDate) === date);
    if (matching.length === 0) return null;

    const participants = createActivityParticipants(teamId, matching, members);
    const total = matching.reduce((sum, score) => sum + score.score, 0);
    return {
        id: createTeamActivityId(date, filter),
        date,
        gameType: matching.find((score) => score.gameType)?.gameType ?? null,
        participantCount: participants.length,
        gameCount: matching.length,
        dailyAverage: oneDecimal(total / matching.length),
        participants,
    };
}

function createActivityParticipants(
    teamId: string,
    scores: TeamRecordScore[],
    members: TeamRecordMember[],
) {
    const memberByUserId = new Map(members.map((member) => [member.userId, member]));
    const grouped = new Map<string, { id: string; name: string; scores: number[] }>();
    for (const score of scores) {
        const member = score.userId ? memberByUserId.get(score.userId) : null;
        const key = score.userId ? `user:${score.userId}` : `guest:${score.guestName}`;
        let participant = grouped.get(key);
        if (!participant) {
            const guestName = `${score.guestName}(비)`;
            participant = {
                id: member?.id ?? publicParticipantId(
                    score.userId ? "former" : "guest",
                    `${teamId}:${score.userId ?? score.guestName}`,
                ),
                name: member?.name || (score.userId ? score.user?.name || "알 수 없음" : guestName),
                scores: [],
            };
            grouped.set(key, participant);
        }
        participant.scores.push(score.score);
    }

    return [...grouped.values()].map((participant) => {
        const total = participant.scores.reduce((sum, score) => sum + score, 0);
        return {
            ...participant,
            total,
            average: Number((total / participant.scores.length).toFixed(2)),
        };
    }).sort((left, right) => right.total - left.total)
        .map((participant, index) => ({ rank: index + 1, ...participant }));
}

function publicParticipantId(prefix: string, value: string) {
    let first = 0x811c9dc5;
    let second = 0x9e3779b9;
    for (let index = 0; index < value.length; index += 1) {
        const code = value.charCodeAt(index);
        first = Math.imul(first ^ code, 0x01000193);
        second = Math.imul(second ^ code, 0x85ebca6b);
    }
    const digest = [first, second]
        .map((part) => (part >>> 0).toString(16).padStart(8, "0"))
        .join("");
    return `${prefix}-${digest}`;
}

export function createTeamActivityId(date: string, filter: TeamRecordFilter) {
    return `${date}~${filter}`;
}

export function parseTeamActivityId(value: string) {
    const match = /^(\d{4}-\d{2}-\d{2})~([A-Z]+)$/.exec(value);
    if (!match || !isTeamRecordFilter(match[2])) return null;
    const date = new Date(`${match[1]}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== match[1]) return null;
    return { date: match[1], filter: match[2] };
}
