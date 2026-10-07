export type LeagueBandShareInput = {
    tournamentName: string;
    roundNumber: number;
    roundDate?: Date | string | null;
    teamStandings: Array<{
        name: string;
        wins: number;
        losses: number;
        totalPinfall: number;
    }>;
    topPlayers: Array<{
        name: string;
        teamName: string;
        gamesCount: number;
        totalHandicappedPins: number;
    }>;
    matchups: Array<{
        teamA?: { name?: string | null } | null;
        teamB?: { name?: string | null } | null;
        teamASquad?: string | null;
        teamBSquad?: string | null;
        pointsA?: number | null;
        pointsB?: number | null;
    }>;
    reportNotice?: string | null;
};

function formatTeamName(
    team: { name?: string | null } | null | undefined,
    squad?: string | null,
) {
    const base = team?.name?.trim() || "미정";
    return squad ? `${base} (${squad})` : base;
}

function formatAverage(player: LeagueBandShareInput["topPlayers"][number]) {
    if (!player.gamesCount) return "0.00";
    return (
        player.totalHandicappedPins / player.gamesCount
    ).toFixed(2);
}

function formatDate(value: Date | string | null | undefined) {
    if (!value) return null;

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;

    const parts = new Intl.DateTimeFormat("ko-KR", {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(date);

    const year = parts.find(part => part.type === "year")?.value;
    const month = parts.find(part => part.type === "month")?.value;
    const day = parts.find(part => part.type === "day")?.value;

    return year && month && day
        ? `${year}.${month}.${day}`
        : null;
}

export function buildLeagueWeeklyBandPost(
    input: LeagueBandShareInput,
): string {
    const lines: string[] = [];
    const date = formatDate(input.roundDate);

    lines.push(`🎳 ${input.tournamentName} ${input.roundNumber}주차 경기결과`);
    if (date) lines.push(`📅 ${date}`);

    lines.push("");
    lines.push("🏆 팀 순위");

    if (input.teamStandings.length === 0) {
        lines.push("- 확정된 팀 순위가 없습니다.");
    } else {
        input.teamStandings.forEach((team, index) => {
            lines.push(
                `${index + 1}. ${team.name} | ${team.wins}승 ${team.losses}패 | ${team.totalPinfall.toLocaleString("ko-KR")}핀`,
            );
        });
    }

    lines.push("");
    lines.push("📋 주차 경기결과");

    if (input.matchups.length === 0) {
        lines.push("- 확정된 경기 결과가 없습니다.");
    } else {
        input.matchups.forEach((match) => {
            const teamA = formatTeamName(
                match.teamA,
                match.teamASquad,
            );
            const teamB = formatTeamName(
                match.teamB,
                match.teamBSquad,
            );
            const pointsA = match.pointsA ?? "-";
            const pointsB = match.pointsB ?? "-";

            lines.push(
                `• ${teamA} ${pointsA} : ${pointsB} ${teamB}`,
            );
        });
    }

    lines.push("");
    lines.push("🔥 개인 에버 TOP 10");

    const topTen = input.topPlayers.slice(0, 10);
    if (topTen.length === 0) {
        lines.push("- 집계 가능한 개인 기록이 없습니다.");
    } else {
        topTen.forEach((player, index) => {
            lines.push(
                `${index + 1}. ${player.name} (${player.teamName}) - ${formatAverage(player)}`,
            );
        });
    }

    if (input.reportNotice?.trim()) {
        lines.push("");
        lines.push("📌 안내");
        input.reportNotice
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(Boolean)
            .forEach(line => lines.push(line));
    }

    lines.push("");
    lines.push("※ 전체 팀/개인 순위와 상세 기록은 BowlingManager 공식 결과표에서 확인할 수 있습니다.");

    return lines.join("\n");
}
