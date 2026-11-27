"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import { getPrisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { generateVerificationToken } from "@/lib/tokens";
import { sendVerificationEmail, sendPasswordResetEmail } from "@/lib/mail";
import { checkCredentials } from "@/lib/credentials-auth";

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
        const credentialCheck = await checkCredentials(email, password);

        if (
            !credentialCheck.user
            || !credentialCheck.hasPassword
            || !credentialCheck.isPasswordValid
        ) {
            return "이메일 또는 비밀번호를 확인해주세요.";
        }

        if (!credentialCheck.isEmailVerified) {
            return "이메일 인증이 완료되지 않은 계정입니다.";
        }

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
    const rawName = formData.get("name") as string;
    const name = rawName?.replace(/\s/g, '');
    const code = formData.get("code") as string;

    if (!email || !password || !name || !code) {
        return "모든 필드를 입력해주세요.";
    }

    try {
        const prisma = getPrisma();

        // 1. Verify Code
        const verificationToken = await prisma.verificationToken.findFirst({
            where: { identifier: email, token: code }
        });

        if (!verificationToken || new Date(verificationToken.expires) < new Date()) {
            return "인증 코드가 틀리거나 만료되었습니다.";
        }
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
                emailVerified: new Date(), // Mark as verified since code was correct
                updatedAt: new Date(),
            },
        });

        // Delete used token
        await prisma.verificationToken.delete({
            where: {
                identifier_token: {
                    identifier: email,
                    token: code,
                }
            }
        });

        return redirect("/login?message=registered");
    } catch (error: any) {
        if (error.digest?.startsWith("NEXT_REDIRECT")) throw error;
        console.error("Registration failed.");
        return "회원가입 중 오류가 발생했습니다.";
    }
}

function maskEmail(email: string) {
    const separator = email.lastIndexOf("@");
    if (separator <= 0 || separator === email.length - 1) return "***";
    const local = email.slice(0, separator);
    const domain = email.slice(separator + 1);
    const visiblePrefix = local.length > 2 ? local.slice(0, 1) : "";
    return `${visiblePrefix}***@${domain}`;
}

export async function findEmail(name: string) {
    try {
        const prisma = getPrisma();
        const users = await prisma.user.findMany({
            where: { name },
            select: { email: true, createdAt: true },
            orderBy: { createdAt: "asc" },
        });
        if (users.length > 0) {
            return {
                success: true,
                data: users.map((user) => ({
                    email: maskEmail(user.email),
                    createdAt: user.createdAt,
                })),
            };
        }
        return { success: false, message: "일치하는 계정 정보를 찾을 수 없습니다." };
    } catch {
        return { success: false, message: "오류가 발생했습니다." };
    }
}

export async function sendCode(email: string) {
    try {
        const prisma = getPrisma();
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            return { success: true, message: "인증 코드가 발송되었습니다." };
        }

        const verificationToken = await generateVerificationToken(email);
        await sendVerificationEmail(verificationToken.identifier, verificationToken.token);

        return { success: true, message: "인증 코드가 발송되었습니다." };
    } catch {
        console.error("Verification email request failed.");
        return {
            success: false,
            message: "인증 코드 발송 중 오류가 발생했습니다."
        };
    }
}

export async function requestPasswordReset(email: string) {
    try {
        const prisma = getPrisma();
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (!existingUser?.password) {
            return { success: true, message: "비밀번호 재설정 인증 코드가 발송되었습니다." };
        }

        const verificationToken = await generateVerificationToken(email);
        await sendPasswordResetEmail(verificationToken.identifier, verificationToken.token);

        return { success: true, message: "비밀번호 재설정 인증 코드가 발송되었습니다." };
    } catch {
        console.error("Password reset email request failed.");
        return {
            success: false,
            message: "인증 코드 발송 중 오류가 발생했습니다."
        };
    }
}

export async function resetPassword(email: string, code: string, newPassword: string) {
    if (!email || !code || !newPassword) {
        return { success: false, message: "모든 필드를 입력해주세요." };
    }

    try {
        const prisma = getPrisma();

        // 1. Verify Code
        const verificationToken = await prisma.verificationToken.findFirst({
            where: { identifier: email, token: code }
        });

        if (!verificationToken || new Date(verificationToken.expires) < new Date()) {
            return { success: false, message: "인증 코드가 틀리거나 만료되었습니다." };
        }

        // 2. Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // 3. Update password
        await prisma.user.update({
            where: { email },
            data: {
                password: hashedPassword,
                updatedAt: new Date(),
            }
        });

        // 4. Delete used token
        await prisma.verificationToken.delete({
            where: {
                identifier_token: {
                    identifier: email,
                    token: code,
                }
            }
        });

        return { success: true, message: "비밀번호가 성공적으로 변경되었습니다." };
    } catch {
        console.error("Password reset failed.");
        return { success: false, message: "비밀번호 재설정 중 오류가 발생했습니다." };
    }
}

export async function signInWithProvider(provider: "google" | "naver") {
    try {
        await signIn(provider, { redirectTo: "/" });
    } catch (error: any) {
        if (error.digest?.startsWith("NEXT_REDIRECT")) throw error;
        throw error;
    }
}
