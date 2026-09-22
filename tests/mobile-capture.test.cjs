// Run: node --test tests/mobile-capture.test.cjs
// Synthetic in-memory fixtures only. No database, Gemini, or production calls.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { File } = require('node:buffer');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { createRequire } = require('node:module');

function loadTs(relative, overrides = {}, cache = new Map()) {
    const filename = path.resolve(__dirname, '..', relative);
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const nativeRequire = createRequire(filename);
    const localRequire = id => {
        if (Object.hasOwn(overrides, id)) return overrides[id];
        if (id.startsWith('@/')) return loadTs(`src/${id.slice(2)}.ts`, overrides, cache);
        return nativeRequire(id);
    };
    const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    }).outputText;
    new Function('require', 'module', 'exports', compiled)(localRequire, module, module.exports);
    return module.exports;
}

const geminiUtils = {
    extractJson: value => value,
    getKstDate: async () => '2026-09-21',
    checkUserAiQuota: async () => ({ hasQuota: true }),
    incrementUserAiUsage: async () => {},
    handleGeminiError: () => ({ message: 'safe failure', errorType: 'GENERAL' }),
};
const ocr = loadTs('src/lib/scoreboard-ocr.ts', {
    '@/lib/gemini-utils': geminiUtils,
});

test('shared OCR service returns the parsed result and records usage', async () => {
    const calls = [];
    const result = await ocr.analyzeScoreboardImage({
        userId: 'user-1', image: Buffer.from('synthetic'), mimeType: 'image/jpeg', knownMembers: ['테스트 회원'],
    }, {
        getApiKey: () => 'test-key',
        getDate: async () => '2026-09-21',
        checkQuota: async () => ({ hasQuota: true }),
        generate: async (key, prompt, image, mimeType) => {
            calls.push({ key, prompt, image, mimeType });
            return { text: '[{"memberName":"테스트 회원","scores":[200]}]', inputTokens: 10, outputTokens: 4 };
        },
        incrementUsage: async (...args) => calls.push({ usage: args }),
        handleError: geminiUtils.handleGeminiError,
    });
    assert.deepEqual(result, { success: true, data: [{ memberName: '테스트 회원', scores: [200] }] });
    assert.match(calls[0].prompt, /테스트 회원/);
    assert.deepEqual(calls[1].usage, ['user-1', '2026-09-21', 10, 4]);
});

test('shared OCR service stops before Gemini when quota is exhausted', async () => {
    let generated = false;
    const result = await ocr.analyzeScoreboardImage({
        userId: 'user-1', image: Buffer.from('synthetic'), mimeType: 'image/png', knownMembers: [],
    }, {
        getApiKey: () => 'test-key',
        getDate: async () => '2026-09-21',
        checkQuota: async () => ({ hasQuota: false, message: 'quota message' }),
        generate: async () => { generated = true; throw new Error('must not run'); },
        incrementUsage: async () => {},
        handleError: geminiUtils.handleGeminiError,
    });
    assert.equal(generated, false);
    assert.deepEqual(result, { success: false, message: 'quota message', errorType: 'QUOTA' });
});

test('shared OCR service converts Gemini failures to its safe result', async () => {
    const result = await ocr.analyzeScoreboardImage({
        userId: 'user-1', image: Buffer.from('synthetic'), mimeType: 'image/webp', knownMembers: [],
    }, {
        getApiKey: () => 'test-key',
        getDate: async () => '2026-09-21',
        checkQuota: async () => ({ hasQuota: true }),
        generate: async () => { throw new Error('internal provider detail'); },
        incrementUsage: async () => {},
        handleError: () => ({ message: 'safe failure', errorType: 'GENERAL' }),
    });
    assert.deepEqual(result, { success: false, message: 'safe failure', errorType: 'GENERAL' });
});

const capture = loadTs('src/lib/mobile-api/score-capture.ts', {
    '@/lib/score-bulk-service': { SCORE_GAME_TYPES: ['정기전', '벙개', '상주', '교류전', '기타'] },
});

