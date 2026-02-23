import { getPrisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");
    const password = searchParams.get("password");
    const mode = searchParams.get("mode") || "password";

    if (!email) {
        return new Response("Missing email search param", { status: 400 });
    }

    try {
        const prisma = getPrisma();

        if (mode === "usage") {
            const user = await prisma.user.findUnique({
                where: { email },
                select: { id: true }
            });

            if (!user) {
                return new Response("User not found", { status: 404 });
            }

            // KST Date logic from gemini-score.ts
            const kstDate = new Date(new Date().getTime() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];

            // Use updateMany for safety if multiple usage rows exist for some reason, though unique constraint usually prevents it
            await (prisma as any).userApiUsage.updateMany({
                where: {
                    userId: user.id,
                    date: kstDate
                },
                data: {
                    count: 0
                }
            });

            return new Response(JSON.stringify({
                message: "AI usage reset successful",
                user: email,
                date: kstDate,
                newCount: 0
            }, null, 2), { status: 200 });
        } else {
            if (!password) {
                return new Response("Missing password search param for password reset mode", { status: 400 });
            }
            const hashedPassword = await bcrypt.hash(password, 10);

            const user = await prisma.user.update({
                where: { email },
                data: {
                    password: hashedPassword,
                    emailVerified: new Date() // Ensure email is also verified
                }
            });

            return new Response(JSON.stringify({
                message: "Password reset successful",
                user: user.email,
                status: "Email verified as well"
            }, null, 2), { status: 200 });
        }
    } catch (error: any) {
        return new Response("Error: " + error.message, { status: 500 });
    }
}
