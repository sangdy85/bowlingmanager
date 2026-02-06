import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { getPrisma } from "@/lib/prisma";
import { authConfig } from "./auth.config";
import bcrypt from "bcryptjs";

export const { auth, handlers, signIn, signOut } = NextAuth({
    ...authConfig,
    providers: [
        Credentials({
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) return null;

                const prisma = getPrisma();
                const user = await prisma.user.findUnique({
                    where: { email: credentials.email as string }
                });

                if (!user || !user.password) return null;

                const isPasswordCorrect = await bcrypt.compare(
                    credentials.password as string,
                    user.password
                );

                if (isPasswordCorrect) {
                    return {
                        id: user.id,
                        name: user.name,
                        email: user.email,
                    };
                }
                return null;
            },
        }),
    ],
    session: {
        strategy: "jwt",
    },
    pages: {
        signIn: "/login",
    },
});