test('mobile OCR normalization returns unique exact member matches only', () => {
    const players = capture.normalizeMobileOcrPlayers([
        { memberName: '회원 A', scores: [200, 301, '190'] },
        { memberName: '동명이인', scores: [180] },
        { memberName: '깨진 행', scores: [] },
    ], [
        { id: 'member-a', name: '회원 A' },
        { id: 'duplicate-1', name: '동명이인' },
        { id: 'duplicate-2', name: '동명이인' },
    ]);
    assert.deepEqual(players, [
        { name: '회원 A', scores: [200], matchedMemberId: 'member-a' },
        { name: '동명이인', scores: [180], matchedMemberId: null },
    ]);
});

test('mobile bulk parser validates metadata and multiple players/games', () => {
    const parsed = capture.parseMobileBulkScoreRequest({
        teamId: 'team-1', gameDate: '2026-09-21', gameType: '정기전', memo: 'synthetic',
        players: [
            { memberId: 'member-1', name: '회원', scores: [200, 210] },
            { memberId: null, name: '게스트', scores: [180] },
        ],
    });
    assert.equal(parsed.teamId, 'team-1');
    assert.equal(parsed.rows.length, 2);
    assert.deepEqual(parsed.rows[0].scores, [200, 210]);
    assert.equal(parsed.rows[0].gameDate.toISOString(), '2026-09-21T00:00:00.000Z');
});

test('mobile bulk parser rejects empty payload and invalid scores', () => {
    assert.throws(() => capture.parseMobileBulkScoreRequest({}), error => error.code === 'INVALID_REQUEST');
    assert.throws(() => capture.parseMobileBulkScoreRequest({
        teamId: 'team-1', gameDate: '2026-09-21', gameType: '정기전',
        players: [{ name: '회원', scores: [301] }],
    }), error => error.code === 'INVALID_SCORE');
});

const bulk = loadTs('src/lib/score-bulk-service.ts', {
    '@/lib/prisma': {},
    uuid: { v4: () => 'unused-id' },
});

function bulkDependencies(changes = {}) {
    const state = { records: null, createCalls: 0 };
    return { state, dependencies: {
        findDefaultTeamId: async () => 'team-1',
        findTeam: async () => ({
            id: 'team-1', name: 'Fixture Team', ownerId: 'actor', User: [],
            members: [
                { id: 'membership-actor', userId: 'actor', alias: null, user: { name: 'Actor' } },
                { id: 'membership-1', userId: 'member-1', alias: '별명', user: { name: 'Member' } },
            ],
        }),
        createScoresAtomically: async records => { state.createCalls += 1; state.records = records; },
        createId: (() => { let id = 0; return () => `score-${++id}`; })(),
        ...changes,
    } };
}

test('bulk service validates explicit members and prepares one atomic batch', async () => {
    const { state, dependencies } = bulkDependencies();
    const result = await bulk.saveBulkScoreRows({
        actorUserId: 'actor', teamId: 'team-1', requireMembership: true, memberMatchMode: 'none',
        rows: [
            { memberName: '수정된 이름', memberId: 'membership-1', scores: [200, 210], gameDate: new Date('2026-09-21Z'), gameType: '정기전', memo: null },
            { memberName: '게스트', memberId: null, scores: [180], gameDate: new Date('2026-09-21Z'), gameType: '정기전', memo: null },
        ],
    }, dependencies);
    assert.deepEqual(result, { teamId: 'team-1', playerCount: 2, createdCount: 3 });
    assert.equal(state.createCalls, 1);
    assert.equal(state.records[0].userId, 'member-1');
    assert.equal(state.records[2].guestName, '게스트');
});

