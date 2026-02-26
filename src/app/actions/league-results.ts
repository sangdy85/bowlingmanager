'use server';

import prisma from "@/lib/prisma";

export async function getLeagueRoundResults(roundId: string) {
    try {
        const round = await (prisma as any).leagueRound.findUnique({
            where: { id: roundId },
            include: {
                tournament: {
                    select: { name: true, settings: true, type: true, teamHandicapLimit: true, reportNotice: true }
                },
                matchups: {
                    include: {
                        teamA: {
                            include: {
                                members: {
                                    include: {
                                        user: true
                                    }
                                }
                            }
                        },
                        teamB: {
                            include: {
                                members: {
                                    include: {
                                        user: true
                                    }
                                }
                            }
                        },
                        individualScores: {
                            include: { User: true, Team: true },
                            orderBy: { id: 'asc' }
                        }
                    }
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
        const teamHandicapLimit = round.tournament.teamHandicapLimit ?? settings.teamHandicapLimit;

        return {
            id: round.id,
            roundNumber: round.roundNumber,
            date: round.date,
            tournamentName: round.tournament.name,
            tournamentType: round.tournament.type,
            teamHandicapLimit,
            participants: round.participants.map((p: any) => ({
                id: p.id,
                registrationId: p.registrationId,
                sideBasic: p.sideBasic,
                sideBall: p.sideBall,
                sideExtra: p.sideExtra,
                registration: p.registration
            })),
            tournamentRegistrations: round.participants.map((p: any) => p.registration),
            matchups: round.matchups.map((m: any) => ({
                id: m.id,
                teamAId: m.teamAId,
                teamBId: m.teamBId,
                teamASquad: m.teamASquad,
                teamBSquad: m.teamBSquad,
                teamA: m.teamA,
                teamB: m.teamB,
                lanes: m.lanes,
                pointsA: m.pointsA,
                pointsB: m.pointsB,
                status: m.status,
                individualScores: m.individualScores.map((s: any) => ({
                    id: s.id,
                    userId: s.userId,
                    playerName: s.playerName,
                    teamId: s.teamId,
                    teamSquad: s.teamSquad,
                    handicap: s.handicap,
                    score1: s.score1,
                    score2: s.score2,
                    score3: s.score3
                }))
            }))
        };
    } catch (error) {
        console.error("Failed to fetch league round results:", error);
        throw error;
    }
}
