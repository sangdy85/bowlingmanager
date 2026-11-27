'use server';

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

async function verifySuperAdmin() {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "SUPER_ADMIN") {
        throw new Error("Unauthorized");
    }
    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true },
    });
    if (user?.role !== "SUPER_ADMIN") throw new Error("Unauthorized");
    return session.user.id;
}

// Bowling Center Actions
export async function createBowlingCenter(formData: FormData) {
    await verifySuperAdmin();
    const name = formData.get("name") as string;
    const address = formData.get("address") as string;
    const phone = formData.get("phone") as string;
    const description = formData.get("description") as string;
    const ownerId = (await auth())?.user?.id;

    if (!ownerId) throw new Error("Owner not found");

    // Generate a random 6-digit code
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();

    await prisma.bowlingCenter.create({
        data: {
            name,
            address,
            phone,
            description,
            code,
            ownerId,
        },
    });

    revalidatePath("/admin/centers");
}

export async function deleteBowlingCenter(id: string) {
    await verifySuperAdmin();
    await prisma.bowlingCenter.delete({
        where: { id },
    });
    revalidatePath("/admin/centers");
}

// User Actions
export async function updateUserRole(userId: string, role: string) {
    await verifySuperAdmin();
    await prisma.user.update({
        where: { id: userId },
        data: { role },
    });
    revalidatePath("/admin/users");
}

export async function deleteUser(userId: string) {
    await verifySuperAdmin();
    // Protection for super admin
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
    });
    if (user?.role === "SUPER_ADMIN") throw new Error("Cannot delete Super Admin");

    await prisma.user.delete({
        where: { id: userId },
    });
    revalidatePath("/admin/users");
}

// Team Actions
export async function deleteTeam(teamId: string) {
    await verifySuperAdmin();
    // Soft delete by setting isActive to false
    await prisma.team.update({
        where: { id: teamId },
        data: { isActive: false } as any
    });
    revalidatePath("/admin/teams");
}

export async function setTeamBowlerHiddenEnabled(teamId: string, enabled: boolean) {
    await verifySuperAdmin();
    await prisma.team.update({
        where: { id: teamId },
        data: { bowlerHiddenEnabled: enabled },
    });
    revalidatePath("/admin/teams");
}
