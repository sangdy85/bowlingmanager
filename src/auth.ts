import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { getPrisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { authConfig } from "./auth.config";

console.log("Initializing NextAuth...");
if (!process.env.AUTH_SECRET) {
    console.warn("WARNING: AUTH_SECRET is not defined in environment variables!");
}

let authResult: any = null;

function getAuth() {
    if (authResult) return authResult;

    console.log("Initializing NextAuth context...");
    try {
        if (!process.env.AUTH_SECRET) {
            console.error("CRITICAL: AUTH_SECRET IS NOT SET IN ENVIRONMENT!");
        }

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

                        if (!email || !password) return null;

                        const db = getPrisma();
                        const user = await db.user.findUnique({
                            where: { email },
                        });

                        if (!user) throw new Error("User not found");
                        if (!user.emailVerified) throw new Error("Email not verified");

                        const isPasswordValid = await bcrypt.compare(password, user.password);
                        if (!isPasswordValid) throw new Error("Invalid password");

                        return { id: user.id, email: user.email, name: user.name };
                    },
                }),
            ],
        });
        return authResult;
    } catch (e) {
        console.error("FAILED to initialize NextAuth:", e);
        return null;
    }
}

const initializedAuth = getAuth();

export const auth = initializedAuth?.auth || (async () => {
    console.warn("Auth called but not initialized");
    return null;
});
export const handlers = initializedAuth?.handlers || {
    GET: () => new Response("Auth Handler Not Initialized", { status: 500 }),
    POST: () => new Response("Auth Handler Not Initialized", { status: 500 })
};
export const signIn = initializedAuth?.signIn || (async () => { });
export const signOut = initializedAuth?.signOut || (async () => { });

