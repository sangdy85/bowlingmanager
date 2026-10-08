export type WeeklyTeamStanding = {
    name: string;
    wins: number;
    losses: number;
    points: number;
    totalPinfall: number;
};

export type WeeklyPlayerStanding = {
    name: string;
    gamesCount: number;
    totalHandicappedPins: number;
};

export type WeeklyTeamPlayers = {
    teamName: string;
    players: WeeklyPlayerStanding[];
};

export type WeeklyMatchResult = {
    teamA: string;
    teamB: string;
    pointsA: number;
    pointsB: number;
    scoresA?: Array<number | null>;
    scoresB?: Array<number | null>;
};

export type LeagueWeeklyPostData = {
    tournamentName: string;
    iteration: number | null;
    week: number;
    teams: WeeklyTeamStanding[];
    individualByTeam: WeeklyTeamPlayers[];
    matches: WeeklyMatchResult[];
    averageTop: (WeeklyPlayerStanding & { teamName: string })[];
    detailUrl: string;
};

function number(value: number): string {
    return Math.round(value).toLocaleString('ko-KR');
}

function average(pins: number, games: number): string {
    return games > 0 ? (pins / games).toFixed(1) : '-';
}

function gameScores(scores?: Array<number | null>): string {
    return scores?.some(score => score !== null && score !== undefined)
        ? ` [${scores.map(score => score == null ? '-' : number(score)).join('/') }]`
        : '';
}

export function isLeagueWeekReady(matches: ReadonlyArray<{ status: string }>): boolean {
    return matches.length > 0 && matches.every(match => match.status === 'FINISHED');
}

// Read-only presentation of the official league leaderboard and selected week's matches.
export function buildLeagueWeeklyPost(data: LeagueWeeklyPostData): string {
    const iteration = data.iteration == null ? '' : `제 ${data.iteration}차 · `;
    const lines = [
        `🎳 [${data.tournamentName} ${iteration}${data.week}주차 경기 결과]`,
        '',
        '🏆 팀 순위표 (해당 주차까지 누적)',
    ];

    if (data.teams.length) {
        data.teams.forEach((team, index) => {
            lines.push(`${index + 1}위 ${team.name} · ${number(team.wins)}승 ${number(team.losses)}패 · ${number(team.totalPinfall)}핀`);
        });
    } else lines.push('집계된 팀 순위가 없습니다.');

    lines.push('', '👥 개인 순위표 (팀별 · 해당 주차까지 누적)');
    if (data.individualByTeam.length) {
        data.individualByTeam.forEach(team => {
            const players = team.players.filter(player => player.gamesCount > 0);
            if (!players.length) return;
            lines.push(`[${team.teamName}]`);
            players.forEach((player, index) => {
                lines.push(`  ${index + 1}. ${player.name} · AVG ${average(player.totalHandicappedPins, player.gamesCount)} (${player.gamesCount}G)`);
            });
        });
    } else lines.push('집계된 개인 순위가 없습니다.');

    lines.push('', `📝 ${data.week}주차 경기 결과`);
    if (data.matches.length) {
        data.matches.forEach((match, index) => {
            lines.push(`${index + 1}. ${match.teamA} ${number(match.pointsA)} : ${number(match.pointsB)} ${match.teamB}`);
            const a = gameScores(match.scoresA);
            const b = gameScores(match.scoresB);
            if (a || b) lines.push(`   게임별 ${match.teamA}${a} / ${match.teamB}${b}`);
        });
    } else lines.push('집계된 주차별 매치 결과가 없습니다.');

    lines.push('', '🔥 개인 평균 TOP (핸디 포함 · 해당 주차까지 누적)');
    if (data.averageTop.length) {
        data.averageTop.forEach((player, index) => {
            lines.push(`${index + 1}위 ${player.name} (${player.teamName}) · AVG ${average(player.totalHandicappedPins, player.gamesCount)} (${player.gamesCount}G)`);
        });
    } else lines.push('집계된 개인 평균 기록이 없습니다.');

    lines.push('', '📊 전체 순위·상세 결과 보기', data.detailUrl, '', 'BowlingManager 주차 결과 안내');
    return lines.join('\n');
}
