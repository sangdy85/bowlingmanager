'use server';

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { verifyCenterAdmin } from "@/lib/auth-utils";
import { LEAGUE_TEMPLATES } from "@/lib/league-templates";
import { getEffectiveRoundDate, getKSTDay, getKSTDateString, parseKSTDate } from "@/lib/tournament-utils";

/**
 * Fisher-Yates Shuffle Algorithm to randomize team assignments
 */
function shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

export async function generateLeagueSchedule(
    tournamentId: string,
    teamIds: string[],
    startLanes: number,
    endLanes: number,
    skippedDates: string[] = [], // YYYY-MM-DD
    startDateStr?: string,
    leagueDayParam?: number,
    splitTeamIds: string[] = []
) {
    const tournament = (await (prisma as any).tournament.findUnique({
        where: { id: tournamentId },
        select: { centerId: true, type: true, startDate: true, leagueDay: true, leagueTime: true }
    })) as any;

    if (!tournament || tournament.type !== 'LEAGUE') throw new Error("Invalid tournament type");
    await verifyCenterAdmin(tournament.centerId);

    // --- Split Teams Expansion (Squad-based) ---
    const finalTeamEntries: { id: string, squad: string | null }[] = [];
    const splitSet = new Set(splitTeamIds);

    for (const tid of teamIds) {
        if (splitSet.has(tid)) {
            finalTeamEntries.push({ id: tid, squad: 'A' });
            finalTeamEntries.push({ id: tid, squad: 'B' });
        } else {
            finalTeamEntries.push({ id: tid, squad: null });
        }
    }

    // Use finalTeamEntries instead of teamIds from here on
    const currentTeamEntries = finalTeamEntries;

    // Safety Check: Prevent regeneration if matches have started
    const existingRounds = await (prisma as any).leagueRound.findMany({
        where: { tournamentId },
        include: {
            matchups: {
                select: { status: true, scoreA1: true }
            }
        }
    });

    const hasStarted = existingRounds.some((r: any) =>
        r.matchups.some((m: any) => m.status !== 'PENDING' || m.scoreA1 !== null)
    );

    if (hasStarted) {
        throw new Error("이미 진행된 경기가 있어 대진표를 새로 생성할 수 없습니다. '일정 날짜 업데이트' 기능을 사용해 주세요.");
    }

    // Condition 1: Strict Even Team Enforcement (using expanded list)
    if (currentTeamEntries.length % 2 !== 0) {
        throw new Error("팀 수는 반드시 짝수여야 합니다. (부전승 없음)");
    }

    const numTeams = currentTeamEntries.length;

    // Condition 5: Template-Based Scheduling (USBC Standards)
    const template = LEAGUE_TEMPLATES[numTeams];
    if (!template) {
        throw new Error(`${numTeams}팀용 USBC 표준 양식이 아직 준비되지 않았습니다. (4, 6, 8, 10, 12, 14, 16팀 지원 지원 중)`);
    }

    const matchesPerRound = numTeams / 2;
    const lanePairsAvailable = Math.floor((endLanes - startLanes + 1) / 2);

    if (lanePairsAvailable < matchesPerRound) {
        throw new Error(`레인이 부족합니다. ${numTeams}팀 경기를 위해 최소 ${matchesPerRound}개의 레인 쌍(총 ${matchesPerRound * 2}개 레인)이 필요합니다.`);
    }

    // Randomized Mapping: Team Entries mapped to Template Numbers (1 to N)
    // CRITICAL: Ensure split teams (A/B) from the same ID are paired in Round 1.
    // In USBC templates, (1,2), (3,4), (5,6) etc. always meet in Round 1.

    const teamMap: Record<number, { id: string, squad: string | null }> = {};
    const remainingSlots = Array.from({ length: numTeams }, (_, i) => i + 1);

    // 1. Identify AB pairs
    const abPairs: { id: string }[] = [];
    const splitIds = Array.from(splitSet);
    for (const id of splitIds) {
        if (teamIds.includes(id)) {
            abPairs.push({ id });
        }
    }

    let currentSlotIndex = 0;
    const usedSlots = new Set<number>();

    // 2. Assign AB pairs to (1,2), (3,4), etc.
    for (const pair of abPairs) {
        const slotA = (currentSlotIndex * 2) + 1;
        const slotB = (currentSlotIndex * 2) + 2;

        // Randomly decide which is A and which is B slot-wise (to keep some randomness)
        const coinFlip = Math.random() > 0.5;
        teamMap[coinFlip ? slotA : slotB] = { id: pair.id, squad: 'A' };
        teamMap[coinFlip ? slotB : slotA] = { id: pair.id, squad: 'B' };

        usedSlots.add(slotA);
        usedSlots.add(slotB);
        currentSlotIndex++;
    }

    // 3. Assign remaining teams randomly
    const remainingTeams = currentTeamEntries.filter(entry =>
        !abPairs.some(p => p.id === entry.id)
    );
    const shuffledRemainingTeams = shuffleArray(remainingTeams);
    const availableSlots = remainingSlots.filter(s => !usedSlots.has(s));

    shuffledRemainingTeams.forEach((entry, index) => {
        teamMap[availableSlots[index]] = entry;
    });

    // Clear existing schedule
    await (prisma as any).leagueRound.deleteMany({
        where: { tournamentId }
    });

    const roundsCount = template.rounds.length;

    // Calculate dates based on provided parameters
    const getRoundDates = () => {
        const dates: Date[] = [];
        const effStartDate = startDateStr ? new Date(startDateStr) : new Date(tournament.startDate);
        const effLeagueDay = (leagueDayParam !== undefined) ? leagueDayParam : (tournament.leagueDay ?? 1);
        const skippedDateStrings = new Set(skippedDates);

        let currentDate = new Date(effStartDate);

        // Find first valid date matching day of week in KST
        let daysUntilFirst = (effLeagueDay - getKSTDay(currentDate) + 7) % 7;
        currentDate.setDate(currentDate.getDate() + daysUntilFirst);

        while (dates.length < roundsCount) {
            const dateStr = getKSTDateString(currentDate);
            if (!skippedDateStrings.has(dateStr)) {
                const finalDate = getEffectiveRoundDate(currentDate, tournament.leagueTime || "19:30");
                if (finalDate) dates.push(finalDate);
            }
            currentDate.setDate(currentDate.getDate() + 7);
        }

        return dates;
    };

    const roundDates = getRoundDates();

    // Iterate through template rounds and matchups
    for (let i = 0; i < roundsCount; i++) {
        const roundTemplate = template.rounds[i];

        const round = (await (prisma as any).leagueRound.create({
            data: {
                tournamentId,
                roundNumber: i + 1,
                date: roundDates[i] || null
            }
        })) as any;

        const matchups = roundTemplate.map(m => {
            const laneStart = startLanes + (m.lanePairIndex * 2);
            const teamAEntry = teamMap[m.teamA];
            const teamBEntry = teamMap[m.teamB];

            return {
                roundId: round.id,
                teamAId: teamAEntry.id,
                teamASquad: teamAEntry.squad,
                teamBId: teamBEntry.id,
                teamBSquad: teamBEntry.squad,
                lanes: `${laneStart}-${laneStart + 1}`,
                status: 'PENDING'
            };
        });

        await (prisma as any).leagueMatchup.createMany({
            data: matchups
        });
    }

    revalidatePath(`/centers/${tournament.centerId}/tournaments/${tournamentId}`);
}

