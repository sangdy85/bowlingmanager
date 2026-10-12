const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { randomUUID } = require('node:crypto');
const { NextRequest } = require('next/server');

// Execute the repository's actual TS functions and routes; only auth/DB/HTTP
// boundaries are replaced. jose and AES-GCM run normally with fixture secrets.
function loadTs(relativePath, mocks = {}) {
    const filename = path.join(process.cwd(), relativePath);
    const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    const module = { exports: {} };
    const localRequire = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
    new Function('require', 'module', 'exports', output)(localRequire, module, module.exports);
    return module.exports;
}

const fixtureSecret = 'band-oauth-test-secret-never-used-in-production';
const envNames = ['BAND_CLIENT_ID', 'BAND_CLIENT_SECRET', 'BAND_REDIRECT_URI', 'BAND_TOKEN_ENCRYPTION_KEY'];
const originalEnv = Object.fromEntries(envNames.map(name => [name, process.env[name]]));
let jose, bandAuth, tokenCrypto, bandConfig;
before(async () => {
    process.env.BAND_CLIENT_ID = 'fixture-client';
    process.env.BAND_CLIENT_SECRET = fixtureSecret;
    process.env.BAND_REDIRECT_URI = 'https://www.bowlingmanager.co.kr/api/integrations/band/callback';
    process.env.BAND_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 19).toString('base64');
    jose = await import('jose');
    bandAuth = loadTs('src/lib/band/auth.ts', { jose });
    tokenCrypto = loadTs('src/lib/band/token-crypto.ts');
    bandConfig = loadTs('src/lib/band/config.ts');
});
after(() => {
    for (const name of envNames) {
        if (originalEnv[name] === undefined) delete process.env[name];
        else process.env[name] = originalEnv[name];
    }
});

function fixture(t, options = {}) {
    const centerId = options.centerId || 'center-a';
    const context = {
        userId: options.userId === undefined ? 'owner-a' : options.userId,
        centers: {
            [centerId]: { ownerId: 'owner-a', managers: [{ id: 'manager-a' }] },
            'center-b': { ownerId: 'owner-b', managers: [{ id: 'manager-b' }] },
        },
        counters: { state: 0, exchange: 0, save: 0, centerReads: 0 },
        saved: null,
    };
    const auth = async () => {
        if (options.authFails) throw new Error('fixture auth failure');
        return context.userId ? { user: { id: context.userId } } : null;
    };
    const db = {
        bowlingCenter: { findUnique: async ({ where }) => {
            context.counters.centerReads++;
            return context.centers[where.id] || null;
        } },
        bandConnection: { upsert: async input => {
            context.counters.save++;
            if (options.saveFails) throw new Error('fixture storage failure');
            context.saved = input;
        } },
    };
    const authUtils = loadTs('src/lib/auth-utils.ts', {
        '@/auth': { auth }, '@/lib/prisma': { __esModule: true, default: db },
    });
    const connectAuth = { ...bandAuth, createBandOAuthState: async (...args) => {
        context.counters.state++;
        return bandAuth.createBandOAuthState(...args);
    } };
    const baseMocks = {
        '@/auth': { auth },
        '@/lib/auth-utils': authUtils,
        '@/lib/band/auth': connectAuth,
        '@/lib/band/config': bandConfig,
        '@/lib/band/redirect': loadTs('src/lib/band/redirect.ts', {
            '@/lib/public-web': loadTs('src/lib/public-web.ts'),
        }),
        '@/lib/prisma': { __esModule: true, default: db },
        '@/lib/band/token-crypto': tokenCrypto,
    };
    context.connect = loadTs('src/app/api/integrations/band/connect/route.ts', baseMocks).GET;
    context.callback = loadTs('src/app/api/integrations/band/callback/route.ts', baseMocks).GET;
    context.bands = loadTs('src/app/api/integrations/band/bands/route.ts', {
        ...baseMocks,
        '@/lib/band/client': { getBands: async () => { throw new Error('unexpected BAND list request'); }, bandErrorMessage: () => 'safe error' },
    }).GET;
    context.verifyCenterAdmin = authUtils.verifyCenterAdmin;
    t.mock.method(global, 'fetch', async url => {
        context.counters.exchange++;
        const requestUrl = new URL(String(url));
        assert.equal(requestUrl.origin + requestUrl.pathname, 'https://auth.band.us/oauth2/token');
        return new Response(JSON.stringify(options.tokenFails
            ? { error: 'fixture rejection' }
            : { access_token: 'fixture-access', refresh_token: 'fixture-refresh', expires_in: 3600, user_key: 'fixture-user' }),
        { status: options.tokenFails ? 401 : 200 });
    });
    return context;
}

