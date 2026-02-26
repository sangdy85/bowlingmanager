'use server';

import prisma from "@/lib/prisma";

export async function getLeagueLeaderboard(tournamentId: string, roundLimit?: number) {
    const tournament = await prisma.tournament.findUnique({
        where: { id: tournamentId },
        include: {
            leagueRounds: {
                orderBy: { roundNumber: 'asc' },
                include: {
                    matchups: {
                        where: { status: 'FINISHED' },
                        include: {
                            teamA: true,
                            teamB: true,
                            individualScores: {
                                include: { User: true }
                            }
                        }
                    }
                }
            },
            registrations: {
                include: { team: true, user: true }
            }
        }
    });

    if (!tournament) throw new Error("Tournament not found");

    // 1. Initialize Team Stats Map
    const teamStats: Record<string, {
        id: string;
        name: string;
        wins: number;
        losses: number;
        draws: number;
        points: number; // wins * 3 + draws * 1.5? Or just sum of match points? user said "score (wins x 3)"
        // Let's stick to: Points = Sum of Match Points. And "Score" column = Points * 3

        totalPinfall: number; // Including handicap
        gamesPlayed: number; // Match count * 3
        matchCount: number;

        highSeries: number;
        highGame: number;

        lastRoundScore: number;
        previousTotal: number; // Total - Last Round
        currentWeekScore: number; // Score for the specific roundLimit
        handicap: number; // Manual penalty or average?
    }> = {};

    // 2. Initialize Individual Stats Map
    const individualStats: Record<string, {
        userId: string | null;
        playerName: string;
        teamName: string;
        totalPinfall: number;
        totalGames: number;
        highSeries: number;
        highGame: number;
        currentWeekPins: number;
        previousTotalPins: number;
        handicap: number;
    }> = {};

    let lastRoundNumber = 0;
    if (tournament.leagueRounds.length > 0) {
        // Find the last round that has ANY finished matches, within the limit
        const playedRounds = tournament.leagueRounds.filter((r: any) => {
            const isWithinLimit = !roundLimit || r.roundNumber <= roundLimit;
            return isWithinLimit && r.matchups.some((m: any) => m.status === 'FINISHED');
        });
        if (playedRounds.length > 0) {
            lastRoundNumber = playedRounds[playedRounds.length - 1].roundNumber;
        }
    }

    // 3. Process Matchups
    const manualHandicaps = tournament.manualTeamHandicaps ? JSON.parse(tournament.manualTeamHandicaps) : {};
    const teamHandicapLimit = tournament.teamHandicapLimit;
    const awardMinGames = tournament.awardMinGames;

    for (const round of tournament.leagueRounds) {
        // Skip rounds beyond the limit
        if (roundLimit && round.roundNumber > roundLimit) continue;
        const isLastRound = round.roundNumber === lastRoundNumber;

        for (const match of round.matchups) {

            // Create a lookup for player -> squad based on THIS match's scores and registrations
            const squadLookup: Record<string, string | null> = {};
            match.individualScores.forEach((s: any) => {
                const key = s.userId ? `${s.userId}-${s.playerName || ''}` : (s.playerName || 'Unknown');
                if (s.teamSquad) {
                    squadLookup[key] = s.teamSquad;
                } else {
                    const reg = tournament.registrations.find((r: any) =>
                        (s.userId && r.userId === s.userId) || (!s.userId && r.guestName === s.playerName)
                    );
                    if (reg?.squad) squadLookup[key] = reg.squad;
                }
            });

            // Helper to calculate team game score with limits
            const calculateTeamGameScore = (teamId: string | null, squad: string | null, gameIndex: number, individualScores: any[]) => {
                if (!teamId) return 0;

                // Get players for this team AND squad in this match
                const teamScores = individualScores.filter(s => {
                    if (s.teamId !== teamId) return false;

                    const sKey = s.userId ? `${s.userId}-${s.playerName || ''}` : (s.playerName || 'Unknown');
                    const sSquad = s.teamSquad || squadLookup[sKey];
                    return sSquad === squad;
                });

                let rawScoreSum = 0;
                let handicapSum = 0;

                teamScores.forEach(s => {
                    if (gameIndex === 0) { rawScoreSum += s.score1; }
                    else if (gameIndex === 1) { rawScoreSum += s.score2; }
                    else { rawScoreSum += s.score3; }

                    handicapSum += s.handicap;
                });

                // Apply Team Handicap Limit
                let effectiveHandicap = handicapSum;
                if (teamHandicapLimit !== null && handicapSum > teamHandicapLimit) {
                    effectiveHandicap = teamHandicapLimit;
                }

                // Apply Manual Penalty (per game)
                const manualPenalty = manualHandicaps[teamId] || 0;

                return rawScoreSum + effectiveHandicap + manualPenalty;
            };

            // Helper to process team stats
            const processTeam = (teamId: string | null, squad: string | null, teamName: string, points: number, opponentPoints: number, individualScores: any[]) => {
                if (!teamId) return;

                const teamKey = squad ? `${teamId}-${squad}` : teamId;
                const displayName = squad ? `${teamName} (${squad})` : teamName;

                if (!teamStats[teamKey]) {
                    teamStats[teamKey] = {
                        id: teamId, // Store original teamId for reference
                        name: displayName,
                        wins: 0,
                        losses: 0,
                        draws: 0,
                        points: 0,
                        totalPinfall: 0,
                        gamesPlayed: 0,
                        matchCount: 0,
                        highSeries: 0,
                        highGame: 0,
                        lastRoundScore: 0,
                        previousTotal: 0,
                        currentWeekScore: 0,
                        handicap: 0
                    };
                }

                const stats = teamStats[teamKey];

                // Points (Wins) - trusting database for now
                stats.wins += points;
                stats.losses += opponentPoints;

                // Calculate Adjusted Scores
                const g1 = calculateTeamGameScore(teamId, squad, 0, individualScores);
                const g2 = calculateTeamGameScore(teamId, squad, 1, individualScores);
                const g3 = calculateTeamGameScore(teamId, squad, 2, individualScores);
                const series = g1 + g2 + g3;

                stats.totalPinfall += series;
                stats.gamesPlayed += 9;

                stats.matchCount += 1;

                // High Stats
                stats.highSeries = Math.max(stats.highSeries, series);
                stats.highGame = Math.max(stats.highGame, g1, g2, g3);

                // Last Round / Previous
                if (isLastRound) {
                    stats.lastRoundScore = series;
                    stats.currentWeekScore = series;
                } else {
                    stats.previousTotal += series;
                }

                stats.handicap = manualHandicaps[teamId] || 0;
            };

            // Team A
            processTeam(match.teamAId, (match as any).teamASquad, match.teamA?.name || 'Team A', match.pointsA || 0, match.pointsB || 0, match.individualScores);

            // Team B
            processTeam(match.teamBId, (match as any).teamBSquad, match.teamB?.name || 'Team B', match.pointsB || 0, match.pointsA || 0, match.individualScores);

            // Individual Stats (unchanged logic mostly, but use awardMinGames)
            for (const score of match.individualScores) {
                // Get squad for this score's team in this match
                // COMPOSITE KEY: Important to prevent different guests sharing the same userId (e.g. admin id) from merging
                const key = score.userId ? `${score.userId}-${score.playerName || ''}` : (score.playerName || 'Unknown');
                let currentSquad = score.teamSquad || squadLookup[key];

                if (!currentSquad) {
                    // Final fallback to match squads based on teamId
                    if (match.teamAId === match.teamBId) {
                        // Same team matchup! If we reach here, squadLookup (which uses registrations) 
                        // is our best hope. If it failed, we can try to find side by userId/playerName
                        // but it's risky. Let's stick to squadLookup's result which already handled registrations.
                    } else if (score.teamId === match.teamAId) {
                        currentSquad = (match as any).teamASquad;
                    } else if (score.teamId === match.teamBId) {
                        currentSquad = (match as any).teamBSquad;
                    }
                }

                const rawTeamName = match.teamAId === score.teamId ? match.teamA?.name : match.teamB?.name;
                const teamDisplayName = currentSquad ? `${rawTeamName} (${currentSquad})` : (rawTeamName || '-');

                const name = score.playerName || score.User?.name || 'Unknown';

                if (!individualStats[key]) {
                    individualStats[key] = {
                        userId: score.userId,
                        playerName: name,
                        teamName: teamDisplayName,
                        totalPinfall: 0,
                        totalGames: 0,
                        highSeries: 0,
                        highGame: 0,
                        currentWeekPins: 0,
                        previousTotalPins: 0,
                        handicap: 0
                    };
                } else {
                    // Update team name if currently a generic placeholder
                    if (individualStats[key].teamName === '-' || individualStats[key].teamName === 'Unknown') {
                        individualStats[key].teamName = teamDisplayName;
                    }
                }

                const s1 = score.score1;
                const s2 = score.score2;
                const s3 = score.score3;

                if (s1 > 0 || s2 > 0 || s3 > 0) {
                    const hTotal = score.handicap * 3;
                    const series = s1 + s2 + s3 + hTotal;
                    individualStats[key].totalPinfall += series;
                    individualStats[key].totalGames += 3;

                    individualStats[key].highSeries = Math.max(individualStats[key].highSeries, series);
                    individualStats[key].highGame = Math.max(individualStats[key].highGame, s1 + score.handicap, s2 + score.handicap, s3 + score.handicap);
                    individualStats[key].handicap = score.handicap;

                    if (isLastRound) {
                        individualStats[key].currentWeekPins = series;
                    } else {
                        individualStats[key].previousTotalPins += series;
                    }
                }
            }
        }
    }

    // Convert to Array and Sort
    const teamStandings = Object.values(teamStats).sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        return b.totalPinfall - a.totalPinfall;
    });

    // Awards
    const teamAverage = [...teamStandings].sort((a, b) => (b.totalPinfall / b.matchCount) - (a.totalPinfall / a.matchCount)).slice(0, 3);
    const teamHighSeries = [...teamStandings].sort((a, b) => b.highSeries - a.highSeries).slice(0, 3);
    const teamHighGame = [...teamStandings].sort((a, b) => b.highGame - a.highGame).slice(0, 3);

    // Individual Awards Filter
    // "12 (min games) ... if lower weeks, use current weeks count"
    // The user requirement: "If min is 12, but only 3 weeks passed (9 games), then NO award?"
    // "If low weeks, use processed weeks base. Ex: if they play all remaining and can reach 12, ok. If even with all remaining cannot reach 12, fail."
    // This is complex "Potential Games" logic.
    // Simplified: "If current total possible games so far >= 12, then require 12. If < 12, then require ??"
    // User said: "If week is low... set standard based on processed weeks."
    // "If 12 is set. Week 1 (3 games). Can anyone get award? Maybe no."
    // Let's implement definitive "Current Games >= awardMinGames" for now.
    // If the user wants "Potential", I need total rounds in tournament.
    // `tournament.leagueRounds.length` is total scheduled rounds.
    // Let's stick to strict threshold for verified awards.
    const totalRounds = tournament.leagueRounds.length;
    const minRequiredRounds = Math.ceil(awardMinGames / 3);
    // maxAbsences: How many rounds can a player miss in the WHOLE tournament?
    // If totalRounds < minRequiredRounds, we cap at 0 (must play all rounds)
    const maxAbsences = Math.max(0, totalRounds - minRequiredRounds);

    let individuals = Object.values(individualStats).filter(p => {
        if (p.totalGames === 0) return false; // Must have played at least one game
        if (p.playerName === 'Unknown') return false; // Skip placeholder names

        const playedRounds = p.totalGames / 3;
        // currentAbsences: How many rounds has the player missed SO FAR?
        const currentAbsences = Math.max(0, lastRoundNumber - playedRounds);

        // Qualification: Current absences must not exceed the maximum allowed for the tournament.
        return currentAbsences <= maxAbsences;
    });

    // --- Individual Awards Priority Logic ---
    // User Priority: Avg 1 -> Avg 2 -> Avg 3 -> Series 1 -> Game 1 -> Series 2 -> Game 2 -> Series 3 -> Game 3

    // Sort individuals for each category
    const sortedByAvg = [...individuals].sort((a, b) => (b.totalPinfall / b.totalGames) - (a.totalPinfall / a.totalGames));
    const sortedBySeries = [...individuals].sort((a, b) => b.highSeries - a.highSeries);
    const sortedByGame = [...individuals].sort((a, b) => b.highGame - a.highGame);

    const winners = new Set<string>();
    const allocated = {
        average: [] as any[],
        highSeries: [] as any[],
        highGame: [] as any[]
    };

    const getWinnerId = (p: any) => p.userId || p.playerName;

    // 1-3. Average 1st, 2nd, 3rd
    for (let i = 0; i < 3; i++) {
        const p = sortedByAvg.find(item => !winners.has(getWinnerId(item)));
        if (p) {
            winners.add(getWinnerId(p));
            allocated.average.push(p);
        }
    }

    // Define interleaving steps for Series and Game
    const steps = [
        { type: 'highSeries', list: sortedBySeries },
        { type: 'highGame', list: sortedByGame },
        { type: 'highSeries', list: sortedBySeries },
        { type: 'highGame', list: sortedByGame },
        { type: 'highSeries', list: sortedBySeries },
        { type: 'highGame', list: sortedByGame },
    ];

    for (const step of steps) {
        const p = step.list.find(item => !winners.has(getWinnerId(item)));
        if (p) {
            winners.add(getWinnerId(p));
            (allocated as any)[step.type].push(p);
        }
    }

    return {
        teamStandings,
        awards: {
            team: {
                average: teamAverage,
                highSeries: teamHighSeries,
                highGame: teamHighGame
            },
            individual: allocated
        },
        metadata: {
            currentRound: lastRoundNumber
        }
    };
}

