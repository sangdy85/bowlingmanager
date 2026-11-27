import { createHash } from 'node:crypto';

export class OcrSpaceError extends Error {
    constructor(message: string, public readonly errorType: 'QUOTA' | 'GENERAL' = 'GENERAL') { super(message); }
}

export type OcrSpaceConfig = {
    apiKey: string; daily: number; monthly: number; userDaily: number;
    preciseDaily: number; preciseMonthly: number;
};

export function readOcrSpaceConfig(env: NodeJS.ProcessEnv = process.env): OcrSpaceConfig {
    const limit = (key: string, fallback: number, maximum: number) => {
        const value = env[key] === undefined ? fallback : Number(env[key]);
        if (!Number.isInteger(value) || value < 1 || value > maximum) {
            throw new OcrSpaceError('OCR 서버의 사용량 제한 설정을 확인해주세요.');
        }
        return value;
    };
    const apiKey = env.OCR_SPACE_API_KEY?.trim();
    if (!apiKey) throw new OcrSpaceError('OCR.space API 키가 서버에 설정되지 않았습니다.');
    return {
        apiKey, daily: limit('OCR_SPACE_DAILY_LIMIT', 400, 500),
        monthly: limit('OCR_SPACE_MONTHLY_LIMIT', 20_000, 25_000),
        userDaily: limit('OCR_SPACE_USER_DAILY_LIMIT', 20, 500),
        preciseDaily: limit('OCR_SPACE_PRECISE_DAILY_LIMIT', 20, 500),
        preciseMonthly: limit('OCR_SPACE_PRECISE_MONTHLY_LIMIT', 800, 1000),
    };
}

export function ocrUsageBuckets(config: OcrSpaceConfig, userId: string, engine: 2 | 3, now = new Date()) {
    const day = new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
    const month = day.slice(0, 7);
    const user = createHash('sha256').update(userId).digest('hex');
    const buckets = [
        { key: `all:day:${day}`, limit: config.daily },
        { key: `all:month:${month}`, limit: config.monthly },
        { key: `user:${user}:day:${day}`, limit: config.userDaily },
    ];
    if (engine === 3) buckets.push(
        { key: `precise:day:${day}`, limit: config.preciseDaily },
        { key: `precise:month:${month}`, limit: config.preciseMonthly },
    );
    return buckets;
}

export interface OcrUsageTransaction {
    ocrUsageBucket: {
        upsert(args: { where: { key: string }; create: { key: string; count: number }; update: Record<string, never> }): Promise<unknown>;
        updateMany(args: { where: { key: string; count: { lt: number } }; data: { count: { increment: number } } }): Promise<{ count: number }>;
    };
}

export async function reserveOcrBuckets(tx: OcrUsageTransaction, buckets: { key: string; limit: number }[]) {
    for (const { key, limit } of buckets) {
        await tx.ocrUsageBucket.upsert({ where: { key }, create: { key, count: 0 }, update: {} });
        const result = await tx.ocrUsageBucket.updateMany({ where: { key, count: { lt: limit } }, data: { count: { increment: 1 } } });
        if (result.count !== 1) throw new OcrSpaceError('사진 분석 한도에 도달했습니다. 직접 입력하거나 다음 이용 기간에 다시 시도해주세요.', 'QUOTA');
    }
}
