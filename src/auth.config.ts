import type { NextAuthConfig } from "next-auth";

export const authConfig = {
    pages: {
        signIn: "/login",
    },
    callbacks: {
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user;
            const isProtectedRoute =
                nextUrl.pathname.startsWith('/dashboard') ||
                nextUrl.pathname.startsWith('/personal') ||
                nextUrl.pathname.startsWith('/team') ||
                nextUrl.pathname.startsWith('/stats');

            if (isProtectedRoute) {
                if (isLoggedIn) return true;
                return false; // Redirect to login
            }
            return true;
        },
        async session({ session, token }) {
            if (token.sub && session.user) {
                session.user.id = token.sub;
            }
            return session;
        },
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
            }
            return token;
        },
    },
    providers: [], // Empty array, we'll add providers in auth.ts
    secret: process.env.AUTH_SECRET,
} satisfies NextAuthConfig;
