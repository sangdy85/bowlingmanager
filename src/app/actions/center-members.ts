"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { v4 as uuidv4 } from "uuid";

export async function addCenterMember(centerId: string, userId: string, alias?: string) {
    const session = await auth();
    if (!session?.user) throw new Error("Unauthorized");

    // Check if user is manager of the center
    const center = await prisma.bowlingCenter.findUnique({
        where: { id: centerId },
        include: { managers: true }
    });

    if (!center || !center.managers.some(m => m.id === session.user?.id)) {
        throw new Error("Only managers can add members");
    }

    await prisma.centerMember.create({
        data: {
            id: uuidv4(),
            centerId,
            userId,
            alias
        }
    });

    revalidatePath(`/centers/${centerId}/members`);
    revalidatePath(`/centers/${centerId}`);
}

export async function removeCenterMember(centerId: string, memberId: string) {
    const session = await auth();
    if (!session?.user) throw new Error("Unauthorized");

    const center = await prisma.bowlingCenter.findUnique({
        where: { id: centerId },
        include: { managers: true }
    });

    if (!center || !center.managers.some(m => m.id === session.user?.id)) {
        throw new Error("Only managers can remove members");
    }

    await prisma.centerMember.delete({
        where: { id: memberId }
    });

    revalidatePath(`/centers/${centerId}/members`);
    revalidatePath(`/centers/${centerId}`);
}

export async function searchUsers(query: string) {
    if (!query || query.length < 2) return [];

    return await prisma.user.findMany({
        where: {
            OR: [
                { name: { contains: query } },
                { email: { contains: query } }
            ]
        },
        select: {
            id: true,
            name: true,
            email: true
        },
        take: 10
    });
}

export async function joinCenter(centerId: string, teamId: string | null, alias: string) {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, message: "로그인이 필요합니다." };
    }

    const userId = session.user.id;

    try {
        await prisma.$transaction(async (tx) => {
            // 1. Check if already a center member
            const existingMember = await tx.centerMember.findUnique({
                where: {
                    userId_centerId: {
                        userId: userId,
                        centerId: centerId
                    }
                }
            });

            if (existingMember) {
                // Allow updating team preference if already a member
                await tx.centerMember.update({
                    where: { id: existingMember.id },
                    data: { teamId: teamId || undefined }
                });
                return;
            }

            // 2. Create CenterMember with team preference
            await tx.centerMember.create({
                data: {
                    id: uuidv4(),
                    centerId,
                    userId,
                    teamId: teamId, // Save the selected team ID for future use
                    alias: alias // User name as alias
                }
            });

            // 3. If team selected, join team
            if (teamId) {
                // Check if already a team member (shouldn't be, but safety check)
                const existingTeamMember = await tx.teamMember.findUnique({
                    where: {
                        userId_teamId: {
                            userId: userId,
                            teamId: teamId
                        }
                    }
                });

                if (!existingTeamMember) {
                    await tx.teamMember.create({
                        data: {
                            id: uuidv4(),
                            teamId,
                            userId,
                            alias: alias
                        }
                    });
                }
            }
        });

        revalidatePath(`/centers/${centerId}`);
        return { success: true, message: "가입되었습니다." };
    } catch (error: any) {
        console.error("Join Center Error:", error);
        return { success: false, message: error.message || "가입 중 오류가 발생했습니다." };
    }
}
