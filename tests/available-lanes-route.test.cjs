const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { createRequire } = require('node:module');

function loadRoute(prisma) {
    const filename = path.resolve(__dirname, '../src/app/api/rounds/[roundId]/available-lanes/route.ts');
    const module = { exports: {} };
    const nativeRequire = createRequire(filename);
    const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    }).outputText;
    const localRequire = id => id === '@/lib/prisma' ? prisma : nativeRequire(id);
    new Function('require', 'module', 'exports', compiled)(localRequire, module, module.exports);
    return module.exports;
}

test('available lanes awaits route params and preserves encoded slot availability', async () => {
    const prisma = {
        leagueRound: {
            findUnique: async ({ where }) => {
                assert.deepEqual(where, { id: 'round-1' });
                return { id: 'round-1', laneConfig: JSON.stringify({ 1: [1, 2], 2: [1] }) };
            },
        },
        roundParticipant: {
            findMany: async ({ where, select }) => {
                assert.deepEqual(where, { roundId: 'round-1', lane: { not: null } });
                assert.deepEqual(select, { lane: true });
                return [{ lane: 12 }];
            },
        },
    };
    const { GET } = loadRoute(prisma);
    const response = await GET(new Request('http://localhost/api/rounds/round-1/available-lanes'), {
        params: Promise.resolve({ roundId: 'round-1' }),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { lanes: [11, 21] });
});

test('available lanes preserves the missing-round 404 response', async () => {
    const prisma = {
        leagueRound: { findUnique: async () => null },
        roundParticipant: { findMany: async () => assert.fail('participants should not be queried') },
    };
    const { GET } = loadRoute(prisma);
    const response = await GET(new Request('http://localhost/api/rounds/missing/available-lanes'), {
        params: Promise.resolve({ roundId: 'missing' }),
    });
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: 'Round not found' });
});
