// Synthetic fixtures only. No database, network, or production calls.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { createRequire } = require('node:module');

const repositoryRoot = path.resolve(__dirname, '..');

function source(relative) {
  return fs.readFileSync(path.join(repositoryRoot, relative), 'utf8');
}

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
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText;
  new Function('require', 'module', 'exports', compiled)(localRequire, module, module.exports);
  return module.exports;
}

function authActions({ prisma, credentialCheck, generatedToken = '654321' }) {
  const mail = { verification: [], passwordReset: [] };
  const actions = loadTs('src/app/actions/auth.ts', {
    '@/auth': { signIn: async () => undefined },
    'next-auth': { AuthError: class AuthError extends Error {} },
    '@/lib/prisma': { getPrisma: () => prisma },
    bcryptjs: { hash: async value => `hashed:${value}` },
    'next/navigation': { redirect: path => path },
    '@/lib/tokens': {
      generateVerificationToken: async identifier => ({ identifier, token: generatedToken }),
    },
    '@/lib/mail': {
      sendVerificationEmail: async (...args) => mail.verification.push(args),
      sendPasswordResetEmail: async (...args) => mail.passwordReset.push(args),
    },
    '@/lib/credentials-auth': {
      checkCredentials: async () => credentialCheck ?? {
        user: null,
        hasPassword: false,
        isPasswordValid: false,
        isEmailVerified: false,
      },
    },
  });
  return { actions, mail };
}

for (const relative of [
  'src/app/api/force-reset/route.ts',
  'src/app/api/create-user-diag/route.ts',
  'src/app/api/debug-headers/route.ts',
  'src/app/api/debug-session/route.ts',
]) {
  test(`${relative} is absent from the production route source`, () => {
    assert.equal(fs.existsSync(path.join(repositoryRoot, relative)), false);
  });
}

test('verification codes use unbiased crypto randomInt and preserve six digits', async () => {
  let range;
  let created;
  const tokens = loadTs('src/lib/tokens.ts', {
    'node:crypto': {
      randomInt: (minimum, maximum) => {
        range = [minimum, maximum];
        return 100_042;
      },
    },
    '@/lib/prisma': {
      verificationToken: {
        findFirst: async () => null,
        delete: async () => undefined,
        create: async ({ data }) => {
          created = data;
          return data;
        },
      },
    },
  });

  const result = await tokens.generateVerificationToken('fixture@example.test');
  assert.deepEqual(range, [100_000, 1_000_000]);
  assert.equal(result.token, '100042');
  assert.match(result.token, /^\d{6}$/);
  assert.equal(created.identifier, 'fixture@example.test');
  assert.doesNotMatch(source('src/lib/tokens.ts'), /Math\.random/);
});

test('web login does not reveal whether an account or password exists', async () => {
  const failures = [
    { user: null, hasPassword: false, isPasswordValid: false, isEmailVerified: false },
    { user: { id: 'user-1' }, hasPassword: false, isPasswordValid: false, isEmailVerified: true },
    { user: { id: 'user-1' }, hasPassword: true, isPasswordValid: false, isEmailVerified: true },
  ];
  const messages = [];
  for (const credentialCheck of failures) {
    const { actions } = authActions({ prisma: {}, credentialCheck });
    const form = new FormData();
    form.set('email', 'fixture@example.test');
    form.set('password', 'wrong-password');
    messages.push(await actions.login(undefined, form));
  }
  assert.deepEqual(messages, Array(3).fill('이메일 또는 비밀번호를 확인해주세요.'));
});

test('signup verification request hides existing-account state and never logs secrets', async () => {
  const secret = '739201';
  const email = 'private@example.test';
  let existing = false;
  const prisma = { user: { findUnique: async () => existing ? { id: 'user-1' } : null } };
  const { actions, mail } = authActions({ prisma, generatedToken: secret });
  const logged = [];
  const originalError = console.error;
  console.error = (...args) => logged.push(args);
  try {
    const newAccount = await actions.sendCode(email);
    existing = true;
    const existingAccount = await actions.sendCode(email);
    assert.deepEqual(existingAccount, newAccount);
    assert.deepEqual(mail.verification, [[email, secret]]);
  } finally {
    console.error = originalError;
  }
  const serialized = JSON.stringify(logged);
  assert.equal(serialized.includes(secret), false);
  assert.equal(serialized.includes(email), false);
  assert.equal(serialized.includes('DATABASE_URL'), false);
});

test('password reset request does not reveal missing or OAuth-only accounts', async () => {
  let account = null;
  const prisma = { user: { findUnique: async () => account } };
  const { actions, mail } = authActions({ prisma });
  const missing = await actions.requestPasswordReset('missing@example.test');
  account = { id: 'oauth', password: null };
  const oauth = await actions.requestPasswordReset('oauth@example.test');
  account = { id: 'credentials', password: 'hash' };
  const credentials = await actions.requestPasswordReset('member@example.test');

  assert.deepEqual(missing, oauth);
  assert.deepEqual(oauth, credentials);
  assert.deepEqual(mail.passwordReset, [['member@example.test', '654321']]);
});

