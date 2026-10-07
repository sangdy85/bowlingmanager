import "server-only";

import {
    createCipheriv,
    createDecipheriv,
    randomBytes,
} from "node:crypto";

const VERSION = "v1";
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function readEncryptionKey(): Buffer {
    const value = process.env.BAND_TOKEN_ENCRYPTION_KEY?.trim();

    if (!value) {
        throw new Error("BAND_TOKEN_ENCRYPTION_KEY is not configured.");
    }

    let key: Buffer;

    if (/^[0-9a-f]{64}$/i.test(value)) {
        key = Buffer.from(value, "hex");
    } else {
        key = Buffer.from(value, "base64");
    }

    if (key.length !== 32) {
        throw new Error("BAND_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes.");
    }

    return key;
}

export function encryptBandToken(plaintext: string): string {
    if (!plaintext) {
        throw new Error("Cannot encrypt an empty BAND token.");
    }

    const key = readEncryptionKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv, {
        authTagLength: AUTH_TAG_LENGTH,
    });

    const ciphertext = Buffer.concat([
        cipher.update(plaintext, "utf8"),
        cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    return [
        VERSION,
        iv.toString("base64url"),
        tag.toString("base64url"),
        ciphertext.toString("base64url"),
    ].join(".");
}

export function decryptBandToken(payload: string): string {
    const parts = payload.split(".");

    if (parts.length !== 4 || parts[0] !== VERSION) {
        throw new Error("Unsupported BAND token payload.");
    }

    const [, ivText, tagText, ciphertextText] = parts;
    const iv = Buffer.from(ivText, "base64url");
    const tag = Buffer.from(tagText, "base64url");
    const ciphertext = Buffer.from(ciphertextText, "base64url");

    if (iv.length !== IV_LENGTH || tag.length !== AUTH_TAG_LENGTH) {
        throw new Error("Invalid BAND token payload.");
    }

    const decipher = createDecipheriv(ALGORITHM, readEncryptionKey(), iv, {
        authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(tag);

    return Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
    ]).toString("utf8");
}
