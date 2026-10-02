// Run: node --test tests/team-code.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { createRequire } = require('node:module');

function loadTs(relative, overrides = {}) {
  const filename = path.resolve(__dirname, '..', relative);
  const module = { exports: {} };
  const nativeRequire = createRequire(filename);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  new Function('require', 'module', 'exports', compiled)(
    id => overrides[id] ?? nativeRequire(id),
    module,
    module.exports,
  );
  return module.exports;
}

test('secure team code retains the six-character uppercase alphanumeric contract', () => {
  const values = [0, 25, 26, 35, 1, 27];
  const teamCode = loadTs('src/lib/team-code.ts', {
    'node:crypto': { randomInt: () => { throw new Error('injected picker should be used'); } },
  });
  const code = teamCode.generateSecureTeamCode(() => values.shift());
  assert.equal(code, 'AZ09B1');
  assert.match(code, /^[A-Z0-9]{6}$/);
});

test('team creation retries only unique code collisions and preserves the successful code', async () => {
  const teamCode = loadTs('src/lib/team-code.ts', {
    'node:crypto': { randomInt: () => 0 },
  });
  const generated = ['AAAAAA', 'BBBBBB'];
  const seen = [];
  const result = await teamCode.createWithUniqueTeamCode(async code => {
    seen.push(code);
    if (seen.length === 1) throw { code: 'P2002', meta: { target: ['code'] } };
    return { id: 'team-1', code };
  }, () => generated.shift());
  assert.deepEqual(seen, ['AAAAAA', 'BBBBBB']);
  assert.deepEqual(result, { id: 'team-1', code: 'BBBBBB' });
});

test('team creation does not retry unrelated database failures', async () => {
  const teamCode = loadTs('src/lib/team-code.ts', {
    'node:crypto': { randomInt: () => 0 },
  });
  let calls = 0;
  await assert.rejects(
    teamCode.createWithUniqueTeamCode(async () => {
      calls += 1;
      throw { code: 'P2002', meta: { target: ['email'] } };
    }),
  );
  assert.equal(calls, 1);
});
