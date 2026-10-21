'use server';

import prisma from "@/lib/prisma";
import { getLeagueMemberOptions } from "@/lib/league-score-identity";
import { getCenterLeagueMembers } from "@/lib/center-league-identity";

export async function getLeagueRoundResults(roundId: string) {
    try {
        const round = await (prisma as any).leagueRound.findUnique({
            where: { id: roundId },
            include: {
                tournament: {
                    select: {
                        centerId: true, name: true, settings: true, type: true, teamHandicapLimit: true, manualTeamHandicaps: true, reportNotice: true,
                        registrations: { select: { userId: true, teamId: true, squad: true, user: { select: { name: true } } } }
                    }
                },
                matchups: {
                    include: {
                        teamA: {
                            include: {
                                members: {
                                    include: {
                                        user: { select: { id: true, name: true, handicap: true } }
                                    }
                                }
                            }
                        },
                        teamB: {
                            include: {
                                members: {
                                    include: {
                                        user: { select: { id: true, name: true, handicap: true } }
                                    }
                                }
                            }
                        },
                        individualScores: {
                            include: { User: { select: { id: true, name: true, handicap: true } }, Team: true },
                            orderBy: { id: 'asc' }
                        }
                    }
                },
                participants: {
                    include: {
                        registration: {
                            include: {
                                user: { select: { id: true, name: true, handicap: true } },
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
        const manualTeamHandicaps = round.tournament.manualTeamHandicaps ? JSON.parse(round.tournament.manualTeamHandicaps) : {};
        const useStoredTeamTotals = settings.historicalImport?.useStoredTeamTotals === true;

        return {
            id: round.id,
            roundNumber: round.roundNumber,
            date: round.date,
            tournamentName: round.tournament.name,
            tournamentType: round.tournament.type,
            registeredPlayers: [...getLeagueMemberOptions(round.tournament.registrations || []),
                ...await getCenterLeagueMembers(prisma, round.tournament.centerId)],
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
                manualTeamHandicaps,
                pointsA: m.pointsA,
                pointsB: m.pointsB,
                status: m.status,
                scoreA1: m.scoreA1,
                scoreA2: m.scoreA2,
                scoreA3: m.scoreA3,
                scoreB1: m.scoreB1,
                scoreB2: m.scoreB2,
                scoreB3: m.scoreB3,
                useStoredTeamTotals,
                individualScores: m.individualScores.map((s: any) => ({
                    id: s.id,
                    userId: s.userId,
                    // Older merges cleared playerName after linking userId.
                    // Prefer the score-sheet snapshot, then fall back to the
                    // linked account so public result tables never lose a name.
                    playerName: s.playerName || s.User?.name || null,
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
