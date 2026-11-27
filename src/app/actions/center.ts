'use server';

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

export async function joinCenterAsAdmin(formData: FormData) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const code = formData.get("code") as string;
    if (!code) throw new Error("Code is required");

    // Find center by code
    const center = await prisma.bowlingCenter.findUnique({
        where: { code: code.toUpperCase() },
    });

    if (!center) {
        throw new Error("존재하지 않는 코드입니다.");
    }

    // Update user role and link to center as manager
    await prisma.user.update({
        where: { id: session.user.id },
        data: {
            role: 'CENTER_ADMIN',
            managedCenters: {
                connect: { id: center.id }
            }
        }
    });

    revalidatePath("/settings");
    return { success: true };
}

export async function leaveCenter() {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    await prisma.user.update({
        where: { id: session.user.id },
        data: {
            role: 'USER',
            managedCenters: {
                set: [] // Disconnect all managed centers
            }
        }
    });

    revalidatePath("/settings");
    return { success: true };
}

export async function updateBowlingCenter(centerId: string, formData: FormData) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("로그인이 필요합니다.");

    const name = formData.get("name") as string;
    const address = formData.get("address") as string;
    const phone = formData.get("phone") as string;
    const description = formData.get("description") as string;

    if (!name || !address) {
        throw new Error("볼링장 이름과 주소는 필수 입력 사항입니다.");
    }

    // Verify permission
    const center = await prisma.bowlingCenter.findUnique({
        where: { id: centerId },
        include: { managers: true }
    });

    if (!center) throw new Error("볼링장을 찾을 수 없습니다.");

    const isManager = center.managers.some(m => m.id === session.user.id) || center.ownerId === session.user.id;
    if (!isManager) throw new Error("수정 권한이 없습니다.");

    await prisma.bowlingCenter.update({
        where: { id: centerId },
        data: {
            name,
            address,
            phone,
            description
        }
    });

    revalidatePath(`/centers/${centerId}`);
    return { success: true };
}
