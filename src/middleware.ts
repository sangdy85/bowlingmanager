import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
    const isLoggedIn = !!req.auth;
    const { nextUrl } = req;

    // Protected routes pattern
    const isProtectedRoute =
        nextUrl.pathname.startsWith('/dashboard') ||
        nextUrl.pathname.startsWith('/personal') ||
        nextUrl.pathname.startsWith('/team') ||
        nextUrl.pathname.startsWith('/stats');

    // If trying to access protected route while not logged in
    if (isProtectedRoute && !isLoggedIn) {
        return NextResponse.redirect(new URL('/login', nextUrl));
    }

    return NextResponse.next();
});

export const config = {
    // Skip static files and api routes
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
