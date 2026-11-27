import "server-only";

import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";

// Public, non-secret bcrypt hash used only to reduce user-enumeration timing gaps.
const DUMMY_PASSWORD_HASH = "$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.";

export type CredentialUser = {
    id: string;
    email: string;
    name: string;
    role: string;
};

export type CredentialCheck = {
    user: CredentialUser | null;
    hasPassword: boolean;
    isEmailVerified: boolean;
    isPasswordValid: boolean;
};

export async function checkCredentials(
    email: string,
    password: string,
): Promise<CredentialCheck> {
    const account = await prisma.user.findUnique({
        where: { email },
        select: {
            id: true,
            email: true,
            name: true,
            role: true,
            password: true,
            emailVerified: true,
        },
    });

    const passwordHash = account?.password ?? DUMMY_PASSWORD_HASH;
    const isPasswordValid = await bcrypt.compare(password, passwordHash);

    return {
        user: account
            ? {
                id: account.id,
                email: account.email,
                name: account.name,
                role: account.role,
            }
            : null,
        hasPassword: Boolean(account?.password),
        isEmailVerified: Boolean(account?.emailVerified),
        isPasswordValid: Boolean(account?.password && isPasswordValid),
    };
}

export function hasValidCredentials(
    check: CredentialCheck,
): check is CredentialCheck & { user: CredentialUser } {
    return Boolean(
        check.user
        && check.hasPassword
        && check.isEmailVerified
        && check.isPasswordValid,
    );
}