export async function updateLeagueScheduleDates(
    tournamentId: string,
    skippedDates: string[] = [], // YYYY-MM-DD
    startDateStr?: string,
    leagueDayParam?: number
) {
    const tournament = (await (prisma.tournament as any).findUnique({
        where: { id: tournamentId },
        select: { centerId: true, type: true, startDate: true, leagueDay: true, leagueTime: true },
    })) as any;

    if (!tournament) throw new Error("Competition not found");
    await verifyCenterAdmin(tournament.centerId);

    const rounds = (await (prisma as any).leagueRound.findMany({
        where: { tournamentId },
        orderBy: { roundNumber: 'asc' }
    })) as any[];

    if (rounds.length === 0) throw new Error("No rounds found to update.");

    // Recalculate dates logic (Reused from generate)
    const roundsCount = rounds.length;
    const dates: Date[] = [];
    const effStartDate = startDateStr ? new Date(startDateStr) : new Date(tournament.startDate);
    const effLeagueDay = (leagueDayParam !== undefined) ? leagueDayParam : (tournament.leagueDay ?? 1);
    const [hours, minutes] = (tournament.leagueTime || "19:30").split(':').map(Number);
    const skippedDateStrings = new Set(skippedDates);

    let currentDate = new Date(effStartDate);
    let daysUntilFirst = (effLeagueDay - getKSTDay(currentDate) + 7) % 7;
    currentDate.setDate(currentDate.getDate() + daysUntilFirst);

    // Generate enough dates for all rounds
    while (dates.length < roundsCount) {
        const dateStr = getKSTDateString(currentDate);
        if (!skippedDateStrings.has(dateStr)) {
            const finalDate = getEffectiveRoundDate(currentDate, tournament.leagueTime || "19:30");
            if (finalDate) dates.push(finalDate);
        }
        currentDate.setDate(currentDate.getDate() + 7);
    }

    // Batch update via transaction
    const updates = rounds.map((round, index) =>
        (prisma as any).leagueRound.update({
            where: { id: round.id },
            data: { date: dates[index] || null }
        })
    );

    await (prisma as any).$transaction(updates);

    revalidatePath(`/centers/${tournament.centerId}/tournaments/${tournamentId}`);
}

