import { getLeaguePlayerGames, getLeaguePlayerReportValues, leagueReportNotice } from '@/lib/league-report';

export type WeeklyTeamStanding = {
    name: string;
    wins: number;
    losses: number;
    points: number;
    totalPinfall: number;
    gamesPlayed?: number;
    highGame?: number;
    highSeries?: number;
    currentWeekScore?: number;
    previousTotal?: number;
};

export type WeeklyPlayerStanding = {
    name: string;
    gamesCount: number;
    totalHandicappedPins: number;
    totalRawPins?: number;
    handicap?: number;
    currentWeekPins?: number;
    highGame?: number;
    highSeries?: number;
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
    playersA?: any[];
    playersB?: any[];
    lanes?: string | null;
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
    awards?: { team: { average: any[]; highSeries: any[]; highGame: any[] }; individual: { average: any[]; highSeries: any[]; highGame: any[] } };
    awardMinGames?: number;
    reportNotice?: string | null;
    avgTopRankCount?: number;
};

function number(value: number): string {
    return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 }).format(value);
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
    const lines = [
        `🎳 [${data.tournamentName} · ${data.week}주차 경기 결과]`,
        data.iteration == null ? `📌 ${data.week}주차` : `📌 제 ${data.iteration}차 · ${data.week}주차`,
        '',
        '🏆 팀 순위표 (해당 주차까지 누적)',
    ];

    if (data.teams.length) {
        data.teams.forEach((team, index) => {
            lines.push(`${index + 1}위 ${team.name} · ${number(team.wins)}승 ${number(team.losses)}패 · 승점 ${number(team.wins * 3)} · ${number(team.totalPinfall)}핀 · AVG ${average(team.totalPinfall, team.gamesPlayed || 0)}`);
            lines.push(`   최고3G ${number(team.highSeries ?? 0)} / 단게임 ${number(team.highGame ?? 0)} · ${data.week}주차 ${number(team.currentWeekScore ?? 0)}핀 / 전주총합 ${number(team.previousTotal ?? 0)}핀`);
        });
    } else lines.push('집계된 팀 순위가 없습니다.');

    if (data.awards) {
        lines.push('', '🏅 시상 (공식 결과표 기준 · 선택 주차까지 누적)');
        for (const [key, label] of [['average', '에버'], ['highSeries', '하이게임'], ['highGame', '단게임']] as const) {
            lines.push(`팀 ${label}`);
            data.awards.team[key].forEach((team, index) => lines.push(`  ${index + 1}위 ${team.name} · ${key === 'average' ? average(team.totalPinfall, team.gamesPlayed) : number(key === 'highSeries' ? team.highSeries : team.highGame)}`));
            lines.push(`개인 ${label}`);
            data.awards.individual[key].forEach((player, index) => lines.push(`  ${index + 1}위 ${player.playerName} (${player.teamName}) · ${key === 'average' ? (player.totalPinfall / (player.totalGames || 1)).toFixed(2) : number(key === 'highSeries' ? player.highSeries : player.highGame)}`));
        }
        lines.push(...leagueReportNotice(data.reportNotice, data.awardMinGames ?? 36));
    }

    lines.push('', '👥 개인 순위표 (팀별 · 해당 주차까지 누적)');
    if (data.individualByTeam.length) {
        data.individualByTeam.forEach(team => {
            const players = team.players.filter(player => player.gamesCount > 0);
            if (!players.length) return;
            lines.push(`[${team.teamName}]`);
            players.forEach((player, index) => {
                const display = typeof player.totalRawPins === 'number' ? getLeaguePlayerReportValues(player) : null;
                lines.push(`  ${index + 1}. ${player.name} · AVG ${display?.average ?? average(player.totalHandicappedPins, player.gamesCount)} (${player.gamesCount}G) · ${number(display?.totalWithHandicap ?? player.totalHandicappedPins)}핀`);
                if (display) lines.push(`     ${data.week}주차 ${number(display.currentWeekWithHandicap)}핀 / 전주총합 ${number(display.previousTotalWithHandicap)}핀 · 최고3G ${number(player.highSeries ?? 0)} / 단게임 ${number(player.highGame ?? 0)}`);
            });
        });
    } else lines.push('집계된 개인 순위가 없습니다.');

    lines.push('', `📝 ${data.week}주차 경기 결과`);
    if (data.matches.length) {
        data.matches.forEach((match, index) => {
            lines.push(`${index + 1}. ${match.teamA} ${number(match.pointsA)} : ${number(match.pointsB)} ${match.teamB}`);
            const a = gameScores(match.scoresA);
            const b = gameScores(match.scoresB);
            if (a || b) lines.push(`   게임별 ${match.teamA}${a} / ${match.teamB}${b}${match.lanes ? ` · 레인 ${match.lanes}` : ''}`);
            for (const [team, players] of [[match.teamA, match.playersA], [match.teamB, match.playersB]] as const) {
                players?.forEach(player => {
                    const games = getLeaguePlayerGames(player);
                    lines.push(`   ${team} · ${player.playerName || player.User?.name || '이름 미등록'} · 핸디 ${number(player.handicap || 0)} · ${games.join('/')}`);
                });
            }
        });
    } else lines.push('집계된 주차별 매치 결과가 없습니다.');

    lines.push('', `🔥 개인 평균 TOP${data.avgTopRankCount ? ` ${data.avgTopRankCount}` : ''} (핸디 포함 · 해당 주차까지 누적)`);
    if (data.averageTop.length) {
        data.averageTop.forEach((player, index) => {
            lines.push(`${index + 1}위 ${player.name} (${player.teamName}) · AVG ${(player.totalHandicappedPins / (player.gamesCount || 1)).toFixed(2)} (${player.gamesCount}G)`);
        });
    } else lines.push('집계된 개인 평균 기록이 없습니다.');

    lines.push('', '📊 전체 순위·상세 결과 보기', data.detailUrl, '', 'BowlingManager 주차 결과 안내');
    return lines.join('\n');
}
