"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { v4 as uuidv4 } from "uuid";
import { linkCenterTeamGuestRecords } from "@/lib/center-league-identity";

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

    await prisma.$transaction(async tx => {
        await tx.centerMember.create({ data: { id: uuidv4(), centerId, userId, alias } });
        const memberships = await tx.teamMember.findMany({
            where: { userId, team: { centerId } }, select: { teamId: true },
        });
        for (const membership of memberships) {
            await linkCenterTeamGuestRecords(tx, centerId, membership.teamId, userId);
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
        const linked = await prisma.$transaction(async (tx) => {
            if (teamId && !await tx.team.findFirst({ where: { id: teamId, centerId }, select: { id: true } })) {
                throw new Error("해당 볼링장에 등록된 팀을 선택해주세요.");
            }
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
            } else {
                // 2. Create CenterMember with team preference
                await tx.centerMember.create({
                    data: { id: uuidv4(), centerId, userId, teamId, alias }
                });
            }

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
                return await linkCenterTeamGuestRecords(tx, centerId, teamId, userId);
            }
            return null;
        });

        revalidatePath(`/centers/${centerId}`, 'layout');
        revalidatePath('/personal');
        return { success: true, message: linked?.reviewRequired
            ? "가입되었습니다. 동명 회원 또는 중복 참가 기록이 있어 일부 과거 기록은 센터 관리자 확인이 필요합니다."
            : linked && (linked.linkedScores || linked.linkedRegistrations)
                ? "가입되었습니다. 같은 볼링장·팀·이름의 과거 기록이 계정에 연결되었습니다."
                : "가입되었습니다." };
    } catch (error: any) {
        console.error("Join Center Error:", error);
        return { success: false, message: error.message || "가입 중 오류가 발생했습니다." };
    }
}