export async function updateLeagueRoundDate(roundId: string, newDateStr: string) {
    const round = (await (prisma as any).leagueRound.findUnique({
        where: { id: roundId },
        include: { tournament: true }
    })) as any;

    if (!round) throw new Error("Round not found");
    await verifyCenterAdmin(round.tournament.centerId);

    // Use parseKSTDate to handle YYYY-MM-DD or YYYY-MM-DDTHH:mm
    const newDate = parseKSTDate(newDateStr);

    // If the input string was only a date (length 10) AND leagueTime exists, apply it
    // If length >= 16, it means time was explicitly provided by the user (EVENT or manual edit)
    if (newDate && newDateStr.length === 10 && round.tournament.leagueTime) {
        const [hours, minutes] = round.tournament.leagueTime.split(':').map(Number);
        // Correctly set hours/minutes in KST
        const kstOffset = 9 * 60 * 60000;
        const kstDate = new Date(newDate.getTime() + kstOffset);
        kstDate.setUTCHours(hours, minutes, 0, 0);
        const finalDate = new Date(kstDate.getTime() - kstOffset);

        await (prisma as any).leagueRound.update({
            where: { id: roundId },
            data: { date: finalDate }
        });
    } else {
        await (prisma as any).leagueRound.update({
            where: { id: roundId },
            data: { date: newDate }
        });
    }

    revalidatePath(`/centers/${round.tournament.centerId}/tournaments/${round.tournamentId}`);
}

