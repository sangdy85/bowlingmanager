import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Minimal Auth for Middleware (Edge-compatible)
export const { auth: middlewareAuth } = NextAuth(authConfig);

export default middlewareAuth;

export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
