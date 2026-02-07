import { getPrisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");
    const password = searchParams.get("password");

    if (!email || !password) {
        return new Response("Missing email or password search params", { status: 400 });
    }

    try {
        const prisma = getPrisma();
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
    } catch (error: any) {
        return new Response("Error: " + error.message, { status: 500 });
    }
}
