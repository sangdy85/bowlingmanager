// import NextAuth from "next-auth";
// import Credentials from "next-auth/providers/credentials";
// import { getPrisma } from "@/lib/prisma";
// import bcrypt from "bcryptjs";
// import { authConfig } from "./auth.config";

export const auth: any = () => ({ user: { name: "Diag User" } });
export const handlers: any = {
    GET: () => new Response("Auth GET Mock", { status: 200 }),
    POST: () => new Response("Auth POST Mock", { status: 200 }),
};
export const signIn: any = () => null;
export const signOut: any = () => null;
