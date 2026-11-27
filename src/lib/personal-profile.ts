export const PERSONAL_RADAR_AXES = [
    { key: "AVERAGE", label: "기량(에버)" },
    { key: "POTENTIAL", label: "포텐셜" },
    { key: "CONSISTENCY", label: "기복" },
    { key: "FLOOR", label: "안정감" },
    { key: "ATTENDANCE", label: "성실" },
] as const;

type ProfileScore = { score: number; gameDate: Date };
type TeamRegularScore = ProfileScore & { teamId: string | null };
type ProfileSession = { scores: number[] };

const oneDecimal = (value: number) => Number(value.toFixed(1));
const utcDate = (value: Date) => value.toISOString().slice(0, 10);

function boundedPoint(value: number, base: number, step: number) {
    return Math.min(10, Math.max(1, 10 - (base - value) * step));
}

function spreadPoint(value: number) {
    return Math.min(10, Math.max(0, 10 - (value - 10) * 0.1));
}

function summarizeSessions(sessions: ProfileSession[]) {
    const scores = sessions.flatMap((session) => session.scores);
    const total = scores.reduce((sum, score) => sum + score, 0);
    const spreads = sessions.map((session) =>
        session.scores.length > 0
            ? Math.max(...session.scores) - Math.min(...session.scores)
            : 0,
    );
    const averageSpread = spreads.length > 0
        ? spreads.reduce((sum, spread) => sum + spread, 0) / spreads.length
        : 0;
    return {
        average: scores.length > 0 ? total / scores.length : 0,
        highScore: scores.length > 0 ? Math.max(...scores) : 0,
        lowScore: scores.length > 0 ? Math.min(...scores) : 0,
        gameCount: scores.length,
        roundCount: sessions.length,
        maxRoundAverage: sessions.length > 0
            ? Math.max(...sessions.map((session) =>
                session.scores.reduce((sum, score) => sum + score, 0) / session.scores.length,
            ))
            : 0,
        minRoundAverage: sessions.length > 0
            ? Math.min(...sessions.map((session) =>
                session.scores.reduce((sum, score) => sum + score, 0) / session.scores.length,
            ))
            : 0,
        averageSpread,
        roundedSpread: Math.round(averageSpread),
    };
}

/** Matches the five-axis calculations currently rendered by /personal. */
export function calculatePersonalProfile(input: {
    regularScores: ProfileScore[];
    officialSessions: ProfileSession[];
    allTeamRegularScores: TeamRegularScore[];
}) {
    const regularByDate = new Map<string, number[]>();
    for (const score of input.regularScores) {
        const date = utcDate(score.gameDate);
        const values = regularByDate.get(date);
        if (values) values.push(score.score);
        else regularByDate.set(date, [score.score]);
    }
    const regularSessions = [...regularByDate.values()].map((scores) => ({ scores }));
    const regular = summarizeSessions(regularSessions);
    const official = summarizeSessions(input.officialSessions);

    const teamRounds = new Set(input.allTeamRegularScores.map((score) =>
        `${utcDate(score.gameDate)}_${score.teamId || "unknown"}`,
    ));
    const attendanceRate = teamRounds.size > 0
        ? regular.roundCount / teamRounds.size * 100
        : 0;
    const totalGames = regular.gameCount + official.gameCount;
    const totalPins = regular.average * regular.gameCount + official.average * official.gameCount;

    const series: { key: string; label: string; color: string; values: number[] }[] = [];
    if (regular.roundCount >= 3) {
        series.push({
            key: "REGULAR",
            label: "정기전",
            color: "#3B82F6",
            values: [
                boundedPoint(regular.average, 234, 0.1),
                boundedPoint(regular.maxRoundAverage, 250, 0.2),
                spreadPoint(regular.averageSpread),
                boundedPoint(regular.minRoundAverage, 200, 0.1),
                Math.min(10, Math.max(1, attendanceRate / 10)),
            ],
        });
    }
    if (official.roundCount >= 3) {
        series.push({
            key: "OFFICIAL",
            label: "볼링장 대회",
            color: "#F59E0B",
            values: [
                boundedPoint(official.average, 234, 0.1),
                boundedPoint(official.maxRoundAverage, 250, 0.2),
                spreadPoint(official.averageSpread),
                boundedPoint(official.minRoundAverage, 200, 0.1),
                Math.min(10, Math.max(1, official.roundCount)),
            ],
        });
    }

    return {
        radar: { axes: PERSONAL_RADAR_AXES, series },
        regular: {
            average: oneDecimal(regular.average),
            highScore: regular.highScore,
            lowScore: regular.lowScore,
            gameCount: regular.gameCount,
            roundSpread: regular.roundedSpread,
            attendanceRate: oneDecimal(attendanceRate),
        },
        official: {
            average: oneDecimal(official.average),
            highScore: official.highScore,
            lowScore: official.lowScore,
            gameCount: official.gameCount,
            roundSpread: official.roundedSpread,
            roundCount: official.roundCount,
        },
        totalAverage: totalGames > 0 ? totalPins / totalGames : 0,
    };
}
