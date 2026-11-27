const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('account scripts take credentials from the environment, not the source', () => {
  const seed = read('scripts/seed-super-admin.js');
  assert.match(seed, /process\.env\.SUPER_ADMIN_PASSWORD/);
  assert.doesNotMatch(seed, /bcrypt\.hash\('[^']+'/);
  assert.match(read('scripts/create-test-users.js'), /Refusing to run/);
});

test('only one NextAuth catch-all route exists', () => {
  const authDir = path.join(root, 'src/app/api/auth');
  assert.deepEqual(fs.readdirSync(authDir), ['[...nextauth]']);
});

test('prisma client enables SQLite WAL mode for file databases', () => {
  const source = read('src/lib/prisma.ts');
  assert.match(source, /PRAGMA journal_mode = WAL;/);
  assert.match(source, /url\.startsWith\('file:'\)/);
});

test('.env.example is committed and lists the required secrets without values', () => {
  const example = read('.env.example');
  for (const name of ['DATABASE_URL', 'AUTH_SECRET', 'MOBILE_API_JWT_SECRET', 'GMAIL_USER', 'GMAIL_APP_PASSWORD']) {
    assert.match(example, new RegExp(`^${name}=`, 'm'), name);
  }
  for (const line of example.split('\n').filter(l => /^[A-Z_]+=/.test(l) && !l.startsWith('DATABASE_URL'))) {
    assert.match(line, /=""$/, line);
  }
  assert.match(read('.gitignore'), /^!\.env\.example$/m);
});
