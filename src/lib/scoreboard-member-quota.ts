import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash } from 'node:crypto';
import prisma from '@/lib/prisma';
import { OcrSpaceError, reserveOcrBuckets, type OcrUsageTransaction } from '@/lib/ocr-space-limits';
import type { ScoreboardOcrResult } from '@/lib/scoreboard-ocr';

export const SCOREBOARD_MEMBER_DAILY_LIMIT = 5;
const TEST_ACCOUNT = 'sangdy85@naver.com';

export class ScoreboardMemberQuotaError extends OcrSpaceError {
    constructor() { super('오늘의 사진 분석 5회를 모두 사용했습니다. 한국 시간 자정 이후 다시 이용하거나 점수를 직접 입력해주세요.', 'QUOTA'); }
}

export function scoreboardMemberBucket(userId: string, now = new Date()) {
    const day = new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
    return { key: `scoreboard-member:${createHash('sha256').update(userId).digest('hex')}:day:${day}`, limit: SCOREBOARD_MEMBER_DAILY_LIMIT };
}

type Dependencies = {
    findUser: (id: string) => Promise<{ email: string } | null>;
    transaction: <T>(operation: (tx: OcrUsageTransaction) => Promise<T>) => Promise<T>;
    now: () => Date;
};
const defaults: Dependencies = {
    findUser: id => prisma.user.findUnique({ where: { id }, select: { email: true } }),
    transaction: operation => prisma.$transaction(operation, { maxWait: 5000, timeout: 10_000 }),
    now: () => new Date(),
};

export function createScoreboardMemberQuota(deps: Dependencies = defaults) {
    const context = new AsyncLocalStorage<{ userId: string; exempt: boolean; charged: boolean }>();
    // SQLite admits one writer at a time. Queue local reservations while keeping
    // the database transaction authoritative across processes and restarts.
    let reservationTail: Promise<void> = Promise.resolve();
    return {
        async run(userId: string, operation: () => Promise<ScoreboardOcrResult>): Promise<ScoreboardOcrResult> {
            try {
                // Resolve the account from authenticated server identity, never request email or roles.
                const user = userId ? await deps.findUser(userId) : null;
                if (!user) return { success: false, errorType: 'GENERAL', message: '로그인 상태를 확인해주세요.' };
                return await context.run({ userId, exempt: user.email.trim().toLowerCase() === TEST_ACCOUNT, charged: false }, operation);
            } catch (error) {
                if (error instanceof ScoreboardMemberQuotaError) return { success: false, errorType: 'QUOTA', quotaScope: 'MEMBER', message: error.message };
                return { success: false, errorType: 'GENERAL', message: '분석 사용량 저장소를 확인해주세요.' };
            }
        },
        async reserve(userId: string, providerBuckets: { key: string; limit: number }[]) {
            const state = context.getStore();
            if (!state || state.userId !== userId) throw new Error('Missing authenticated photo quota context');
            const previous = reservationTail;
            let release!: () => void;
            reservationTail = new Promise<void>(resolve => { release = resolve; });
            await previous;
            try { await deps.transaction(async tx => {
                if (!state.exempt && !state.charged) {
                    try { await reserveOcrBuckets(tx, [scoreboardMemberBucket(userId, deps.now())]); }
                    catch (error) {
                        if (error instanceof OcrSpaceError && error.errorType === 'QUOTA') throw new ScoreboardMemberQuotaError();
                        throw error;
                    }
                }
                // Replace the old OCR-only member cap with the shared five-analysis policy.
                // All global provider buckets remain enforced, including for the test account.
                await reserveOcrBuckets(tx, providerBuckets.filter(bucket => !bucket.key.startsWith('user:')));
            });
            // Cache hits never reach this reservation. Provider failures remain counted;
            // subsequent providers in this one analysis do not charge the member again.
            state.charged = true;
            } finally { release(); }
        },
    };
}

const quota = createScoreboardMemberQuota();
export const withScoreboardMemberQuota = quota.run;
export const reserveScoreboardProviderUsage = quota.reserve;
