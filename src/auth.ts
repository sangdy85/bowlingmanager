import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Reverting auth.ts to the ultra-barebones version that we know didn't crash on its own
export const { auth, handlers, signIn, signOut } = NextAuth({
    ...authConfig,
    secret: process.env.AUTH_SECRET || "diag-secret-12345",
    providers: [],
    trustHost: true
});
