// Display calculations extracted unchanged from the official PNG match record.
export function getLeagueMatchTeamReport(match: any, isA: boolean, teamHandicapLimit?: number | null) {
const teamId = isA ? match.teamAId : match.teamBId;
const squad = isA ? match.teamASquad : match.teamBSquad;
const points = isA ? match.pointsA : match.pointsB;
const scores = match.individualScores?.filter((s: any) => s.teamId === teamId && s.teamSquad === squad) || [];
const oppId = isA ? match.teamBId : match.teamAId;
const oppSquad = isA ? match.teamBSquad : match.teamASquad;
const oppScores = match.individualScores?.filter((s: any) => s.teamId === oppId && s.teamSquad === oppSquad) || [];

const rawHandiSum = scores.reduce((sum: number, s: any) => sum + (s.handicap || 0), 0);
const oppRawHandiSum = oppScores.reduce((sum: number, s: any) => sum + (s.handicap || 0), 0);

const hLimit = teamHandicapLimit !== undefined && teamHandicapLimit !== null ? Number(teamHandicapLimit) : null;
const handiSum = (hLimit !== null && rawHandiSum > hLimit) ? hLimit : rawHandiSum;
const oppHandiSum = (hLimit !== null && oppRawHandiSum > hLimit) ? hLimit : oppRawHandiSum;

const excessH = Math.max(0, rawHandiSum - handiSum);
const oppExcessH = Math.max(0, oppRawHandiSum - oppHandiSum);

const g1 = scores.reduce((sum: number, s: any) => sum + Math.min((s.score1 || 0) + (s.handicap || 0), 300), 0) - excessH;
const g2 = scores.reduce((sum: number, s: any) => sum + Math.min((s.score2 || 0) + (s.handicap || 0), 300), 0) - excessH;
const g3 = scores.reduce((sum: number, s: any) => sum + Math.min((s.score3 || 0) + (s.handicap || 0), 300), 0) - excessH;

const oppG1 = oppScores.reduce((sum: number, s: any) => sum + Math.min((s.score1 || 0) + (s.handicap || 0), 300), 0) - oppExcessH;
const oppG2 = oppScores.reduce((sum: number, s: any) => sum + Math.min((s.score2 || 0) + (s.handicap || 0), 300), 0) - oppExcessH;
const oppG3 = oppScores.reduce((sum: number, s: any) => sum + Math.min((s.score3 || 0) + (s.handicap || 0), 300), 0) - oppExcessH;

const total = g1 + g2 + g3;
const oppTotal = oppG1 + oppG2 + oppG3;

const draws = points !== null && (points % 1) === 0.5 ? 1 : 0;
const isWinner = points !== null && points >= 3;

const getHiLow = (sList: any[], gameNum: number) => {
const gs = sList.map(s => s[`score${gameNum}`] || 0);
if (gs.length === 0) return 0;
return Math.max(...gs) - Math.min(...gs);
};

const getMarker = (valA: number, valB: number, hA: number, hB: number, hlA: number, hlB: number) => {
if (valA > valB) return 'O';
if (valA < valB) return 'X';
if (hA < hB) return 'O';
if (hB < hA) return 'X';
if (hlA < hlB) return 'O';
if (hlB < hlA) return 'X';
return draws > 0 && valA === valB ? '△' : '-';
};

const markers = [
getMarker(g1, oppG1, handiSum, oppHandiSum, getHiLow(scores, 1), getHiLow(oppScores, 1)),
getMarker(g2, oppG2, handiSum, oppHandiSum, getHiLow(scores, 2), getHiLow(oppScores, 2)),
getMarker(g3, oppG3, handiSum, oppHandiSum, getHiLow(scores, 3), getHiLow(oppScores, 3))
];

const getSeriesTotalRaw = (sList: any[], gameNum: number) => {
return sList.reduce((sum, s) => sum + (s[`score${gameNum}`] || 0), 0);
};

const getSeriesHiLow = (sList: any[]) => {
if (sList.length === 0) return 0;
const rg1 = getSeriesTotalRaw(sList, 1);
const rg2 = getSeriesTotalRaw(sList, 2);
const rg3 = getSeriesTotalRaw(sList, 3);
return Math.max(rg1, rg2, rg3) - Math.min(rg1, rg2, rg3);
};

const totalMark = getMarker(
total,
oppTotal,
handiSum,
oppHandiSum,
getSeriesHiLow(scores),
getSeriesHiLow(oppScores)
);


return { scores, handiSum, g1, g2, g3, total, oppTotal, markers, totalMark, isWinner };
}

// Preserve the official team-by-team image's existing display basis.
export function getLeaguePlayerReportValues(player: any) {
 const totalWithHandicap = player.totalRawPins + (player.handicap * player.gamesCount);
 const currentWeekWithHandicap = player.currentWeekPins || 0;
 return { totalWithHandicap, currentWeekWithHandicap, previousTotalWithHandicap: totalWithHandicap - currentWeekWithHandicap, average: (totalWithHandicap / (player.gamesCount || 1)).toFixed(1) };
}

export function leagueReportNotice(notice: string | null | undefined, awardMinGames: number) {
 return (notice || `* 개인 에버 / 개인 하이 / 단게임은 ${Math.ceil(awardMinGames / 3)}주(${awardMinGames}게임) 이상 참여자 대상\n* 모든 개인 기록(에버, 하이, 단게임)은 핸디캡 포함 기준입니다.\n* 단체전은 중복시상 가능하나 개인전은 중복시상 불가 (에버 1,2 > 하이 1 > 에버 3 > 단게임 1 ... 순)`).split('\n').filter(line => line.trim() !== '');
}

export function getLeaguePlayerGames(player: any): number[] {
    return [player.score1, player.score2, player.score3].map(score => Math.min((score || 0) + (player.handicap || 0), 300));
}