export async function updateLeagueMatchupResult(matchupId: string, data: {
    teamAScores: {
        userId?: string;
        playerName?: string;
        teamId: string;
        teamSquad?: string | null;
        handicap: number;
        score1: number;
        score2: number;
        score3: number;
    }[];
    teamBScores: {
        userId?: string;
        playerName?: string;
        teamId: string;
        teamSquad?: string | null;
        handicap: number;
        score1: number;
        score2: number;
        score3: number;
    }[];
}) {
    const matchup = (await (prisma as any).leagueMatchup.findUnique({
        where: { id: matchupId },
        include: {
            round: { include: { tournament: true } },
            teamA: true,
            teamB: true
        }
    })) as any;

    if (!matchup) throw new Error("Matchup not found");
    await verifyCenterAdmin(matchup.round.tournament.centerId);

    const teamAScores = data.teamAScores;
    const teamBScores = data.teamBScores;
    const allIndividualScores = [...teamAScores, ...teamBScores];

    // Score validation (>300)
    if (allIndividualScores.some(s => (s.score1 || 0) > 300 || (s.score2 || 0) > 300 || (s.score3 || 0) > 300)) {
        throw new Error("300점을 초과하는 점수가 입력되었습니다.");
    }

    const hLimit = matchup.round.tournament.teamHandicapLimit;
    const aHRaw = teamAScores.reduce((sum, s) => sum + (s.handicap || 0), 0);
    const bHRaw = teamBScores.reduce((sum, s) => sum + (s.handicap || 0), 0);

    const aH = (hLimit !== null && aHRaw > hLimit) ? hLimit : aHRaw;
    const bH = (hLimit !== null && bHRaw > hLimit) ? hLimit : bHRaw;

    const aExcessH = Math.max(0, aHRaw - aH);
    const bExcessH = Math.max(0, bHRaw - bH);

    const calculateCappedTotal = (scores: any[], gameNum: number, excessH: number) => {
        return scores.reduce((sum, s) => sum + Math.min((s[`score${gameNum}`] || 0) + (s.handicap || 0), 300), 0) - excessH;
    };

    const aG1 = calculateCappedTotal(teamAScores, 1, aExcessH);
    const aG2 = calculateCappedTotal(teamAScores, 2, aExcessH);
    const aG3 = calculateCappedTotal(teamAScores, 3, aExcessH);
    const aTotal = aG1 + aG2 + aG3;

    const bG1 = calculateCappedTotal(teamBScores, 1, bExcessH);
    const bG2 = calculateCappedTotal(teamBScores, 2, bExcessH);
    const bG3 = calculateCappedTotal(teamBScores, 3, bExcessH);
    const bTotal = bG1 + bG2 + bG3;

    const getHiLow = (scores: any[], gameNum: number) => {
        const gameScores = scores.map(s => s[`score${gameNum}`] || 0);
        if (gameScores.length === 0) return 0;
        return Math.max(...gameScores) - Math.min(...gameScores);
    };

    const calculatePoints = (valA: number, valB: number, hA: number, hB: number, hiLowA: number, hiLowB: number) => {
        if (valA > valB) return [1, 0];
        if (valA < valB) return [0, 1];
        if (hA < hB) return [1, 0];
        if (hB < hA) return [0, 1];
        if (hiLowA < hiLowB) return [1, 0];
        if (hiLowB < hiLowA) return [0, 1];
        return [0.5, 0.5];
    };

    const pG1 = calculatePoints(aG1, bG1, aH, bH, getHiLow(teamAScores, 1), getHiLow(teamBScores, 1));
    const pG2 = calculatePoints(aG2, bG2, aH, bH, getHiLow(teamAScores, 2), getHiLow(teamBScores, 2));
    const pG3 = calculatePoints(aG3, bG3, aH, bH, getHiLow(teamAScores, 3), getHiLow(teamBScores, 3));

    const getSeriesHiLow = (g1: number, g2: number, g3: number) => {
        return Math.max(g1, g2, g3) - Math.min(g1, g2, g3);
    };

    const pTotal = calculatePoints(
        aTotal, bTotal, aH, bH,
        getSeriesHiLow(teamAScores.reduce((sum, s) => sum + (s.score1 || 0), 0), teamAScores.reduce((sum, s) => sum + (s.score2 || 0), 0), teamAScores.reduce((sum, s) => sum + (s.score3 || 0), 0)),
        getSeriesHiLow(teamBScores.reduce((sum, s) => sum + (s.score1 || 0), 0), teamBScores.reduce((sum, s) => sum + (s.score2 || 0), 0), teamBScores.reduce((sum, s) => sum + (s.score3 || 0), 0))
    );

    const pointsA = pG1[0] + pG2[0] + pG3[0] + pTotal[0];
    const pointsB = pG1[1] + pG2[1] + pG3[1] + pTotal[1];

    await (prisma as any).leagueMatchup.update({
        where: { id: matchupId },
        data: {
            scoreA1: aG1,
            scoreA2: aG2,
            scoreA3: aG3,
            scoreB1: bG1,
            scoreB2: bG2,
            scoreB3: bG3,
            pointsA,
            pointsB,
            status: 'FINISHED',
            individualScores: {
                deleteMany: {},
                createMany: {
                    data: allIndividualScores.map(s => ({
                        teamId: s.teamId,
                        teamSquad: s.teamSquad || null,
                        userId: s.userId || null,
                        playerName: s.playerName || null,
                        handicap: s.handicap,
                        score1: s.score1,
                        score2: s.score2,
                        score3: s.score3
                    }))
                }
            }
        }
    });

    revalidatePath(`/centers/${matchup.round.tournament.centerId}/tournaments/${matchup.round.tournamentId}`);
}

