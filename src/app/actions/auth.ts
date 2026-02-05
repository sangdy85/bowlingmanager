'use server';

import { signIn } from "@/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { generateVerificationToken } from "@/lib/tokens";
import { sendVerificationEmail, sendPasswordResetEmail } from "@/lib/mail";

export async function register(prevState: string | undefined, formData: FormData) {
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const code = formData.get("code") as string;

    if (!name || !email || !password || !code) {
        return "모든 필드를 입력해주세요.";
    }

    try {
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            return "이미 존재하는 이메일입니다.";
        }

        // Verify Code
        const verificationToken = await prisma.verificationToken.findFirst({
            where: { identifier: email, token: code },
        });

        if (!verificationToken) {
            return "인증 코드가 올바르지 않습니다.";
        }

        if (new Date(verificationToken.expires) < new Date()) {
            return "인증 코드가 만료되었습니다.";
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                emailVerified: new Date(),
            },
        });

        // Delete used token
        await prisma.verificationToken.delete({
            where: { identifier_token: { identifier: email, token: code } },
        });

    } catch (error) {
        return "회원가입 중 오류가 발생했습니다. 다시 시도해주세요.";
    }

    redirect("/login?message=registered");
}

export async function sendCode(email: string) {
    if (!email) return { success: false, message: "이메일을 입력해주세요." };

    try {
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            return { success: false, message: "이미 가입된 이메일입니다." };
        }

        const token = await generateVerificationToken(email);
        await sendVerificationEmail(token.identifier, token.token);
        return { success: true, message: "인증 코드가 발송되었습니다." };
    } catch (error) {
        return { success: false, message: "전송 중 오류가 발생했습니다." };
    }
}

export async function login(prevState: string | undefined, formData: FormData) {
    try {
        await signIn("credentials", {
            ...Object.fromEntries(formData),
            redirectTo: "/", // 메인으로 이동 (로그인 상태에 따라 UI 변화)
        });
    } catch (error) {
        if (error instanceof AuthError) {
            switch (error.type) {
                case "CredentialsSignin":
                    return "이메일 또는 비밀번호가 일치하지 않습니다.";
                default:
                    return "로그인 중 오류가 발생했습니다.";
            }
        }
        throw error;
    }
}

// Account Recovery Actions

export async function findEmail(name: string) {
    try {
        const users = await prisma.user.findMany({
            where: { name },
            select: { email: true, createdAt: true },
        });

        if (users.length === 0) {
            return { success: false, message: "해당 이름으로 가입된 계정이 없습니다." };
        }

        const maskedEmails = users.map(u => {
            const [local, domain] = u.email.split("@");
            const maskedLocal = local.length > 2
                ? local.substring(0, 2) + "*".repeat(local.length - 2)
                : local + "***";
            return {
                email: `${maskedLocal}@${domain}`,
                createdAt: u.createdAt
            };
        });

        return { success: true, data: maskedEmails };
    } catch (error) {
        return { success: false, message: "오류가 발생했습니다." };
    }
}

export async function requestPasswordReset(email: string) {
    try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return { success: false, message: "가입되지 않은 이메일입니다." };
        }

        // Reuse verification token logic but for password reset
        // You might want a separate model, but reusing is fine for MVP
        const token = await generateVerificationToken(email);
        await sendPasswordResetEmail(token.identifier, token.token);

        return { success: true, message: "인증 코드가 발송되었습니다." };
    } catch (error) {
        return { success: false, message: "오류가 발생했습니다." };
    }
}

export async function resetPassword(email: string, code: string, newPassword: string) {
    try {
        const verificationToken = await prisma.verificationToken.findFirst({
            where: { identifier: email, token: code },
        });

        if (!verificationToken) {
            return { success: false, message: "인증 코드가 올바르지 않습니다." };
        }

        if (new Date(verificationToken.expires) < new Date()) {
            return { success: false, message: "인증 코드가 만료되었습니다." };
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await prisma.user.update({
            where: { email },
            data: { password: hashedPassword },
        });

        await prisma.verificationToken.delete({
            where: { identifier_token: { identifier: email, token: code } },
        });

        return { success: true, message: "비밀번호가 변경되었습니다." };
    } catch (error) {
        return { success: false, message: "오류가 발생했습니다." };
    }
}
