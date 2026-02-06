'use server';

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";

export async function changePassword(prevState: any, formData: FormData) {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, message: "로그인이 필요합니다." };
    }

    const currentPassword = formData.get("currentPassword") as string;
    const newPassword = formData.get("newPassword") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (!currentPassword || !newPassword || !confirmPassword) {
        return { success: false, message: "모든 필드를 입력해주세요." };
    }

    if (newPassword !== confirmPassword) {
        return { success: false, message: "새 비밀번호가 일치하지 않습니다." };
    }

    try {
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
        });

        if (!user) {
            return { success: false, message: "사용자를 찾을 수 없습니다." };
        }

        const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isPasswordValid) {
            return { success: false, message: "현재 비밀번호가 올바르지 않습니다." };
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await prisma.user.update({
            where: { id: session.user.id },
            data: { password: hashedPassword },
        });

        return { success: true, message: "비밀번호가 성공적으로 변경되었습니다." };
    } catch (error) {
        console.error(error);
        return { success: false, message: "비밀번호 변경 중 오류가 발생했습니다." };
    }
}

export async function deleteAccount() {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, message: "로그인이 필요합니다." };
    }

    try {
        // Check if user is an owner of any team
        const ownedTeams = await prisma.team.findMany({
            where: { ownerId: session.user.id },
        });

        if (ownedTeams.length > 0) {
            const teamNames = ownedTeams.map(t => t.name).join(", ");
            return {
                success: false,
                message: `소유하고 있는 팀(${teamNames})이 있습니다. 팀 소유권을 이전하거나 팀을 삭제한 후 다시 시도해주세요.`
            };
        }

        // Deleting the user will cascade delete related data (Scores, TeamMembers, etc.) 
        // as defined in the Prisma schema (onDelete: Cascade).
        await prisma.user.delete({
            where: { id: session.user.id },
        });

        return { success: true, message: "계정이 삭제되었습니다." };
    } catch (error) {
        console.error(error);
        return { success: false, message: "계정 삭제 중 오류가 발생했습니다." };
    }
}
