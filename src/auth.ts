import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

export const { auth, handlers, signIn, signOut } = NextAuth({
    ...authConfig,
    secret: process.env.AUTH_SECRET || "diag-secret-12345",
    providers: [],
    trustHost: true
});