export async function getIndividualLeaderboard(tournamentId: string, roundLimit?: number) {
    const tournament = await prisma.tournament.findUnique({
        where: { id: tournamentId },
        include: {
            leagueRounds: {
                orderBy: { roundNumber: 'asc' },
                include: {
                    matchups: {
                        where: { status: 'FINISHED' },
                        include: {
                            teamA: true,
                            teamB: true,
                            individualScores: {
                                include: { User: true }
                            }
                        }
                    }
                }
            },
            registrations: {
                include: { team: true, user: true }
            }
        }
    });

    if (!tournament) throw new Error("Tournament not found");

    // Grouping by TeamId then by PlayerKey
    const dataByTeam: Record<string, {
        teamId: string;
        teamName: string;
        players: Record<string, {
            userId: string | null;
            name: string;
            gamesCount: number;
            handicap: number;
            totalRawPins: number;
            highSeries: number;
            highGame: number;
            lastMatchRawScore: number;
            previousTotalRawPins: number;
            currentWeekPins: number;
        }>
    }> = {};

    const squadLookup: Record<string, string> = {};
    tournament.leagueRounds.forEach((round: any) => {
        round.matchups.forEach((match: any) => {
            match.individualScores.forEach((s: any) => {
                const key = s.userId ? `${s.userId}-${s.playerName || ''}` : (s.playerName || 'Unknown');
                if (s.teamSquad) squadLookup[key] = s.teamSquad;
                else {
                    const reg = tournament.registrations.find((r: any) =>
                        (s.userId && r.userId === s.userId) || (!s.userId && r.guestName === s.playerName)
                    );
                    if (reg?.squad) squadLookup[key] = reg.squad;
                }
            });
        });
    });

    let lastRoundNumber = 0;
    const playedRounds = tournament.leagueRounds.filter((r: any) => r.matchups.some((m: any) => m.status === 'FINISHED'));
    if (playedRounds.length > 0) {
        lastRoundNumber = playedRounds[playedRounds.length - 1].roundNumber;
    }

    // Process Matchups
    for (const round of tournament.leagueRounds) {
        // Skip rounds beyond the limit
        if (roundLimit && round.roundNumber > roundLimit) continue;
        const isLastRound = round.roundNumber === lastRoundNumber;

        for (const match of round.matchups) {
            for (const score of match.individualScores) {
                const curTeamId = score.teamId;
                if (!curTeamId) continue;

                // COMPOSITE KEY
                const playerKey = score.userId ? `${score.userId}-${score.playerName || ''}` : (score.playerName || 'Unknown');

                // Determine squad/team name for grouping using squadLookup too
                const squad = score.teamSquad || squadLookup[playerKey] || (match.teamAId === curTeamId && match.teamAId !== match.teamBId ? (match as any).teamASquad : (match.teamBId === curTeamId && match.teamAId !== match.teamBId ? (match as any).teamBSquad : null));
                const teamKey = squad ? `${curTeamId}-${squad}` : curTeamId;

                const rawTeamName = curTeamId === match.teamAId ? match.teamA?.name : match.teamB?.name;
                const displayTeamName = squad ? `${rawTeamName} (${squad})` : (rawTeamName || 'Unknown');

                if (!dataByTeam[teamKey]) {
                    dataByTeam[teamKey] = {
                        teamId: curTeamId,
                        teamName: displayTeamName,
                        players: {}
                    };
                }

                if (!dataByTeam[teamKey].players[playerKey]) {
                    dataByTeam[teamKey].players[playerKey] = {
                        userId: score.userId,
                        name: score.playerName || score.User?.name || 'Unknown',
                        gamesCount: 0,
                        handicap: score.handicap,
                        totalRawPins: 0,
                        highSeries: 0,
                        highGame: 0,
                        lastMatchRawScore: 0,
                        previousTotalRawPins: 0,
                        currentWeekPins: 0
                    };
                }

                const p = dataByTeam[teamKey].players[playerKey];
                const rawSeries = score.score1 + score.score2 + score.score3;

                if (rawSeries > 0) {
                    const hTotal = score.handicap * 3;
                    const hSeries = rawSeries + hTotal;
                    p.gamesCount += 3;
                    p.totalRawPins += rawSeries;
                    p.highSeries = Math.max(p.highSeries, hSeries);
                    p.highGame = Math.max(p.highGame, score.score1 + score.handicap, score.score2 + score.handicap, score.score3 + score.handicap);
                    p.handicap = score.handicap;

                    if (isLastRound) {
                        p.lastMatchRawScore = rawSeries;
                        p.currentWeekPins = hSeries;
                    } else {
                        p.previousTotalRawPins += rawSeries;
                    }
                }
            }
        }
    }

    // Convert to sorted array
    const sortedTeams = Object.values(dataByTeam)
        .sort((a, b) => a.teamName.localeCompare(b.teamName))
        .map(team => ({
            ...team,
            players: Object.values(team.players).sort((a, b) => {
                const aHavg = (a.totalRawPins + a.handicap * a.gamesCount) / (a.gamesCount || 1);
                const bHavg = (b.totalRawPins + b.handicap * b.gamesCount) / (b.gamesCount || 1);
                return bHavg - aHavg;
            })
        }));

    // Global Top List
    const avgTopRankCount = tournament.avgTopRankCount || 30;
    const avgMinParticipationPct = tournament.avgMinParticipationPct || 0;
    const totalPossibleGames = lastRoundNumber * 3;

    const allPlayers = Object.values(dataByTeam).flatMap(team =>
        Object.values(team.players).map(p => ({
            ...p,
            teamName: team.teamName
        }))
    );

    const topList = allPlayers
        .filter(p => {
            if (p.gamesCount === 0) return false;
            if (avgMinParticipationPct > 0) {
                const participationPct = (p.gamesCount / (totalPossibleGames || 1)) * 100;
                return participationPct >= avgMinParticipationPct;
            }
            return true;
        })
        .sort((a, b) => {
            const aTotalWithH = a.totalRawPins + a.handicap * a.gamesCount;
            const bTotalWithH = b.totalRawPins + b.handicap * b.gamesCount;
            return (bTotalWithH / (b.gamesCount || 1)) - (aTotalWithH / (a.gamesCount || 1));
        })
        .slice(0, avgTopRankCount);

    return {
        teams: sortedTeams,
        top30: topList,
        metadata: {
            currentRound: lastRoundNumber,
            totalPossibleGames,
            awardMinGames: tournament.awardMinGames,
            avgTopRankCount: tournament.avgTopRankCount,
            avgMinParticipationPct: tournament.avgMinParticipationPct,
            reportNotice: (tournament as any).reportNotice
        }
    };
}