test('bulk service rejects invalid team members and insufficient permission before writes', async () => {
    const invalidMember = bulkDependencies();
    await assert.rejects(() => bulk.saveBulkScoreRows({
        actorUserId: 'actor', teamId: 'team-1', requireMembership: true, memberMatchMode: 'none',
        rows: [{ memberName: '회원', memberId: 'other', scores: [200], gameDate: new Date(), gameType: '정기전', memo: null }],
    }, invalidMember.dependencies), error => error.code === 'INVALID_MEMBER');
    assert.equal(invalidMember.state.createCalls, 0);

    const forbidden = bulkDependencies({ findTeam: async () => ({
        id: 'team-1', name: 'Fixture Team', ownerId: 'owner', User: [],
        members: [{ id: 'membership-actor', userId: 'actor', alias: null, user: { name: 'Actor' } }],
    }) });
    await assert.rejects(() => bulk.saveBulkScoreRows({
        actorUserId: 'actor', teamId: 'team-1', requireMembership: true, memberMatchMode: 'none',
        rows: [{ memberName: 'Actor', scores: [200], gameDate: new Date(), gameType: '정기전', memo: null }],
    }, forbidden.dependencies), error => error.code === 'FORBIDDEN');
    assert.equal(forbidden.state.createCalls, 0);
});

test('bulk service can preserve the web member-or-privileged permission messages', async () => {
    const privileged = bulkDependencies({ findTeam: async () => ({
        id: 'team-1', name: 'Fixture Team', ownerId: 'actor', User: [], members: [],
    }) });
    const result = await bulk.saveBulkScoreRows({
        actorUserId: 'actor', teamId: 'team-1', requireMembership: true,
        allowPrivilegedWithoutMembership: true, memberMatchMode: 'none',
        rows: [{ memberName: 'Guest', scores: [200], gameDate: new Date(), gameType: '정기전', memo: null }],
    }, privileged.dependencies);
    assert.equal(result.createdCount, 1);

    const outsider = bulkDependencies({ findTeam: async () => ({
        id: 'team-1', name: 'Fixture Team', ownerId: 'owner', User: [], members: [],
    }) });
    await assert.rejects(() => bulk.saveBulkScoreRows({
        actorUserId: 'actor', teamId: 'team-1', requireMembership: true,
        allowPrivilegedWithoutMembership: true, memberMatchMode: 'none',
        rows: [{ memberName: 'Guest', scores: [200], gameDate: new Date(), gameType: '정기전', memo: null }],
    }, outsider.dependencies), error =>
        error.code === 'FORBIDDEN' && error.message === '팀 구성원만 점수를 등록할 수 있습니다.');
    assert.equal(outsider.state.createCalls, 0);
});

test('bulk service exposes transaction failure without reporting partial success', async () => {
    const { dependencies } = bulkDependencies({
        createScoresAtomically: async () => { throw new Error('synthetic transaction failure'); },
    });
    await assert.rejects(() => bulk.saveBulkScoreRows({
        actorUserId: 'actor', teamId: 'team-1', requireMembership: true, memberMatchMode: 'none',
        rows: [{ memberName: 'Actor', scores: [200, 210], gameDate: new Date(), gameType: '정기전', memo: null }],
    }, dependencies), /synthetic transaction failure/);
});

test('manageable score options expose membership IDs instead of user IDs', async () => {
    let where;
    const module = loadTs('src/lib/score-bulk-service.ts', {
        '@/lib/prisma': {
            teamMember: {
                findMany: async query => {
                    where = query.where;
                    return [{ team: {
                        id: 'team-1', name: 'Fixture',
                        members: [{ id: 'membership-1', userId: 'private-user-id', alias: null, user: { name: '회원' } }],
                    } }];
                },
            },
        },
        uuid: { v4: () => 'unused' },
    }, new Map());
    const result = await module.listManageableScoreTeams('actor');
    assert.equal(where.team.isActive, true);
    assert.deepEqual(result[0].members, [{ id: 'membership-1', name: '회원' }]);
    assert.equal(JSON.stringify(result).includes('private-user-id'), false);
});

function formRequest(fields) {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) form.append(key, value);
    return new Request('https://example.test/api/mobile/v1/ocr/scoreboard', { method: 'POST', body: form });
}

