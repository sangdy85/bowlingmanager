import prisma from "@/lib/prisma";
import { getMobileApiUserId } from "@/lib/mobile-api/auth";
import {
    internalServerErrorResponse,
    mobileApiSuccess,
    unauthorizedResponse,
} from "@/lib/mobile-api/response";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    try {
        const userId = await getMobileApiUserId(request);
        if (!userId) return unauthorizedResponse();

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                handicap: true,
            },
        });

        if (!user) return unauthorizedResponse();

        return mobileApiSuccess(user);
    } catch (error) {
        console.error("Mobile API /me failed:", error);
        return internalServerErrorResponse();
    }
}
