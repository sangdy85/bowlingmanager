import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import Naver from "next-auth/providers/naver";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const { auth, handlers, signIn, signOut } = NextAuth({
    ...authConfig,
    session: {
        strategy: "jwt",
        maxAge: 3 * 60 * 60, // 3 hours in seconds
    },
    providers: [
        Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        }),
        Naver({
            clientId: process.env.NAVER_CLIENT_ID,
            clientSecret: process.env.NAVER_CLIENT_SECRET,
        }),
        Credentials({
            name: "Email",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            authorize: async (credentials) => {
                const email = credentials.email as string | undefined;
                const password = credentials.password as string | undefined;

                if (!email || !password) {
                    return null;
                }

                const user = await prisma.user.findUnique({
                    where: { email },
                });

                if (!user) {
                    throw new Error("User not found");
                }

                if (!user.emailVerified) {
                    throw new Error("Email not verified");
                }

                if (!user.password) {
                    throw new Error("Social login user");
                }

                const isPasswordValid = await bcrypt.compare(password, user.password);

                if (!isPasswordValid) {
                    throw new Error("Invalid password");
                }

                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                };
            },
        }),
    ],
    callbacks: {
        ...authConfig.callbacks,
        async signIn({ user, account }) {
            if (account?.provider === "google" || account?.provider === "naver") {
                if (!user.email) return false;

                const rawName = user.name || "사용자";
                const cleanName = rawName.replace(/\s/g, '');

                const existingUser = await prisma.user.findUnique({
                    where: { email: user.email }
                });

                if (!existingUser) {
                    await prisma.user.create({
                        data: {
                            email: user.email,
                            name: cleanName,
                            password: null,
                            emailVerified: new Date(),
                            role: "USER"
                        }
                    });
                } else {
                    if (!existingUser.emailVerified) {
                        await prisma.user.update({
                            where: { email: user.email },
                            data: { emailVerified: new Date() }
                        });
                    }
                }
            }
            return true;
        },
        async session({ session, token }) {
            if (token.sub && session.user) {
                session.user.id = token.sub;
                session.user.role = token.role as string;
            }
            return session;
        },
        async jwt({ token, user, trigger, session, account }) {
            if (user) {
                if (account && (account.provider === "google" || account.provider === "naver")) {
                    const dbUser = await prisma.user.findUnique({
                        where: { email: user.email! }
                    });
                    if (dbUser) {
                        token.sub = dbUser.id;
                        token.id = dbUser.id;
                        token.role = dbUser.role;
                    }
                } else {
                    token.id = user.id;
                    token.role = (user as any).role;
                }
            }
            // Handle manual session update (role change)
            if (trigger === "update" && session?.role) {
                token.role = session.role;
            }
            return token;
        },
    },
    secret: process.env.AUTH_SECRET,
    trustHost: true
});

