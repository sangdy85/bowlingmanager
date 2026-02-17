'use server';

import prisma from "@/lib/prisma";

export async function getChampRoundResults(roundId: string) {
    try {
        // 1. Fetch Round with tournament settings (to know gameCount)
        const round = await prisma.leagueRound.findUnique({
            where: { id: roundId },
            include: {
                tournament: {
                    select: { settings: true, type: true }
                },
                participants: {
                    include: {
                        registration: {
                            include: {
                                user: true,
                                team: true
                            }
                        }
                    }
                }
            }
        });

        if (!round) throw new Error("라운드 정보를 찾을 수 없습니다.");

        const settings = round.tournament.settings ? JSON.parse(round.tournament.settings) : {};
        const gameCount = settings.gameCount || 3;

        // 2. Fetch all scores for this round using raw query (Prisma Client safety)
        const scores: any[] = await prisma.$queryRaw`
            SELECT "registrationId", "gameNumber", "score" 
            FROM "TournamentScore" 
            WHERE "roundId" = ${roundId}
        `;

        // 3. Process results per participant
        const results = round.participants.map((p: any) => {
            const pScores = scores.filter(s => s.registrationId === p.registrationId);
            const gameScores: Record<number, number> = {};
            let totalRaw = 0;
            let playedG = 0;

            for (let g = 1; g <= gameCount; g++) {
                const s = pScores.find(score => score.gameNumber === g);
                const val = s ? s.score : 0;
                gameScores[g] = val;
                totalRaw += val;
                if (val > 0) playedG++;
            }

            const handicap = p.registration.handicap || 0;
            const totalWithHandicap = totalRaw + (handicap * playedG);

            return {
                id: p.id,
                registrationId: p.registrationId,
                name: p.registration.user?.name || p.registration.guestName || 'Unknown',
                team: p.registration.guestTeamName || p.registration.team?.name || '-',
                lane: p.lane,
                handicap,
                gameScores,
                total: totalWithHandicap,
                playedG,
                isFemaleChamp: p.isFemaleChamp
            };
        });

        // 4. Sort by Total DESC, then Raw Total DESC, then Name ASC
        const rankedResults = results
            .filter(r => r.total > 0 || r.playedG > 0)
            .sort((a, b) => {
                if (b.total !== a.total) return b.total - a.total;
                // Tie breaker: Raw total (though total usually includes handicap per game, so total is primary)
                const aRaw = Object.values(a.gameScores).reduce((sum, v) => sum + v, 0);
                const bRaw = Object.values(b.gameScores).reduce((sum, v) => sum + v, 0);
                if (bRaw !== aRaw) return bRaw - aRaw;
                return a.name.localeCompare(b.name);
            });

        return {
            roundNumber: round.roundNumber,
            tournamentType: round.tournament.type,
            gameCount,
            results: rankedResults
        };

    } catch (error) {
        console.error("Failed to get champ round results:", error);
        throw error;
    }
}
