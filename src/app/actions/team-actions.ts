'use server';

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { verifyCenterAdmin } from "@/lib/auth-utils";

export async function createResidentTeam(centerId: string, formData: FormData) {
    await verifyCenterAdmin(centerId);

    const name = formData.get("name") as string;
    const existingCode = formData.get("existingCode") as string;

    if (existingCode) {
        // Link existing team
        const team = await prisma.team.findUnique({
            where: { code: existingCode.toUpperCase() }
        });

        if (!team) throw new Error("입력하신 팀 코드를 찾을 수 없습니다.");
        if (team.centerId === centerId) throw new Error("이미 이 볼링장에 등록된 팀입니다.");

        // If it's already linked to another center, maybe allow switching or block it?
        // For now, let's allow switching behavior if the manager knows the code.

        await prisma.team.update({
            where: { id: team.id },
            data: { centerId }
        });
    } else {
        // Create new placeholder team
        if (!name) throw new Error("팀 이름을 입력하거나 팀 코드를 입력해주세요.");
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();

        await prisma.team.create({
            data: {
                name,
                code,
                centerId,
            } as any
        });
    }

    revalidatePath(`/centers/${centerId}/teams`);
}

export async function deleteResidentTeam(centerId: string, teamId: string) {
    await verifyCenterAdmin(centerId);

    const team = (await prisma.team.findUnique({
        where: { id: teamId },
        include: { members: true }
    })) as any;

    if (!team || team.centerId !== centerId) {
        throw new Error("삭제 권한이 없거나 팀을 찾을 수 없습니다.");
    }

    // If the team has an owner or members, it's a "real" team that was linked.
    // In that case, we should only UNLINK it (set centerId to null).
    // If it's a placeholder team (no owner, few members), we could delete it, 
    // but for safety, setting centerId to null is generally safer unless it's strictly a placeholder.

    // For soft delete: set isActive to false and unlink from center.
    // This preserves historical data in matchups, scores, etc.
    await prisma.team.update({
        where: { id: teamId },
        data: {
            isActive: false,
            centerId: null
        } as any
    });

    revalidatePath(`/centers/${centerId}/teams`);
}

export async function mergePlaceholderTeam(centerId: string, placeholderTeamId: string, formData: FormData) {
    await verifyCenterAdmin(centerId);

    const realCode = formData.get("realCode") as string;
    if (!realCode) throw new Error("연동할 정식 팀 코드를 입력해주세요.");

    // 1. Find teams
    const placeholderTeam = await prisma.team.findUnique({
        where: { id: placeholderTeamId },
        include: { members: true }
    });

    if (!placeholderTeam || placeholderTeam.centerId !== centerId) {
        throw new Error("임시 팀을 찾을 수 없거나 권한이 없습니다.");
    }

    const realTeam = await prisma.team.findUnique({
        where: { code: realCode.toUpperCase() },
        include: {
            members: {
                include: { user: true }
            }
        }
    }) as any;

    if (!realTeam) throw new Error("입력하신 코드를 가진 정식 팀을 찾을 수 없습니다.");
    if (realTeam.id === placeholderTeamId) throw new Error("동일한 팀입니다.");

    // Build a name -> userId map from the real team members
    const nameToUserId: Record<string, string> = {};
    if (realTeam.members) {
        realTeam.members.forEach((m: any) => {
            if (m.user?.name) {
                nameToUserId[m.user.name] = m.userId;
            }
            // Also consider alias if available
            if (m.alias) {
                nameToUserId[m.alias] = m.userId;
            }
        });
    }

    // 2. Migrate Data
    // Use transaction for safety
    await prisma.$transaction(async (tx) => {
        // Migrate Matchups (Team A)
        await tx.leagueMatchup.updateMany({
            where: { teamAId: placeholderTeamId },
            data: { teamAId: realTeam.id }
        });

        // Migrate Matchups (Team B)
        await tx.leagueMatchup.updateMany({
            where: { teamBId: placeholderTeamId },
            data: { teamBId: realTeam.id }
        });

        // Migrate Individual Scores in Matchups
        await tx.leagueMatchupIndividualScore.updateMany({
            where: { teamId: placeholderTeamId },
            data: { teamId: realTeam.id }
        });

        // Migrate Tournament Registrations
        await tx.tournamentRegistration.updateMany({
            where: { teamId: placeholderTeamId },
            data: { teamId: realTeam.id }
        });

        // Migrate Scores
        await tx.score.updateMany({
            where: { teamId: placeholderTeamId },
            data: { teamId: realTeam.id }
        });

        // Migrate Posts
        await tx.post.updateMany({
            where: { teamId: placeholderTeamId },
            data: { teamId: realTeam.id }
        });

        // --- NEW: Link Records to Real Users by Name Matching ---
        for (const [name, userId] of Object.entries(nameToUserId)) {
            // Link Matchup Scores
            await tx.leagueMatchupIndividualScore.updateMany({
                where: {
                    teamId: realTeam.id,
                    userId: null,
                    playerName: name
                },
                data: { userId }
            });

            // Link Tournament Registrations
            await tx.tournamentRegistration.updateMany({
                where: {
                    teamId: realTeam.id,
                    userId: null,
                    guestName: name
                },
                data: { userId }
            });

            // Link General Scores
            await tx.score.updateMany({
                where: {
                    teamId: realTeam.id,
                    userId: null,
                    guestName: name
                },
                data: { userId }
            });
        }

        // 3. Update Real Team's Center
        await tx.team.update({
            where: { id: realTeam.id },
            data: { centerId }
        });

        // 4. Delete Placeholder Team
        await tx.team.delete({
            where: { id: placeholderTeamId }
        });
    });

    revalidatePath(`/centers/${centerId}/teams`);
    return { success: true };
}