function loadOcrRoute({ userId = 'user-1', analyze } = {}) {
    return loadTs('src/app/api/mobile/v1/ocr/scoreboard/route.ts', {
        '@/lib/mobile-api/auth': { getMobileApiUserId: async () => userId },
        '@/lib/score-bulk-service': {
            listManageableScoreTeams: async () => [{ id: 'team-1', name: 'Fixture Team', members: [{ id: 'member-1', name: '회원' }] }],
        },
        '@/lib/scoreboard-ocr': {
            analyzeScoreboardImage: analyze || (async () => ({ success: true, data: [{ memberName: '회원', scores: [200] }] })),
        },
    });
}

test('OCR route rejects unauthenticated, missing, invalid MIME and oversized images', async () => {
    let route = loadOcrRoute({ userId: null });
    assert.equal((await route.POST(new Request('https://example.test', { method: 'POST' }))).status, 401);

    route = loadOcrRoute();
    assert.equal((await route.POST(formRequest({ teamId: 'team-1' }))).status, 400);
    assert.equal((await route.POST(formRequest({ teamId: 'team-1', image: new File(['x'], 'score.txt', { type: 'text/plain' }) }))).status, 415);
    assert.equal((await route.POST(formRequest({ teamId: 'team-1', image: new File([Buffer.alloc(10 * 1024 * 1024 + 1)], 'score.jpg', { type: 'image/jpeg' }) }))).status, 413);
});

test('OCR route returns normalized success without raw Gemini data', async () => {
    const route = loadOcrRoute();
    const response = await route.POST(formRequest({
        teamId: 'team-1', image: new File(['synthetic'], 'score.jpg', { type: 'image/jpeg' }),
    }));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
        success: true,
        data: { players: [{ name: '회원', scores: [200], matchedMemberId: 'member-1' }] },
    });
});

test('OCR route maps provider and empty-result failures', async () => {
    let route = loadOcrRoute({ analyze: async () => ({ success: false, message: 'internal detail', errorType: 'GENERAL' }) });
    let response = await route.POST(formRequest({ teamId: 'team-1', image: new File(['x'], 'score.png', { type: 'image/png' }) }));
    assert.equal(response.status, 502);
    assert.equal((await response.json()).error.code, 'OCR_ANALYSIS_FAILED');

    route = loadOcrRoute({ analyze: async () => ({ success: true, data: [] }) });
    response = await route.POST(formRequest({ teamId: 'team-1', image: new File(['x'], 'score.webp', { type: 'image/webp' }) }));
    assert.equal(response.status, 422);
    assert.equal((await response.json()).error.code, 'OCR_NO_RESULTS');
});

test('bulk save route validates auth/input and returns created counts', async () => {
    const service = loadTs('src/lib/score-bulk-service.ts', { '@/lib/prisma': {}, uuid: { v4: () => 'id' } });
    let captured;
    let userId = null;
    const route = loadTs('src/app/api/mobile/v1/scores/bulk/route.ts', {
        '@/lib/mobile-api/auth': { getMobileApiUserId: async () => userId },
        '@/lib/score-bulk-service': {
            SCORE_GAME_TYPES: ['정기전', '벙개', '상주', '교류전', '기타'],
            ScoreBulkServiceError: service.ScoreBulkServiceError,
            saveBulkScoreRows: async input => { captured = input; return { createdCount: 3, playerCount: 2 }; },
        },
    });
    let response = await route.POST(new Request('https://example.test', { method: 'POST', body: '{}' }));
    assert.equal(response.status, 401);

    userId = 'actor';
    response = await route.POST(new Request('https://example.test', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
            teamId: 'team-1', gameDate: '2026-09-21', gameType: '정기전',
            players: [{ name: '회원', memberId: 'member-1', scores: [200, 210] }, { name: '게스트', scores: [180] }],
        }),
    }));
    assert.equal(response.status, 201);
    assert.equal(captured.memberMatchMode, 'none');
    assert.equal(captured.requireActiveTeam, true);
    assert.equal(captured.rows.length, 2);
    assert.deepEqual(await response.json(), { success: true, data: { createdCount: 3, playerCount: 2 } });

    response = await route.POST(new Request('https://example.test', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
            teamId: 'team-1', gameDate: '2026-09-21', gameType: '정기전', players: [{ name: '회원', scores: [999] }],
        }),
    }));
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, 'INVALID_SCORE');
});
