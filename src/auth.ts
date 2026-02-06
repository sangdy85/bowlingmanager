import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { getPrisma } from "@/lib/prisma";
import { authConfig } from "./auth.config";

// Step-up: Adding the Provider but WITHOUT bcrypt yet to isolate the crash
export const { auth, handlers, signIn, signOut } = NextAuth({
    ...authConfig,
    secret: process.env.AUTH_SECRET || "diag-secret-12345",
    providers: [
        Credentials({
            async authorize(credentials) {
                // Dummy logic for now
                if (credentials?.email === "test@test.com") {
                    return { id: "1", name: "Test User", email: "test@test.com" };
                }
                return null;
            }
        })
    ],
    trustHost: true
});
