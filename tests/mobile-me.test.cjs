// Run: node --test tests/mobile-me.test.cjs
// Synthetic in-memory fixtures only. No database or production calls.
const assert = require('node:assert/strict');
const { test } = require('node:test');
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

function loadRoute({ userId = 'user-1', user, databaseError } = {}) {
    let query;
    const route = loadTs('src/app/api/mobile/v1/me/route.ts', {
        '@/lib/mobile-api/auth': { getMobileApiUserId: async () => userId },
        '@/lib/prisma': {
            user: {
                findUnique: async args => {
                    query = args;
                    if (databaseError) throw databaseError;
                    return user;
                },
            },
        },
    });
    return { route, query: () => query };
}

const request = new Request('https://example.test/api/mobile/v1/me');

test('/me requires authentication before querying the user table', async () => {
    const fixture = loadRoute({ userId: null });
    const response = await fixture.route.GET(request);
    assert.equal(response.status, 401);
    assert.equal(fixture.query(), undefined);
});

test('/me selects and returns only the public mobile profile contract', async () => {
    const user = {
        id: 'user-1',
        email: 'fixture@example.test',
        name: 'Fixture User',
        role: 'USER',
        handicap: null,
    };
    const fixture = loadRoute({ user });
    const response = await fixture.route.GET(request);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(fixture.query(), {
        where: { id: 'user-1' },
        select: { id: true, email: true, name: true, role: true, handicap: true },
    });
    assert.deepEqual(body, { success: true, data: user });
    assert.deepEqual(Object.keys(body.data).sort(), ['email', 'handicap', 'id', 'name', 'role']);
    assert.equal(JSON.stringify(body).includes('password'), false);
    assert.equal(JSON.stringify(body).includes('token'), false);
});

test('/me treats a deleted user as unauthorized', async () => {
    const response = await loadRoute({ user: null }).route.GET(request);
    assert.equal(response.status, 401);
});

test('/me hides internal database errors', async () => {
    const originalError = console.error;
    console.error = () => {};
    try {
        const response = await loadRoute({ databaseError: new Error('private database detail') }).route.GET(request);
        const body = await response.json();
        assert.equal(response.status, 500);
        assert.equal(JSON.stringify(body).includes('private database detail'), false);
        assert.equal(JSON.stringify(body).includes('stack'), false);
    } finally {
        console.error = originalError;
    }
});
