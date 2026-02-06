"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import { getPrisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";

/**
 * NOTE: We keep these actions in a dedicated "use server" file.
 * We try to keep imports as clean as possible for client tree-shaking.
 */

export async function login(prevState: string | undefined, formData: FormData) {
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    if (!email || !password) {
        return "이메일과 비밀번호를 모두 입력해주세요.";
    }

    try {
        await signIn("credentials", {
            email,
            password,
            redirectTo: "/",
        });
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

        return redirect("/login?message=registered");
    } catch (error) {
        if (error instanceof Error && error.message.includes("redirect")) throw error;
        console.error("Registration error:", error);
        return "회원가입 중 오류가 발생했습니다.";
    }
}

export async function findEmail(name: string) {
    try {
        const prisma = getPrisma();
        const user = await prisma.user.findFirst({
            where: { name },
        });
        if (user) {
            return { success: true, email: user.email };
        }
        return { success: false, message: "사용자를 찾을 수 없습니다." };
    } catch (error) {
        return { success: false, message: "오류가 발생했습니다." };
    }
}

export async function sendCode(email: string) {
    return { success: true, message: "테스트 모드: 코드가 발송되었습니다." };
}

export async function requestPasswordReset(email: string) {
    return { success: true, message: "테스트 모드: 요청이 접수되었습니다." };
}

export async function resetPassword(email: string, code: string, newPassword: string) {
    return { success: true, message: "테스트 모드: 비밀번호가 변경되었습니다." };
}
