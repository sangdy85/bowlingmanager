import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { getPrisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { authConfig } from "./auth.config";

let authResult: any = null;

function getAuth() {
    if (authResult) return authResult;

    try {
        if (!process.env.AUTH_SECRET) {
            console.error("CRITICAL: AUTH_SECRET is not set in environment variables!");
            // Return a dummy object or null to prevent crash
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
        console.error("FAILED to initialize NextAuth lazy context:", e);
        return null;
    }
}

// Export lazy wrappers to prevent boot-time initialization
export const auth = (async (...args: any[]) => {
    const initialized = getAuth();
    return initialized ? (initialized.auth as any)(...args) : null;
}) as any;

export const handlers = new Proxy({} as any, {
    get: (target, prop) => {
        const initialized = getAuth();
        if (!initialized) {
            return async () => new Response("Auth not ready", { status: 500 });
        }
        return initialized.handlers[prop];
    }
});

export const signIn = (async (...args: any[]) => {
    const initialized = getAuth();
    return initialized ? (initialized.signIn as any)(...args) : null;
}) as any;

export const signOut = (async (...args: any[]) => {
    const initialized = getAuth();
    return initialized ? (initialized.signOut as any)(...args) : null;
}) as any;
