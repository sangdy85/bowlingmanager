import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const VERSION = 'v1';

function getEncryptionKey(): Buffer {
    const value = process.env.BAND_TOKEN_ENCRYPTION_KEY?.trim();
    if (!value) throw new Error('BAND token encryption is not configured.');

    const key = /^[0-9a-f]{64}$/i.test(value)
        ? Buffer.from(value, 'hex')
        : Buffer.from(value, 'base64');

    if (key.length !== 32) {
        throw new Error('BAND_TOKEN_ENCRYPTION_KEY must encode exactly 32 bytes.');
    }
    return key;
}

export function encryptBandToken(token: string): string {
    if (!token) throw new Error('Cannot encrypt an empty BAND token.');
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [VERSION, iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join('.');
}

export function decryptBandToken(payload: string): string {
    const [version, ivValue, tagValue, encryptedValue, extra] = payload.split('.');
    if (version !== VERSION || !ivValue || !tagValue || !encryptedValue || extra) {
        throw new Error('Stored BAND token has an invalid format.');
    }
    const decipher = createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(ivValue, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
    return Buffer.concat([
        decipher.update(Buffer.from(encryptedValue, 'base64url')),
        decipher.final(),
    ]).toString('utf8');
}
