'use server';

/* import { signIn } from "@/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { generateVerificationToken } from "@/lib/tokens";
import { sendVerificationEmail, sendPasswordResetEmail } from "@/lib/mail"; */

import { redirect } from "next/navigation";

export async function register(prevState: string | undefined, formData: FormData): Promise<string | undefined> {
    return "회원가입 기능이 진단 모드로 인해 비활성화되었습니다.";
}

export async function sendCode(email: string) {
    if (!email) return { success: false, message: "이메일을 입력해주세요." };
    console.log("DIAGNOSTIC: sendCode mock for", email);
    return { success: true, message: "진단 모드입니다: 인증 코드가 발송된 것으로 간주합니다 (123456)." };
}

export async function login(prevState: string | undefined, formData: FormData): Promise<string | undefined> {
    redirect("/login?message=diag_mode");
    return undefined;
}

export async function findEmail(name: string) {
    return { success: false, message: "진단 모드입니다." };
}

export async function requestPasswordReset(email: string) {
    return { success: true, message: "진단 모드: 재설정 코드 발송 간주." };
}

export async function resetPassword(email: string, code: string, newPassword: string) {
    return { success: true, message: "진단 모드: 비밀번호 변경 간주." };
}
