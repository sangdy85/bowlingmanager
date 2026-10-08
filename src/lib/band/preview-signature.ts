import { createHmac, timingSafeEqual } from 'node:crypto';

const VALID_FOR_MS = 15 * 60 * 1000;
const TOKEN_FORMAT = /^(\\d{13})\\.([a-f0-9]{64})$/;

function secret(): string {
    const value = process.env.AUTH_SECRET;
    if (!value || Buffer.byteLength(value, 'utf8') < 32) {
        throw new Error('AUTH_SECRET must contain at least 32 UTF-8 bytes for BAND preview approval.');
    }
    return value;
}

function signature(payload: string, userId: string, issuedAt: string): string {
    return createHmac('sha256', secret())
        .update(JSON.stringify(['band-preview-v1', payload, userId, issuedAt]))
        .digest('hex');
}

export function createBandPreviewApproval(payload: string, userId: string, now = Date.now()): string {
    if (!userId) throw new Error('BAND preview requires an authenticated manager.');
    const timestamp = String(now);
    return `${timestamp}.${signature(payload, userId, timestamp)}`;
}

export function verifyBandPreviewApproval(token: string, payload: string, userId: string, now = Date.now()): boolean {
    if (!userId) return false;
    const match = TOKEN_FORMAT.exec(token);
    if (!match) return false;
    const issuedAt = Number(match[1]);
    if (!Number.isSafeInteger(issuedAt) || now < issuedAt || now - issuedAt > VALID_FOR_MS) return false;
    const actual = Buffer.from(match[2], 'hex');
    const expected = Buffer.from(signature(payload, userId, match[1]), 'hex');
    return actual.length === expected.length && timingSafeEqual(actual, expected);
}
