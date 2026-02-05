import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { authConfig } from "./auth.config";

console.log("Initializing NextAuth...");
if (!process.env.AUTH_SECRET) {
    console.warn("WARNING: AUTH_SECRET is not defined in environment variables!");
}

let authResult: any = null;

try {
    authResult = NextAuth({
        ...authConfig,
        providers: [
            Credentials({
                name: "Email",
                credentials: {
                    email: { label: "Email", type: "email" },
                    password: { label: "Password", type: "password" },
                },
                authorize: async (credentials) => {
                    const email = credentials.email as string | undefined;
                    const password = credentials.password as string | undefined;

                    if (!email || !password) {
                        return null;
                    }

                    const user = await prisma.user.findUnique({
                        where: { email },
                    });

                    if (!user) {
                        throw new Error("User not found");
                    }

                    if (!user.emailVerified) {
                        throw new Error("Email not verified");
                    }

                    const isPasswordValid = await bcrypt.compare(password, user.password);

                    if (!isPasswordValid) {
                        throw new Error("Invalid password");
                    }

                    return {
                        id: user.id,
                        email: user.email,
                        name: user.name,
                    };
                },
            }),
        ],
    });
    console.log("NextAuth initialized successfully.");
} catch (e) {
    console.error("CRITICAL ERROR during NextAuth initialization:", e);
}

// Ensure exported values are at least functions to avoid "is not a function" errors
export const auth = authResult?.auth || (async () => null);
export const handlers = authResult?.handlers || { GET: async () => new Response(null, { status: 500 }), POST: async () => new Response(null, { status: 500 }) };
export const signIn = authResult?.signIn || (async () => { });
export const signOut = authResult?.signOut || (async () => { });