function callbackRequest(state, options = {}) {
    const url = new URL('http://localhost:3091/api/integrations/band/callback');
    if (state !== undefined) url.searchParams.set('state', state);
    if (options.code !== null) url.searchParams.set('code', options.code === undefined ? 'fixture-code' : options.code);
    if (options.cancel) url.searchParams.set('error', 'access_denied');
    const cookie = options.cookie === undefined ? state : options.cookie;
    return new NextRequest(url, { headers: cookie ? { cookie: `bowling_band_oauth=${cookie}` } : {} });
}

function assertCleared(response) {
    const cookie = response.cookies.get('bowling_band_oauth');
    assert.equal(cookie.value, '');
    assert.equal(cookie.path, '/api/integrations/band');
    assert.equal(cookie.maxAge, 0);
    assert.equal(cookie.httpOnly, true);
    assert.equal(cookie.sameSite, 'lax');
    assert.equal(cookie.secure, process.env.NODE_ENV === 'production');
}
function assertNoExchangeOrSave(context) {
    assert.equal(context.counters.exchange, 0);
    assert.equal(context.counters.save, 0);
}

async function signedState(overrides = {}, { key = fixtureSecret, alg = 'HS256' } = {}) {
    const now = Math.floor(Date.now() / 1000);
    const claims = { centerId: 'center-a', userId: 'owner-a', nonce: randomUUID(), iat: now, exp: now + 600, ...overrides };
    for (const name of Object.keys(claims)) if (claims[name] === undefined) delete claims[name];
    return new jose.SignJWT(claims).setProtectedHeader({ alg, typ: 'JWT' })
        .setIssuer('bowlingmanager').setAudience('naver-band-oauth')
        .sign(new TextEncoder().encode(key));
}

for (const [label, userId, centerId, allowed] of [
    ['OWNER absent from managers', 'owner-a', 'center-a', true],
    ['MANAGER', 'manager-a', 'center-a', true],
    ['regular member', 'member-a', 'center-a', false],
    ['other center owner', 'owner-b', 'center-a', false],
    ['other center manager', 'manager-b', 'center-a', false],
    ['anonymous', null, 'center-a', false],
    ['missing center', 'owner-a', 'missing', false],
]) {
    test(`actual verifyCenterAdmin: ${label}`, async t => {
        const context = fixture(t, { userId });
        if (allowed) assert.equal(await context.verifyCenterAdmin(centerId), userId);
        else await assert.rejects(context.verifyCenterAdmin(centerId));
    });
}

test('connect refuses unauthorized requests before generating state and encodes redirect path', async t => {
    const context = fixture(t, { userId: 'member-a' });
    const centerId = 'center/?# injected';
    const response = await context.connect(new NextRequest(`http://localhost:3091/api/integrations/band/connect?centerId=${encodeURIComponent(centerId)}`));
    assert.equal(new URL(response.headers.get('location')).pathname, `/centers/${encodeURIComponent(centerId)}/edit`);
    assert.equal(context.counters.state, 0);
    assertNoExchangeOrSave(context);
    assert.equal(response.cookies.get('bowling_band_oauth'), undefined);
});