test('account lookup returns masked email values only', async () => {
  const rawEmail = 'member@example.test';
  const createdAt = new Date('2026-01-02T00:00:00.000Z');
  const { actions } = authActions({
    prisma: {
      user: {
        findMany: async () => [{ email: rawEmail, createdAt }],
      },
    },
  });
  const result = await actions.findEmail('Fixture');
  assert.equal(result.success, true);
  assert.equal(result.data[0].email, 'm***@example.test');
  assert.equal(JSON.stringify(result).includes(rawEmail), false);
});

test('verified signup still creates a credentials account and consumes its code', async () => {
  const expires = new Date(Date.now() + 60_000);
  let created;
  let deleted;
  const { actions } = authActions({
    prisma: {
      verificationToken: {
        findFirst: async () => ({ expires }),
        delete: async args => { deleted = args; },
      },
      user: {
        findUnique: async () => null,
        create: async args => { created = args; },
      },
    },
  });
  const form = new FormData();
  form.set('email', 'member@example.test');
  form.set('password', 'valid-password');
  form.set('name', 'Fixture Member');
  form.set('code', '654321');

  const result = await actions.register(undefined, form);
  assert.equal(result, '/login?message=registered');
  assert.equal(created.data.email, 'member@example.test');
  assert.equal(created.data.name, 'FixtureMember');
  assert.equal(created.data.password, 'hashed:valid-password');
  assert.ok(created.data.emailVerified instanceof Date);
  assert.deepEqual(deleted.where.identifier_token, {
    identifier: 'member@example.test',
    token: '654321',
  });
});

test('verified password reset still updates the password and consumes its code', async () => {
  const expires = new Date(Date.now() + 60_000);
  let updated;
  let deleted;
  const { actions } = authActions({
    prisma: {
      verificationToken: {
        findFirst: async () => ({ expires }),
        delete: async args => { deleted = args; },
      },
      user: {
        update: async args => { updated = args; },
      },
    },
  });

  const result = await actions.resetPassword(
    'member@example.test',
    '654321',
    'next-password',
  );
  assert.deepEqual(result, {
    success: true,
    message: '비밀번호가 성공적으로 변경되었습니다.',
  });
  assert.equal(updated.where.email, 'member@example.test');
  assert.equal(updated.data.password, 'hashed:next-password');
  assert.deepEqual(deleted.where.identifier_token, {
    identifier: 'member@example.test',
    token: '654321',
  });
});

test('auth source does not log verification codes, email values, or DATABASE_URL', () => {
  const authSource = source('src/app/actions/auth.ts').replace(/\r\n?/g, '\n');
  const logStatements = authSource
    .split('\n')
    .filter(line => /console\.(?:log|error|warn)\(/.test(line))
    .join('\n');
  assert.doesNotMatch(authSource, /DATABASE_URL/);
  assert.doesNotMatch(logStatements, /verificationToken\.token/);
  assert.doesNotMatch(logStatements, /,\s*email\b/);
  assert.doesNotMatch(logStatements, /,\s*error\b/);
});

test('AI and draw logging does not include raw response payloads', () => {
  const combined = [
    source('src/app/actions/gemini-score.ts'),
    source('src/app/actions/raw-score-actions.ts'),
    source('src/components/tournaments/RoundDetailPageContent.tsx'),
  ].join('\n');
  assert.doesNotMatch(combined, /Gemini Raw Response|Failed JSON String|Raw result:/);
});

test('mobile credential login still issues the token pair', async () => {
  const tokens = { accessToken: 'access', refreshToken: 'refresh' };
  const route = loadTs('src/app/api/mobile/v1/auth/login/route.ts', {
    '@/lib/credentials-auth': {
      checkCredentials: async () => ({ valid: true, user: { id: 'user-1' } }),
      hasValidCredentials: value => value.valid,
    },
    '@/lib/mobile-api/refresh-token': { issueMobileTokenPair: async () => tokens },
  });
  const response = await route.POST(new Request('https://example.test/api/mobile/v1/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'fixture@example.test', password: 'valid-password' }),
  }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true, data: tokens });
});

test('mobile refresh still rotates a valid refresh token', async () => {
  const tokens = { accessToken: 'next-access', refreshToken: 'next-refresh' };
  const route = loadTs('src/app/api/mobile/v1/auth/refresh/route.ts', {
    '@/lib/mobile-api/refresh-request': { readRefreshToken: async () => 'refresh' },
    '@/lib/mobile-api/refresh-token': {
      rotateMobileRefreshToken: async () => ({ success: true, tokens }),
    },
  });
  const response = await route.POST(new Request('https://example.test/api/mobile/v1/auth/refresh'));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true, data: tokens });
});

test('mobile logout still revokes the supplied refresh-token family', async () => {
  let revoked;
  const route = loadTs('src/app/api/mobile/v1/auth/logout/route.ts', {
    '@/lib/mobile-api/refresh-request': { readRefreshToken: async () => 'refresh' },
    '@/lib/mobile-api/refresh-token': {
      revokeMobileRefreshTokenFamily: async value => { revoked = value; },
    },
  });
  const response = await route.POST(new Request('https://example.test/api/mobile/v1/auth/logout'));
  assert.equal(response.status, 200);
  assert.equal(revoked, 'refresh');
  assert.deepEqual(await response.json(), { success: true, data: { loggedOut: true } });
});
