// Extracted verbatim from RoundFinalResultsTab; scoring and tie-break rules are unchanged.
export function getRoundFinalResults(round: any) {
    const settings = round.tournament?.settings ? JSON.parse(round.tournament.settings) : {};
    const gameCount = settings.gameCount || 3;
    const isEvent = round.tournament?.type === 'EVENT';
    const maxParticipants = settings.roundMaxParticipants?.[round.roundNumber] ?? round.tournament?.maxParticipants ?? settings.maxParticipants ?? 0;

    // Identify waitlisted participants to exclude from results
    // We strictly apply this only for EVENT tournaments to prevent missing data in CHAMP rounds
    const waitlistedRegIds = new Set(
        ((isEvent || round.tournament?.type === 'CHAMP') && maxParticipants > 0)
            ? [...round.participants]
                .sort((a, b) => {
                    const dateA = new Date(a.createdAt || 0).getTime();
                    const dateB = new Date(b.createdAt || 0).getTime();
                    return dateA - dateB;
                })
                .slice(maxParticipants)
                .map(p => p.registrationId)
            : []
    );

    // 1. Prepare and Sort Data
    const gameMode = settings.gameMode || 'INDIVIDUAL';
    const isTeamEvent = gameMode && gameMode.startsWith('TEAM_');

    let results = [];

    if (isTeamEvent) {
        // Aggregate by entryGroupId
        const groups: Record<string, any> = {};
        round.participants
            .filter((p: any) => !waitlistedRegIds.has(p.registrationId))
            .forEach((p: any) => {
                const groupId = p.registration.entryGroupId || p.id; // Fallback to p.id if no group
                if (!groups[groupId]) {
                    const groupNamePart = p.registration.entryGroupId?.includes('_name_') ? p.registration.entryGroupId.split('_name_')[1] : null;
                    const groupNumPart = p.registration.entryGroupId?.startsWith('group_') ? p.registration.entryGroupId.replace('group_', '') : null;

                    groups[groupId] = {
                        id: groupId,
                        members: [],
                        totalRaw: 0,
                        totalHandicap: 0,
                        gameScores: new Array(gameCount).fill(0),
                        teamName: groupNamePart || (groupNumPart ? `조: ${groupNumPart}` : (p.registration.guestTeamName ?? p.registration.team?.name) || '팀'),
                        handicapSum: 0
                    };
                }
                const pScores = round.individualScores.filter((s: any) => s.registrationId === p.registrationId);
                const handicap = p.handicap ?? p.registration?.handicap ?? 0;
                let pTotalCapped = 0;
                for (let g = 1; g <= gameCount; g++) {
                    const s = pScores.find((sc: any) => sc.gameNumber === g)?.score || 0;
                    if (s > 0) {
                        const capped = Math.min(s + handicap, 300);
                        groups[groupId].gameScores[g - 1] += capped;
                        pTotalCapped += capped;
                    }
                }
                groups[groupId].totalRaw += pTotalCapped; // Using totalRaw as capped total in this context
                groups[groupId].handicapSum += handicap;
                groups[groupId].members.push(p.registration.guestName ?? p.registration.user?.name ?? 'Unknown');
            });

        results = Object.values(groups).map((g: any) => {
            const validScores = g.gameScores.filter((s: number) => s > 0);
            const hiLow = validScores.length > 1 ? (Math.max(...validScores) - Math.min(...validScores)) : 0;
            return {
                id: g.id,
                name: g.members.join(', '),
                team: g.teamName,
                scores: g.gameScores,
                total: g.totalRaw, // totalRaw now contains capped sum
                handicapEach: g.handicapSum,
                totalHandicap: g.handicapSum * validScores.length,
                hiLow: hiLow,
                isTeam: true
            };
        });
    } else {
        const prevWinners = round.prevRoundWinners || {};
        const roundHandicaps = settings.roundMinusHandicaps?.[round.roundNumber] || {
            rank1: settings.minusHandicapRank1 || 0,
            rank2: settings.minusHandicapRank2 || 0,
            rank3: settings.minusHandicapRank3 || 0,
            female: settings.minusHandicapFemale || 0
        };
        const mRank1 = roundHandicaps.rank1;
        const mRank2 = roundHandicaps.rank2;
        const mRank3 = roundHandicaps.rank3;
        const mRankFemale = roundHandicaps.female;

        results = round.participants
            .filter((p: any) => !waitlistedRegIds.has(p.registrationId))
            .map((p: any) => {
                const pScores = round.individualScores.filter((s: any) => s.registrationId === p.registrationId);

                const handicap = p.handicap ?? p.registration?.handicap ?? 0;
                const pName = p.registration.guestName ?? p.registration.user?.name ?? 'Unknown';
                const pTeam = (p.registration.guestTeamName ?? p.registration.team?.name) || '개인회원';

                const scores: number[] = [];
                let totalRaw = 0;
                let gamesPlayed = 0;

                for (let g = 1; g <= gameCount; g++) {
                    const sRecord = pScores.find((s: any) => s.gameNumber === g);
                    const score = sRecord?.score || 0;
                    scores.push(score);
                    if (sRecord && score > 0) {
                        totalRaw += Math.min(score + handicap, 300);
                        gamesPlayed++;
                    } else if (sRecord) {
                        gamesPlayed++;
                    }
                }

                // 1. Calculate system penalty from previous round (minusApplied)
                let minusApplied = 0;
                let rankCap = 0; // The limit/cap based on the rank setting

                if (gamesPlayed === gameCount) {
                    const matchWinner = (winner: any) => winner && winner.name === pName && winner.team === pTeam;

                    if (matchWinner(prevWinners.rank1)) {
                        minusApplied += Math.abs(mRank1);
                        rankCap = Math.abs(mRank1);
                    } else if (matchWinner(prevWinners.rank2)) {
                        minusApplied += Math.abs(mRank2);
                        rankCap = Math.abs(mRank2);
                    } else if (matchWinner(prevWinners.rank3)) {
                        minusApplied += Math.abs(mRank3);
                        rankCap = Math.abs(mRank3);
                    }

                    if (matchWinner(prevWinners.femaleChamp)) {
                        minusApplied += Math.abs(mRankFemale);
                        // If no rankCap was set (not a top 3 winner but female champ), cap by female champ setting itself
                        if (rankCap === 0) rankCap = Math.abs(mRankFemale);
                    }

                    // [AUTO CAP] Limit the total system penalty by the rankCap (or highest of applied penalties)
                    // This ensures if rank1 is -20, the total minus won't exceed 20 even with female champ bonus.
                    if (minusApplied > rankCap && rankCap > 0) {
                        minusApplied = rankCap;
                    }
                }

                const validScores = scores.filter(s => s > 0);
                const hiLow = validScores.length > 1 ? (Math.max(...validScores) - Math.min(...validScores)) : 0;

                // Penalty Calculation (Non-cumulative vs Manual)
                // 1. Manual Penalty: From registration.handicap (if negative)
                // 2. System Penalty: From previous round result (minusApplied - now capped)
                const manualPenaltyTotal = handicap < 0 ? Math.abs(handicap) : 0;
                const systemPenaltyTotal = minusApplied;

                // Use the LARGER of the two penalties (Don't sum them up)
                const finalPenaltyTotal = Math.max(manualPenaltyTotal, systemPenaltyTotal);

                // Positive handicap is multiplied by games played,
                // while Negative handicap is a fixed total subtraction from the final sum.
                const positiveHandicapTotal = (handicap > 0 ? handicap : 0) * gamesPlayed;
                const finalHandicapValue = positiveHandicapTotal - finalPenaltyTotal;

                const total = totalRaw - (finalPenaltyTotal > 0 ? finalPenaltyTotal : 0);

                return {
                    id: p.registrationId,
                    name: pName,
                    team: pTeam,
                    scores: scores,
                    handicapEach: handicap,
                    totalHandicap: finalHandicapValue, // Display adjusted handicap
                    total,
                    hiLow,
                    hasMinusHandicap: minusApplied > 0
                };
            });
    }

    const sortedResults = results.map((r: any) => {
        const participant = round.participants.find((p: any) => p.registrationId === r.id);
        return { ...r, isFemaleChamp: participant?.isFemaleChamp || false };
    }).sort((a: any, b: any) => {
        if (b.total !== a.total) return b.total - a.total;

        // 1. 비핸디 점수(Scratch Score) 우선 정렬 (높은 순)
        const scratchA = a.total - (a.totalHandicap || 0);
        const scratchB = b.total - (b.totalHandicap || 0);
        if (scratchB !== scratchA) return scratchB - scratchA;

        // 2. 게임 하이로우 편차 정렬 (낮은 순)
        const hiLowA = a.hiLow || 0;
        const hiLowB = b.hiLow || 0;
        return hiLowA - hiLowB;
    });

    return { sortedResults, settings, gameCount, isTeamEvent };
}
