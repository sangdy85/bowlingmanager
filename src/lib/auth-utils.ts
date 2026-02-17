import { auth } from "@/auth";
import prisma from "@/lib/prisma";

export async function verifyCenterAdmin(centerId: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("로그인이 필요합니다.");

    const center = await prisma.bowlingCenter.findUnique({
        where: { id: centerId },
        include: { managers: true }
    });

    if (!center || !center.managers.some(m => m.id === session.user.id)) {
        throw new Error("해당 볼링장에 대한 관리 권한이 없습니다.");
    }

    return session.user.id;
}
