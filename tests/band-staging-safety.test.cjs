const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const runner = require('../scripts/band-staging.cjs');
const seed = require('../scripts/seed-band-staging.cjs');

function loadTs(relativePath, mocks = {}) {
  const filename = path.join(process.cwd(), relativePath);
  const js = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  const localRequire = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  new Function('require', 'module', 'exports', js)(localRequire, module, module.exports);
  return module.exports;
}

const guard = loadTs('src/lib/band/outbound-policy.ts');

test('외부 BAND 게시 옵트인은 production과 명시적 true가 모두 있어야 한다', () => {
  assert.equal(guard.bandExternalPostingAllowed({}), false);
  assert.equal(guard.bandExternalPostingAllowed({ APP_ENV: 'band-staging', BAND_EXTERNAL_POSTING_ENABLED: 'true' }), false);
  assert.equal(guard.bandExternalPostingAllowed({ APP_ENV: 'production', BAND_EXTERNAL_POSTING_ENABLED: 'false' }), false);
  assert.equal(guard.bandExternalPostingAllowed({ APP_ENV: 'production', BAND_EXTERNAL_POSTING_ENABLED: 'true' }), true);
});

test('스테이징 설정은 별도 SQLite와 게시 금지를 강제한다', () => {
  const valid = {
    APP_ENV: 'band-staging',
    DATABASE_URL: 'file:./band-staging.db',
    BAND_EXTERNAL_POSTING_ENABLED: 'false',
    AUTH_URL: 'http://127.0.0.1:3101',
    AUTH_SECRET: 'staging-secret-longer-than-32-characters',
    BAND_STAGING_QA_PASSWORD: 'staging-only-pass',
  };
  assert.doesNotThrow(() => runner.assertStageEnv(valid));
  assert.throws(() => runner.assertStageEnv({ ...valid, DATABASE_URL: 'file:./dev.db' }), /Unsafe/);
  assert.throws(() => runner.assertStageEnv({ ...valid, BAND_EXTERNAL_POSTING_ENABLED: 'true' }), /Unsafe/);
  assert.throws(() => runner.assertStageEnv({ ...valid, APP_ENV: 'production' }), /Unsafe/);
  assert.equal(runner.DB_URL, 'file:./band-staging.db');
  assert.equal(runner.PORT, 3101);
});

test('기존 프로젝트 폴더에서 실수로 스테이징 초기화할 수 없다', () => {
  assert.throws(() => runner.init(false), /requires --confirm-band-staging/);
  assert.throws(() => runner.assertWorktree(fs, path.join(process.cwd(), 'not-a-worktree')), /Git worktree folder/);
});

test('스테이징 샘플 생성은 운영 DB와 운영 환경에서 차단된다', () => {
  const cwd = path.join(process.cwd(), 'not-the-staging-worktree');
  const base = {
    APP_ENV: 'band-staging',
    DATABASE_URL: 'file:./band-staging.db',
    BAND_EXTERNAL_POSTING_ENABLED: 'false',
    BAND_STAGING_QA_PASSWORD: 'test',
  };
  assert.throws(() => seed.assertStagingSeedTarget(base, cwd), /isolated staging/);
  assert.throws(() => seed.assertStagingSeedTarget({ ...base, DATABASE_URL: 'file:./dev.db' }, cwd), /isolated staging/);
});

test('BAND 발행 API는 차단된 환경에서 네트워크 요청 전에 중단된다', async () => {
  const client = loadTs('src/lib/band/client.ts', {
    './outbound-policy': {
      bandExternalPostingAllowed: () => false,
      BAND_POSTING_DISABLED_MESSAGE: '스테이징에서 외부 게시 금지',
    },
  });
  let calls = 0;
  const previous = global.fetch;
  global.fetch = async () => { calls++; throw new Error('must never call BAND'); };
  try {
    await assert.rejects(
      client.createPost({ accessToken: 'invalid', bandKey: 'fake', content: 'test' }),
      error => error.code === 'EXTERNAL_POSTING_DISABLED',
    );
    assert.equal(calls, 0);
  } finally {
    global.fetch = previous;
  }
});

test('퍼블리셔는 발행 전에 외부 게시 비활성화 여부를 검사한다', () => {
  const source = fs.readFileSync('src/lib/band/publisher.ts', 'utf8');
  const stageClient = fs.readFileSync('src/lib/band/client.ts', 'utf8');
  const prismaSource = fs.readFileSync('src/lib/prisma.ts', 'utf8');
  assert.match(source, /if \(!bandExternalPostingAllowed\(\)\)/);
  assert.ok(source.indexOf('if (!bandExternalPostingAllowed())') < source.indexOf('await db.bandPost.create('));
  assert.match(stageClient, /EXTERNAL_POSTING_DISABLED/);
  assert.match(prismaSource, /process\.env\.APP_ENV === 'band-staging'/);
  assert.match(prismaSource, /file:\.\/band-staging\.db/);
});