test('connect rejects anonymous and empty centerId requests before state generation', async t => {
    const context = fixture(t, { userId: null });
    let response = await context.connect(new NextRequest('http://localhost:3091/api/integrations/band/connect?centerId=center-a'));
    assert.equal(new URL(response.headers.get('location')).pathname, '/login');
    context.userId = 'owner-a';
    for (const query of ['', '?centerId=', '?centerId=%20%20']) {
        response = await context.connect(new NextRequest(`http://localhost:3091/api/integrations/band/connect${query}`));
        assert.equal(response.status, 400);
    }
    assert.equal(context.counters.state, 0);
});

test('OWNER connect supplies matching signed state and the exact OAuth cookie options', async t => {
    const context = fixture(t);
    const response = await context.connect(new NextRequest('http://localhost:3091/api/integrations/band/connect?centerId=center-a'));
    const target = new URL(response.headers.get('location'));
    const cookie = response.cookies.get('bowling_band_oauth');
    assert.equal(target.origin + target.pathname, 'https://auth.band.us/oauth2/authorize');
    assert.ok(target.searchParams.get('state') === cookie.value);
    assert.deepEqual(await bandAuth.verifyBandOAuthState(cookie.value), { centerId: 'center-a', userId: 'owner-a' });
    assert.equal(cookie.httpOnly, true);
    assert.equal(cookie.sameSite, 'lax');
    assert.equal(cookie.secure, process.env.NODE_ENV === 'production');
    assert.equal(cookie.path, '/api/integrations/band');
    assert.equal(cookie.maxAge, 600);
    assertNoExchangeOrSave(context);
});

test('missing BAND configuration is lazy, blocks authorized connect/list before state or token use, and leaves keys unchanged', async t => {
    const context = fixture(t);
    for (const name of envNames) {
        const saved = process.env[name];
        try {
            delete process.env[name];
            assert.equal(bandConfig.isBandConfigured(), false);
            const response = await context.connect(new NextRequest('http://localhost:3091/api/integrations/band/connect?centerId=center-a'));
            assert.equal(new URL(response.headers.get('location')).searchParams.get('band'), 'not-configured');
            assert.equal(response.cookies.get('bowling_band_oauth'), undefined);
            const list = await context.bands(new NextRequest('http://localhost:3091/api/integrations/band/bands?centerId=center-a'));
            assert.equal(list.status, 503);
            assert.match((await list.json()).error, /연동 준비 중/);
            assert.equal(process.env[name], undefined);
        } finally {
            process.env[name] = saved;
        }
    }
    assert.equal(context.counters.state, 0);
    assertNoExchangeOrSave(context);
    assert.equal(bandConfig.isBandConfigured(), true);
    const key = process.env.BAND_TOKEN_ENCRYPTION_KEY;
    try {
        process.env.BAND_TOKEN_ENCRYPTION_KEY = 'invalid';
        assert.equal(bandConfig.isBandConfigured(), false);
        process.env.BAND_TOKEN_ENCRYPTION_KEY = '13'.repeat(32);
        assert.equal(bandConfig.isBandConfigured(), true);
    } finally {
        process.env.BAND_TOKEN_ENCRYPTION_KEY = key;
    }
});

for (const [label, claims, signing] of [
    ['forged signature', {}, { key: 'another-fixture-key-that-is-not-trusted' }],
    ['expired', { iat: 1, exp: 601 }],
    ['missing centerId', { centerId: undefined }],
    ['empty centerId', { centerId: '' }],
    ['wrong centerId type', { centerId: 1 }],
    ['missing userId', { userId: undefined }],
    ['blank userId', { userId: ' ' }],
    ['missing nonce', { nonce: undefined }],
    ['invalid nonce', { nonce: ' ' }],
    ['missing expiry', { exp: undefined }],
    ['missing issued-at', { iat: undefined }],
    ['invalid validity period', { exp: Math.floor(Date.now() / 1000) + 3600 }],
    ['unapproved algorithm', {}, { alg: 'HS384' }],
]) {
    test(`callback rejects ${label} before permission, token exchange and storage`, async t => {
        const context = fixture(t);
        const state = await signedState(claims, signing);
        await assert.rejects(bandAuth.verifyBandOAuthState(state));
        const response = await context.callback(callbackRequest(state));
        assert.equal(new URL(response.headers.get('location')).pathname, '/centers');
        assert.equal(context.counters.centerReads, 0);
        assertNoExchangeOrSave(context);
        assertCleared(response);
    });
}

