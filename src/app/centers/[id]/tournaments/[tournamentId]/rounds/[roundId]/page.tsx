import { getNextRoundWinners } from "@/lib/round-previous-winners";
import { auth } from "@/auth";
import { notFound, redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { isBandConfigured } from "@/lib/band/config";
import Link from "next/link";
import RoundDetailPageContent from "@/components/tournaments/RoundDetailPageContent";

import { calculateTournamentStatus, getEffectiveRoundDate } from "@/lib/tournament-utils";

export default async function RoundDetailPage({ params }: { params: Promise<{ id: string, tournamentId: string, roundId: string }> }) {
    const { id: centerId, tournamentId, roundId } = await params;
    const session = await auth();
    const now = new Date();

    // 1. Fetch Round with relations
    // ... (rest of the fetch logic stays same but we process results)
    const roundData = await prisma.leagueRound.findUnique({
        where: { id: roundId },
        include: {
            tournament: {
                include: {
                    registrations: {
                        include: {
                            user: true,
                            team: true
                        }
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
            },
            individualScores: true,
            matchups: {
                include: {
                    teamA: true,
                    teamB: true
                }
            },
            rawScores: true
        }
    });

    if (!roundData) notFound();

    // Parse tournament settings
    let tournamentSettings: any = {};
    try {
        if (roundData.tournament.settings) tournamentSettings = JSON.parse(roundData.tournament.settings);
    } catch (e) {
        console.error("Failed to parse settings", e);
    }

    // Serialize Dates inside participants
    const augmentedParticipants = roundData.participants.map((p: any) => ({
        ...p,
        registration: {
            ...p.registration,
            createdAt: p.registration?.createdAt?.toISOString() || null
        }
    }));

    // Calculate current round status with fallbacks for EVENT types
    // 1. Effective Date: Round Date -> Tournament Start Date
    const effectiveDate = getEffectiveRoundDate(
        roundData.date || roundData.tournament.startDate,
        roundData.tournament.leagueTime
    );

    // 2. Registration Start: Round RegStart -> Tournament Settings RegStart -> Tournament Start Date (fallback)
    const regStartFallback = roundData.registrationStart || tournamentSettings.registrationStart || roundData.tournament.startDate;

    const calculatedStatus = calculateTournamentStatus(
        effectiveDate,
        regStartFallback,
        roundData.date || roundData.tournament.startDate, // Use tournament date as fallback for end check
        roundData.tournament.status,
        now
    );

    // 2. Fetch All Rounds for sequential winner tracking & navigation
    const allRoundsRaw = await prisma.leagueRound.findMany({
        orderBy: { roundNumber: 'asc' },
        where: { tournamentId },
        include: {
            participants: {
                include: {
                    registration: {
                        include: {
                            user: true,
                            team: true
                        }
                    }
                }
            },
            individualScores: true
        }
    });

    // 3. Sequential winner tracking (CHAMP type logic)
    let runningPrevWinners: any = {};
    const processedRounds: any[] = [];

    for (const r of allRoundsRaw) {
        const currentRoundPrevWinners = { ...runningPrevWinners };

        runningPrevWinners = getNextRoundWinners(r, tournamentSettings, currentRoundPrevWinners);

        // Prepare for client serialization with fallbacks for EVENT types
        const roundDate = r.date || roundData.tournament.startDate;
        const roundRegStart = r.registrationStart || tournamentSettings.registrationStart || roundData.tournament.startDate;

        const rEffectiveDate = getEffectiveRoundDate(roundDate, roundData.tournament.leagueTime);
        const rStatus = calculateTournamentStatus(rEffectiveDate, roundRegStart, roundDate, roundData.tournament.status, now);

        processedRounds.push({
            ...r,
            date: r.date?.toISOString(),
            registrationStart: r.registrationStart?.toISOString(),
            effectiveDateStr: rEffectiveDate?.toISOString(),
            calculatedStatus: rStatus,
            prevRoundWinners: currentRoundPrevWinners, // History attached to each round
            participants: r.participants.map((p: any) => ({
                ...p,
                isManual: p.isManual === 1 || p.isManual === true
            }))
        });
    }

    // 4. Augment current round specifically
    const currentProcessedRound = processedRounds.find(r => r.id === roundId);
    if (!currentProcessedRound) notFound();

    const currentProcessedParticipants = currentProcessedRound.participants || [];

    const finalParticipants = roundData.participants.map((p: any) => {
        const registration = p.registration || {};
        return {
            ...p,
            isManual: currentProcessedParticipants.find((rp: any) => rp.id === p.id)?.isManual || false,
            registration: {
                ...registration,
                createdAt: registration.createdAt?.toISOString() || null
            }
        };
    });

    // Assemble final object
    const finalRoundRaw = {
        ...currentProcessedRound,
        participants: finalParticipants,
        matchups: roundData.matchups, // Carry over matchups
        rawScores: roundData.rawScores, // Carry over raw scores
        tournament: {
            ...roundData.tournament,
            startDate: roundData.tournament.startDate?.toISOString(),
            endDate: roundData.tournament.endDate?.toISOString(),
            rounds: processedRounds
        }
    };

    // 5. Final deep serialization
    const finalRound = JSON.parse(JSON.stringify(finalRoundRaw));

    // 6. Check Manager status and User Profile for manual matching
    const center = await prisma.bowlingCenter.findUnique({
        where: { id: centerId },
        select: {
            ownerId: true,
            managers: { select: { id: true } },
            bandConnection: { select: { enabled: true, bandKey: true } },
            CenterMember: {
                where: { userId: session?.user?.id },
                include: { Team: true, User: true }
            }
        }
    });

    const isManager = center?.ownerId === session?.user?.id ||
        center?.managers.some((m: any) => m.id === session?.user?.id);

    const bandPosts = isManager ? await (prisma as any).bandPost.findMany({
        where: { tournamentId, OR: [{ roundId }, { roundId: null }] },
        orderBy: { createdAt: 'desc' },
        select: { id: true, type: true, status: true, revision: true, createdAt: true, postedAt: true, errorMessage: true },
    }) : [];

    // Get current user's profile info for manual matching (Name + Team)
    const currentMember = center?.CenterMember?.[0];
    const userProfile = {
        name: currentMember?.alias || currentMember?.User?.name || session?.user?.name || null,
        teamName: currentMember?.Team?.name || null
    };

    return (
        <RoundDetailPageContent
            round={finalRound}
            userId={session?.user?.id}
            isManager={isManager}
            centerId={centerId}
            userProfile={userProfile}
            bandPublish={isManager ? {
                configured: isBandConfigured(),
                connected: Boolean(center?.bandConnection?.enabled && center?.bandConnection?.bandKey),
                posts: bandPosts.map((post: any) => ({
                    ...post,
                    createdAt: post.createdAt.toISOString(),
                    postedAt: post.postedAt?.toISOString() || null,
                })),
            } : undefined}
        />
    );
}
