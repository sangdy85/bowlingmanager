import { randomInt } from "node:crypto";

const TEAM_CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const TEAM_CODE_LENGTH = 6;
const TEAM_CODE_CREATE_ATTEMPTS = 5;

export function generateSecureTeamCode(
    pickIndex: (maxExclusive: number) => number = randomInt,
): string {
    let code = "";
    for (let index = 0; index < TEAM_CODE_LENGTH; index += 1) {
        code += TEAM_CODE_ALPHABET[pickIndex(TEAM_CODE_ALPHABET.length)];
    }
    return code;
}

export async function createWithUniqueTeamCode<T>(
    create: (code: string) => Promise<T>,
    generateCode: () => string = generateSecureTeamCode,
): Promise<T> {
    for (let attempt = 0; attempt < TEAM_CODE_CREATE_ATTEMPTS; attempt += 1) {
        try {
            return await create(generateCode());
        } catch (error) {
            if (!isTeamCodeCollision(error) || attempt === TEAM_CODE_CREATE_ATTEMPTS - 1) {
                throw error;
            }
        }
    }
    throw new Error("Unable to allocate a unique team code.");
}

function isTeamCodeCollision(error: unknown): boolean {
    if (!error || typeof error !== "object") return false;
    const candidate = error as { code?: unknown; meta?: { target?: unknown } };
    if (candidate.code !== "P2002") return false;
    const target = candidate.meta?.target;
    return Array.isArray(target)
        ? target.includes("code")
        : typeof target === "string" && target.includes("code");
}
