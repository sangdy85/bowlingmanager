/**
 * Fixed-window attempt counter kept in process memory.
 *
 * Production runs as a single PM2 process, so one in-memory map covers every
 * request. If the app is ever scaled to several processes or servers, move
 * this state to the database (or a shared store) so the limits stay global.
 */

type Bucket = { count: number; resetAt: number };

export type AttemptPolicy = {
    /** Attempts allowed inside one window. */
    limit: number;
    /** Window length in milliseconds. */
    windowMs: number;
};

const MAX_TRACKED_KEYS = 50_000;

export const LOGIN_FAILURE_POLICY: AttemptPolicy = { limit: 10, windowMs: 15 * 60 * 1000 };
export const CODE_FAILURE_POLICY: AttemptPolicy = { limit: 5, windowMs: 10 * 60 * 1000 };
export const CODE_SEND_POLICY: AttemptPolicy = { limit: 5, windowMs: 60 * 60 * 1000 };

const buckets = new Map<string, Bucket>();

function normalizeKey(key: string) {
    return key.trim().toLowerCase();
}

function liveBucket(key: string, now: number) {
    const bucket = buckets.get(key);
    if (bucket && bucket.resetAt <= now) {
        buckets.delete(key);
        return undefined;
    }
    return bucket;
}

function prune(now: number) {
    if (buckets.size < MAX_TRACKED_KEYS) return;
    for (const [key, bucket] of buckets) {
        if (bucket.resetAt <= now) buckets.delete(key);
    }
    // Still full: drop the oldest entries (Map keeps insertion order).
    while (buckets.size >= MAX_TRACKED_KEYS) {
        const oldest = buckets.keys().next().value;
        if (oldest === undefined) break;
        buckets.delete(oldest);
    }
}

/** True when the key has already used every attempt in its current window. */
export function isAttemptLimited(rawKey: string, policy: AttemptPolicy, now = Date.now()) {
    const bucket = liveBucket(normalizeKey(rawKey), now);
    return !!bucket && bucket.count >= policy.limit;
}

/** Counts one attempt and returns true when the key is now over its limit. */
export function recordAttempt(rawKey: string, policy: AttemptPolicy, now = Date.now()) {
    const key = normalizeKey(rawKey);
    const bucket = liveBucket(key, now);
    if (bucket) {
        bucket.count += 1;
        return bucket.count >= policy.limit;
    }
    prune(now);
    buckets.set(key, { count: 1, resetAt: now + policy.windowMs });
    return 1 >= policy.limit;
}

export function clearAttempts(rawKey: string) {
    buckets.delete(normalizeKey(rawKey));
}