test('callback rejects absent query/cookie state and mismatched state', async t => {
    const context = fixture(t);
    const state = await bandAuth.createBandOAuthState('center-a', 'owner-a');
    for (const request of [callbackRequest(state, { cookie: null }), callbackRequest(undefined, { cookie: state }), callbackRequest(state, { cookie: 'different' })]) {
        const response = await context.callback(request);
        assertCleared(response);
        assert.equal(new URL(response.headers.get('location')).searchParams.get('band'), 'state-error');
    }
    assertNoExchangeOrSave(context);
    assert.equal(context.counters.centerReads, 0);
});

test('callback rejects mismatched user and revoked center permission', async t => {
    const context = fixture(t, { userId: 'manager-a' });
    let state = await bandAuth.createBandOAuthState('center-a', 'owner-a');
    let response = await context.callback(callbackRequest(state));
    assertCleared(response);
    assert.equal(context.counters.centerReads, 0);
    state = await bandAuth.createBandOAuthState('center-a', 'manager-a');
    context.centers['center-a'].managers = [];
    response = await context.callback(callbackRequest(state));
    assert.equal(new URL(response.headers.get('location')).searchParams.get('band'), 'state-error');
    assertCleared(response);
    assertNoExchangeOrSave(context);
});

test('callback rejects anonymous session, missing center and missing/blank code', async t => {
    const context = fixture(t);
    const state = await bandAuth.createBandOAuthState('center-a', 'owner-a');
    context.userId = null;
    const anonymous = await context.callback(callbackRequest(state));
    assert.equal(new URL(anonymous.headers.get('location')).pathname, '/login');
    assertCleared(anonymous);
    context.userId = 'owner-a';
    for (const code of [null, '', '   ']) {
        const response = await context.callback(callbackRequest(state, { code }));
        assert.equal(new URL(response.headers.get('location')).searchParams.get('band'), 'oauth-error');
        assertCleared(response);
    }
    delete context.centers['center-a'];
    const missing = await context.callback(callbackRequest(state));
    assert.equal(new URL(missing.headers.get('location')).searchParams.get('band'), 'state-error');
    assertCleared(missing);
    assertNoExchangeOrSave(context);
});

test('callback cancellation clears the cookie without token exchange or storage', async t => {
    const context = fixture(t);
    const state = await bandAuth.createBandOAuthState('center-a', 'owner-a');
    const response = await context.callback(callbackRequest(state, { cancel: true, code: null }));
    assert.equal(new URL(response.headers.get('location')).searchParams.get('band'), 'oauth-error');
    assertNoExchangeOrSave(context);
    assertCleared(response);
});

test('callback with verified state refuses token exchange when configuration was removed', async t => {
    const context = fixture(t);
    const state = await bandAuth.createBandOAuthState('center-a', 'owner-a');
    const saved = process.env.BAND_TOKEN_ENCRYPTION_KEY;
    try {
        delete process.env.BAND_TOKEN_ENCRYPTION_KEY;
        const response = await context.callback(callbackRequest(state));
        assert.equal(new URL(response.headers.get('location')).searchParams.get('band'), 'not-configured');
        assertNoExchangeOrSave(context);
        assertCleared(response);
    } finally {
        process.env.BAND_TOKEN_ENCRYPTION_KEY = saved;
    }
});