export async function updateLeagueRoundResults(roundId: string, results: {
    matchupId: string;
    teamAScores: any[];
    teamBScores: any[];
}[]) {
    const round = (await (prisma as any).leagueRound.findUnique({
        where: { id: roundId },
        include: { tournament: true }
    })) as any;

    if (!round) throw new Error("Round not found");
    await verifyCenterAdmin(round.tournament.centerId);

    // Score validation (>300) for all matchups in the bulk update
    results.forEach(res => {
        const allMatchupScores = [...res.teamAScores, ...res.teamBScores];
        if (allMatchupScores.some(s => (s.score1 || 0) > 300 || (s.score2 || 0) > 300 || (s.score3 || 0) > 300)) {
            throw new Error("300점을 초과하는 점수가 포함되어 있습니다.");
        }
    });

    const calculateCappedTotal = (scores: any[], gameNum: number, excessH: number) => {
        return scores.reduce((sum, s) => sum + Math.min((s[`score${gameNum}`] || 0) + (s.handicap || 0), 300), 0) - excessH;
    };

    const getHiLow = (scores: any[], gameNum: number) => {
        const gameScores = scores.map(s => s[`score${gameNum}`] || 0);
        if (gameScores.length === 0) return 0;
        return Math.max(...gameScores) - Math.min(...gameScores);
    };

    const calculatePoints = (valA: number, valB: number, hA: number, hB: number, hiLowA: number, hiLowB: number) => {
        if (valA > valB) return [1, 0];
        if (valA < valB) return [0, 1];
        if (hA < hB) return [1, 0];
        if (hB < hA) return [0, 1];
        if (hiLowA < hiLowB) return [1, 0];
        if (hiLowB < hiLowA) return [0, 1];
        return [0.5, 0.5];
    };

    const getSeriesHiLow = (g1: number, g2: number, g3: number) => {
        return Math.max(g1, g2, g3) - Math.min(g1, g2, g3);
    };

    const updates = results.map(res => {
        const teamAScores = res.teamAScores;
        const teamBScores = res.teamBScores;
        const allIndividualScores = [...teamAScores, ...teamBScores];

        const hLimit = round.tournament.teamHandicapLimit;
        const aHRaw = teamAScores.reduce((sum, s) => sum + (s.handicap || 0), 0);
        const bHRaw = teamBScores.reduce((sum, s) => sum + (s.handicap || 0), 0);

        const aH = (hLimit !== null && aHRaw > hLimit) ? hLimit : aHRaw;
        const bH = (hLimit !== null && bHRaw > hLimit) ? hLimit : bHRaw;

        const aExcessH = Math.max(0, aHRaw - aH);
        const bExcessH = Math.max(0, bHRaw - bH);

        const aG1 = calculateCappedTotal(teamAScores, 1, aExcessH);
        const aG2 = calculateCappedTotal(teamAScores, 2, aExcessH);
        const aG3 = calculateCappedTotal(teamAScores, 3, aExcessH);
        const aTotal = aG1 + aG2 + aG3;

        const bG1 = calculateCappedTotal(teamBScores, 1, bExcessH);
        const bG2 = calculateCappedTotal(teamBScores, 2, bExcessH);
        const bG3 = calculateCappedTotal(teamBScores, 3, bExcessH);
        const bTotal = bG1 + bG2 + bG3;

        const pG1 = calculatePoints(aG1, bG1, aH, bH, getHiLow(teamAScores, 1), getHiLow(teamBScores, 1));
        const pG2 = calculatePoints(aG2, bG2, aH, bH, getHiLow(teamAScores, 2), getHiLow(teamBScores, 2));
        const pG3 = calculatePoints(aG3, bG3, aH, bH, getHiLow(teamAScores, 3), getHiLow(teamBScores, 3));

        const pTotal = calculatePoints(
            aTotal, bTotal, aH, bH,
            getSeriesHiLow(teamAScores.reduce((sum, s) => sum + (s.score1 || 0), 0), teamAScores.reduce((sum, s) => sum + (s.score2 || 0), 0), teamAScores.reduce((sum, s) => sum + (s.score3 || 0), 0)),
            getSeriesHiLow(teamBScores.reduce((sum, s) => sum + (s.score1 || 0), 0), teamBScores.reduce((sum, s) => sum + (s.score2 || 0), 0), teamBScores.reduce((sum, s) => sum + (s.score3 || 0), 0))
        );

        const pointsA = pG1[0] + pG2[0] + pG3[0] + pTotal[0];
        const pointsB = pG1[1] + pG2[1] + pG3[1] + pTotal[1];

        return (prisma as any).leagueMatchup.update({
            where: { id: res.matchupId },
            data: {
                scoreA1: aG1,
                scoreA2: aG2,
                scoreA3: aG3,
                scoreB1: bG1,
                scoreB2: bG2,
                scoreB3: bG3,
                pointsA,
                pointsB,
                status: 'FINISHED',
                individualScores: {
                    deleteMany: {},
                    createMany: {
                        data: allIndividualScores.map(s => ({
                            teamId: s.teamId,
                            teamSquad: s.teamSquad || null,
                            userId: s.userId || null,
                            playerName: s.playerName || null,
                            handicap: s.handicap,
                            score1: s.score1,
                            score2: s.score2,
                            score3: s.score3
                        }))
                    }
                }
            }
        });
    });

    await (prisma as any).$transaction(updates);

    revalidatePath(`/centers/${round.tournament.centerId}/tournaments/${round.tournamentId}`);
}
