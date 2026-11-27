// Synthetic fixtures only. No database, network, or production calls.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { createRequire } = require('node:module');

const repositoryRoot = path.resolve(__dirname, '..');

// Every call gets fresh module instances, so limiter state never leaks between tests.
function loadTs(relative, overrides = {}, cache = new Map()) {
  const filename = path.resolve(repositoryRoot, relative);
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

test('attempt limiter blocks at the limit, ignores key case and resets after the window', () => {
  const limiter = loadTs('src/lib/attempt-limiter.ts');
  const policy = { limit: 3, windowMs: 1000 };
  assert.equal(limiter.recordAttempt('A@x.com', policy, 0), false);
  assert.equal(limiter.recordAttempt('a@x.com', policy, 10), false);
  assert.equal(limiter.isAttemptLimited('a@X.com', policy, 20), false);
  assert.equal(limiter.recordAttempt('a@x.com', policy, 30), true);
  assert.equal(limiter.isAttemptLimited('a@x.com', policy, 40), true);
  assert.equal(limiter.isAttemptLimited('a@x.com', policy, 1000), false);
  limiter.recordAttempt('b@x.com', policy, 0);
  limiter.clearAttempts('b@x.com');
  assert.equal(limiter.isAttemptLimited('b@x.com', { limit: 1, windowMs: 1000 }, 1), false);
});

function resetActions() {
  const state = { token: { identifier: 'user@example.com', token: '123456', expires: new Date(Date.now() + 60_000) }, deleted: 0, updated: 0 };
  const prisma = {
    verificationToken: {
      findFirst: async ({ where }) => (state.token && where.identifier === state.token.identifier && where.token === state.token.token ? state.token : null),
      deleteMany: async () => { state.token = null; state.deleted += 1; return { count: 1 }; },
      delete: async () => { state.token = null; },
    },
    user: { update: async () => { state.updated += 1; }, findUnique: async () => null },
  };
  const actions = loadTs('src/app/actions/auth.ts', {
    '@/auth': { signIn: async () => undefined },
    'next-auth': { AuthError: class AuthError extends Error {} },
    '@/lib/prisma': { getPrisma: () => prisma },
    bcryptjs: { hash: async value => `hashed:${value}` },
    'next/navigation': { redirect: target => target },
    '@/lib/tokens': { generateVerificationToken: async identifier => ({ identifier, token: '123456' }) },
    '@/lib/mail': { sendVerificationEmail: async () => undefined, sendPasswordResetEmail: async () => undefined },
    '@/lib/credentials-auth': { checkCredentials: async () => ({ user: null, hasPassword: false, isPasswordValid: false, isEmailVerified: false }) },
  });
  return { actions, state };
}

test('five wrong reset codes delete the outstanding code and block further guesses', async () => {
  const { actions, state } = resetActions();
  for (let attempt = 1; attempt <= 4; attempt++) {
    const result = await actions.resetPassword('user@example.com', '000000', 'new-password');
    assert.match(result.message, /틀리거나 만료/);
  }
  const fifth = await actions.resetPassword('user@example.com', '000001', 'new-password');
  assert.match(fifth.message, /입력 횟수를 초과/);
  assert.equal(state.deleted, 1);
  const correctAfterLockout = await actions.resetPassword('user@example.com', '123456', 'new-password');
  assert.equal(correctAfterLockout.success, false);
  assert.equal(state.updated, 0);
});

test('a correct reset code inside the limit still resets the password', async () => {
  const { actions, state } = resetActions();
  await actions.resetPassword('user@example.com', '000000', 'new-password');
  const result = await actions.resetPassword('user@example.com', '123456', 'new-password');
  assert.equal(result.success, true);
  assert.equal(state.updated, 1);
});

test('code e-mails are limited per address, including addresses without an account', async () => {
  const { actions } = resetActions();
  for (let attempt = 1; attempt <= 5; attempt++) {
    assert.equal((await actions.requestPasswordReset('nobody@example.com')).success, true);
  }
  const sixth = await actions.requestPasswordReset('nobody@example.com');
  assert.equal(sixth.success, false);
  assert.match(sixth.message, /요청이 너무 많습니다/);
});

test('ten failed logins lock the e-mail for both known and unknown accounts', async () => {
  const account = { id: 'u1', email: 'user@example.com', name: 'U', role: 'USER', password: 'hash', emailVerified: new Date() };
  const credentials = loadTs('src/lib/credentials-auth.ts', {
    'server-only': {},
    '@/lib/prisma': { __esModule: true, default: { user: { findUnique: async ({ where }) => (where.email === account.email ? account : null) } } },
    bcryptjs: { compare: async password => password === 'right' },
  });
  for (let attempt = 1; attempt <= 10; attempt++) {
    const check = await credentials.checkCredentials('user@example.com', 'wrong');
    assert.notEqual(check.isRateLimited, true);
  }
  const locked = await credentials.checkCredentials('user@example.com', 'right');
  assert.equal(locked.isRateLimited, true);
  assert.equal(credentials.hasValidCredentials(locked), false);

  for (let attempt = 1; attempt <= 10; attempt++) await credentials.checkCredentials('ghost@example.com', 'x');
  assert.equal((await credentials.checkCredentials('ghost@example.com', 'x')).isRateLimited, true);

  const other = await credentials.checkCredentials('USER2@example.com', 'right');
  assert.equal(other.isRateLimited, undefined);
});

test('a successful login clears earlier failures', async () => {
  const account = { id: 'u1', email: 'user@example.com', name: 'U', role: 'USER', password: 'hash', emailVerified: new Date() };
  const credentials = loadTs('src/lib/credentials-auth.ts', {
    'server-only': {},
    '@/lib/prisma': { __esModule: true, default: { user: { findUnique: async () => account } } },
    bcryptjs: { compare: async password => password === 'right' },
  });
  for (let attempt = 1; attempt <= 9; attempt++) await credentials.checkCredentials('user@example.com', 'wrong');
  assert.equal(credentials.hasValidCredentials(await credentials.checkCredentials('user@example.com', 'right')), true);
  for (let attempt = 1; attempt <= 9; attempt++) await credentials.checkCredentials('user@example.com', 'wrong');
  assert.equal(credentials.hasValidCredentials(await credentials.checkCredentials('user@example.com', 'right')), true);
});