for (const userId of ['owner-a', 'manager-a']) {
    test(`valid ${userId} callback saves encrypted tokens and clears cookie`, async t => {
        const context = fixture(t, { userId, centerId: 'center/a?#' });
        const state = await bandAuth.createBandOAuthState('center/a?#', userId);
        const response = await context.callback(callbackRequest(state));
        const target = new URL(response.headers.get('location'));
        assert.equal(target.pathname, '/centers/center%2Fa%3F%23/edit');
        assert.equal(target.searchParams.get('band'), 'connected');
        assert.deepEqual(context.saved.where, { centerId: 'center/a?#' });
        assert.equal(context.saved.create.connectedByUserId, userId);
        for (const data of [context.saved.create, context.saved.update]) {
            assert.ok(data.accessTokenEncrypted !== 'fixture-access');
            assert.ok(tokenCrypto.decryptBandToken(data.accessTokenEncrypted) === 'fixture-access');
            assert.ok(tokenCrypto.decryptBandToken(data.refreshTokenEncrypted) === 'fixture-refresh');
        }
        assert.equal(context.counters.exchange, 1);
        assert.equal(context.counters.save, 1);
        assert.equal(context.saved.create.autoRecruitment, false);
        assert.equal(context.saved.create.autoFinalResult, false);
        assert.equal(context.saved.create.doPush, false);
        assertCleared(response);
    });
}

for (const failure of ['tokenFails', 'saveFails', 'authFails']) {
    test(`callback ${failure} uses a safe redirect and clears cookie`, async t => {
        const context = fixture(t, { [failure]: true });
        const state = await bandAuth.createBandOAuthState('center-a', 'owner-a');
        const response = await context.callback(callbackRequest(state));
        const target = new URL(response.headers.get('location'));
        assert.equal(failure === 'authFails' ? target.pathname : target.searchParams.get('band'), failure === 'authFails' ? '/login' : 'token-error');
        if (failure === 'tokenFails') assert.equal(context.counters.save, 0);
        if (failure === 'authFails') assertNoExchangeOrSave(context);
        assertCleared(response);
    });
}


for (const endpoint of ['connect', 'callback']) {
    test(endpoint + ' production proxy request redirects to public www login and does not leak the upstream origin', async t => {
        const context = fixture(t, { userId: null });
        const oldMode = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';
        try {
            for (const headers of [{ host: 'www.bowlingmanager.co.kr' }, { 'x-forwarded-host': 'www.bowlingmanager.co.kr' }, { host: 'bowlingmanager.co.kr' }]) {
                const request = new NextRequest('https://localhost:3000/api/integrations/band/' + endpoint, { headers });
                const response = await context[endpoint](request);
                assert.equal(response.headers.get('location'), 'https://www.bowlingmanager.co.kr/login');
                if (endpoint === 'callback') assertCleared(response);
            }
            const local = await context[endpoint](new NextRequest('http://localhost:3091/api/integrations/band/' + endpoint));
            assert.equal(local.headers.get('location'), 'http://localhost:3091/login');
            assertNoExchangeOrSave(context);
        } finally {
            if (oldMode === undefined) delete process.env.NODE_ENV;
            else process.env.NODE_ENV = oldMode;
        }
    });
}

test('BAND redirect helper ignores untrusted forwarded hosts and preserves local development origin', () => {
    const helper = loadTs('src/lib/band/redirect.ts', { '@/lib/public-web': loadTs('src/lib/public-web.ts') });
    const oldMode = process.env.NODE_ENV;
    try {
        process.env.NODE_ENV = 'production';
        const untrusted = new NextRequest('http://localhost:3091/api/integrations/band/connect', { headers: { 'x-forwarded-host': 'example.invalid' } });
        assert.equal(helper.bandAppUrl(untrusted, '/login').origin, 'http://localhost:3091');
        process.env.NODE_ENV = 'development';
        const dev = new NextRequest('http://localhost:3091/api/integrations/band/connect', { headers: { host: 'www.bowlingmanager.co.kr' } });
        assert.equal(helper.bandAppUrl(dev, '/login').origin, 'http://localhost:3091');
    } finally {
        if (oldMode === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = oldMode;
    }
});
