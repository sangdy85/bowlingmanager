"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import { getPrisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";

export async function login(prevState: string | undefined, formData: FormData) {
    try {
        await signIn("credentials", formData);
    } catch (error) {
        if (error instanceof AuthError) {
            switch (error.type) {
                case "CredentialsSignin":
                    return "이메일 또는 비밀번호가 잘못되었습니다.";
                default:
                    return "로그인 중 오류가 발생했습니다.";
            }
        }
        throw error;
    }
}

export async function register(prevState: string | undefined, formData: FormData) {
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const name = formData.get("name") as string;

    if (!email || !password || !name) {
        return "모든 필드를 입력해주세요.";
    }

    try {
        const prisma = getPrisma();
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            return "이미 가입된 이메일입니다.";
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await prisma.user.create({
            data: {
                email,
                name,
                password: hashedPassword,
            },
        });

        return redirect("/login");
    } catch (error) {
        console.error("Registration error:", error);
        return "회원가입 중 오류가 발생했습니다.";
    }
}
