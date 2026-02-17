import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
    request: Request,
    { params }: { params: { roundId: string } }
) {
    try {
        const { roundId } = params;

        const round = await prisma.leagueRound.findUnique({
            where: { id: roundId },
        });

        if (!round) {
            return NextResponse.json({ error: 'Round not found' }, { status: 404 });
        }

        // Reuse logic from drawLane to find available slots
        const laneConfig = round.laneConfig ? JSON.parse(round.laneConfig) : {};
        const assignedParticipants = await prisma.roundParticipant.findMany({
            where: { roundId, lane: { not: null } },
            select: { lane: true }
        });
        const takenSlots = new Set(assignedParticipants.map(p => p.lane as number));

        const availableSlots: number[] = [];
        if (Object.keys(laneConfig).length > 0) {
            for (const [laneStr, slots] of Object.entries(laneConfig)) {
                const lane = parseInt(laneStr);
                const activeSlots = slots as number[];
                activeSlots.forEach(slot => {
                    const encoded = lane * 10 + slot;
                    if (!takenSlots.has(encoded)) {
                        availableSlots.push(encoded);
                    }
                });
            }
        } else if ((round as any).startLane && (round as any).endLane) {
            for (let i = (round as any).startLane; i <= (round as any).endLane; i++) {
                for (let k = 1; k <= 3; k++) {
                    const encoded = i * 10 + k;
                    if (!takenSlots.has(encoded)) {
                        availableSlots.push(encoded);
                    }
                }
            }
        }

        // Sort and return unique lanes (for the wheel, we might just want lanes 1, 2, 3...)
        // But since slots are encoded (Lane*10 + Slot), we should probably show Lane number on the wheel.
        // If multiple slots are in the same lane, we should show them as distinct entries or just the lane.
        // Let's show encoded slots as distinct entries because they are unique targets.

        return NextResponse.json({ lanes: availableSlots });
    } catch (error) {
        console.error('Failed to fetch available lanes:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
