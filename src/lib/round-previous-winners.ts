// Shared with the round page and BAND result-table export; scoring is unchanged.
export function getNextRoundWinners(r: any, tournamentSettings: any, currentRoundPrevWinners: any) {
    const gameCount = tournamentSettings.gameCount || 3;
    let runningPrevWinners: any = {};
    // Even for non-CHAMP, we track but only CHAMP uses it for handicap
    const roundHandicaps = tournamentSettings.roundMinusHandicaps?.[r.roundNumber] || {
        rank1: tournamentSettings.minusHandicapRank1 || 0,
        rank2: tournamentSettings.minusHandicapRank2 || 0,
        rank3: tournamentSettings.minusHandicapRank3 || 0,
        female: tournamentSettings.minusHandicapFemale || 0
    };

    const rankings = r.participants.map((p: any) => {
        const pScores = r.individualScores.filter((s: any) => s.registrationId === p.registrationId);
        const scoreList: number[] = [];
        let totalWithPlusHandicap = 0;
        let gamesPlayed = 0;
        const currentRoundHandicap = p.handicap ?? p.registration?.handicap ?? 0;
        const plusHandicap = currentRoundHandicap > 0 ? currentRoundHandicap : 0;

        for (let g = 1; g <= gameCount; g++) {
            const s = pScores.find((sc: any) => sc.gameNumber === g)?.score || 0;
            scoreList.push(s);
            if (s > 0) {
                totalWithPlusHandicap += Math.min(s + plusHandicap, 300);
                gamesPlayed++;
            }
        }

        const handicap = currentRoundHandicap;
        const pName = p.registration?.guestName ?? p.registration?.user?.name ?? 'Unknown';
        const pTeam = (p.registration?.guestTeamName ?? p.registration?.team?.name) || '개인';

        let minusApplied = 0;
        let rankCap = 0;
        // Negative handicap logic (Capped by rank winner)
        if (gamesPlayed === gameCount) {
            const matchWinner = (winner: any) => winner && winner.name === pName && winner.team === pTeam;
            if (matchWinner(currentRoundPrevWinners.rank1)) {
                minusApplied += Math.abs(roundHandicaps.rank1);
                rankCap = Math.abs(roundHandicaps.rank1);
            } else if (matchWinner(currentRoundPrevWinners.rank2)) {
                minusApplied += Math.abs(roundHandicaps.rank2);
                rankCap = Math.abs(roundHandicaps.rank2);
            } else if (matchWinner(currentRoundPrevWinners.rank3)) {
                minusApplied += Math.abs(roundHandicaps.rank3);
                rankCap = Math.abs(roundHandicaps.rank3);
            }
            if (matchWinner(currentRoundPrevWinners.femaleChamp)) {
                minusApplied += Math.abs(roundHandicaps.female);
                if (rankCap === 0) rankCap = Math.abs(roundHandicaps.female);
            }
            if (minusApplied > rankCap && rankCap > 0) minusApplied = rankCap;
        }

        const manualPenaltyTotal = handicap < 0 ? Math.abs(handicap) : 0;
        const finalPenaltyTotal = Math.max(manualPenaltyTotal, minusApplied);
        const total = totalWithPlusHandicap - finalPenaltyTotal;

        const validScores = scoreList.filter(s => s > 0);
        const hiLow = validScores.length > 1 ? (Math.max(...validScores) - Math.min(...validScores)) : 0;

        return {
            name: pName,
            team: pTeam,
            total,
            handicap,
            hiLow,
            isFemaleChamp: p.isFemaleChamp
        };
    })
        .filter((entry: any) => entry.total > 0)
        .sort((a: any, b: any) => {
            if (b.total !== a.total) return b.total - a.total;
            if (a.handicap !== b.handicap) return a.handicap - b.handicap;
            return a.hiLow - b.hiLow;
        });

    // Set winners for NEXT round
    runningPrevWinners = {};
    if (rankings.length > 0) runningPrevWinners.rank1 = { name: rankings[0].name, team: rankings[0].team };
    if (rankings.length > 1) runningPrevWinners.rank2 = { name: rankings[1].name, team: rankings[1].team };
    if (rankings.length > 2) runningPrevWinners.rank3 = { name: rankings[2].name, team: rankings[2].team };
    const fWinner = rankings.find((r: any) => r.isFemaleChamp);
    if (fWinner) runningPrevWinners.femaleChamp = { name: fWinner.name, team: fWinner.team };

    return runningPrevWinners;
}
