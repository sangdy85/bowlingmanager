import type { NextAuthConfig } from "next-auth";

// This config is Edge-compatible (no Prisma, no Bcrypt)
export const authConfig = {
    pages: {
        signIn: "/login",
    },
    callbacks: {
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user;
            const isOnDashboard = nextUrl.pathname.startsWith('/dashboard');
            if (isOnDashboard) {
                if (isLoggedIn) return true;
                return false;
            }
            return true;
        },
    },
    providers: [],
} satisfies NextAuthConfig;
