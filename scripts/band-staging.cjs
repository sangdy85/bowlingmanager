#!/usr/bin/env node
'use strict';

// Standalone, opt-in BAND staging runner. Never reads or copies the production DB.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const ENV_FILE = path.join(ROOT, '.env.band-staging.local');
const DB_FILE = path.join(ROOT, 'prisma', 'band-staging.db');
const DB_URL = 'file:./band-staging.db';
const PORT = 3101;
const CONFIRM = '--confirm-band-staging';

function assertWorktree(fsApi = fs, dir = ROOT) {
  const marker = path.join(dir, '.git');
  if (!/staging/i.test(path.basename(dir)) || !fsApi.existsSync(marker) || !fsApi.statSync(marker).isFile()) {
    throw new Error('Use a dedicated Git worktree folder containing "staging" (e.g. C:\\bm-staging).');
  }
  for (const forbidden of ['.env', '.env.local', '.env.production', '.env.development']) {
    if (fsApi.existsSync(path.join(dir, forbidden))) {
      throw new Error('Refusing staging because another Next.js .env file exists: ' + forbidden);
    }
  }
  const prismaDir = path.join(dir, 'prisma');
  if (fsApi.existsSync(path.join(prismaDir, 'band-staging.db')) &&
      fsApi.lstatSync(path.join(prismaDir, 'band-staging.db')).isSymbolicLink()) {
    throw new Error('Staging DB must be a regular file, never a symlink.');
  }
}

function parseEnv(data) {
  const env = {};
  for (const line of data.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const match = /^([A-Z_][A-Z_0-9]*)=(.*)$/.exec(line);
    if (!match) throw new Error('Invalid staging env configuration.');
    env[match[1]] = match[2];
  }
  return env;
}

function assertStageEnv(env) {
  if (env.APP_ENV !== 'band-staging' ||
      env.DATABASE_URL !== DB_URL ||
      env.BAND_EXTERNAL_POSTING_ENABLED !== 'false' ||
      !env.AUTH_SECRET || env.AUTH_SECRET.length < 32 ||
      !env.BAND_STAGING_QA_PASSWORD ||
      env.AUTH_URL !== 'http://127.0.0.1:3101') {
    throw new Error('Unsafe or incomplete staging environment. Run init in the staging worktree.');
  }
}

function init(confirm, fsApi = fs) {
  if (!confirm) throw new Error('Initialization requires ' + CONFIRM);
  assertWorktree(fsApi);
  if (fsApi.existsSync(ENV_FILE) || fsApi.existsSync(DB_FILE)) {
    throw new Error('A staging env or database already exists. Refusing to overwrite.');
  }
  const generated = [
    '# LOCAL STAGING ONLY. Never copy to production or commit.',
    'APP_ENV=band-staging',
    'DATABASE_URL=' + DB_URL,
    'BAND_EXTERNAL_POSTING_ENABLED=false',
    'AUTH_URL=http://127.0.0.1:3101',
    'AUTH_TRUST_HOST=true',
    'AUTH_SECRET=' + crypto.randomBytes(32).toString('hex'),
    'BAND_STAGING_QA_PASSWORD=' + crypto.randomBytes(12).toString('hex'),
    'BAND_TOKEN_ENCRYPTION_KEY=' + crypto.randomBytes(32).toString('base64'),
    '',
  ].join('\n');
  fsApi.writeFileSync(ENV_FILE, generated, { mode: 0o600, flag: 'wx' });
  console.log('Created isolated staging configuration: .env.band-staging.local');
  console.log('Database: prisma/band-staging.db (not created until migrate).');
  console.log('Credentials: view ONLY the local .env.band-staging.local file.');
}

function getStageEnv(fsApi = fs) {
  assertWorktree(fsApi);
  if (!fsApi.existsSync(ENV_FILE) || fsApi.lstatSync(ENV_FILE).isSymbolicLink()) {
    throw new Error('No safe staging configuration. Run init first.');
  }
  const settings = parseEnv(fsApi.readFileSync(ENV_FILE, 'utf8'));
  assertStageEnv(settings);
  // Do not pass any inherited integration secrets to the local staging app.
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) =>
    !/^(DATABASE_URL|AUTH_|BAND_|GOOGLE_|NAVER_|FIREBASE_|MOBILE_|OPENAI_|GEMINI_|NEXT_PUBLIC_|APP_ENV$)/.test(name)));
  return {
    ...env, ...settings,
    GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '',
    NAVER_CLIENT_ID: '', NAVER_CLIENT_SECRET: '',
    BAND_CLIENT_ID: '', BAND_CLIENT_SECRET: '',
    NODE_ENV: 'development',
  };
}

function command(name) {
  const env = getStageEnv();
  if (name !== 'migrate' && !fs.existsSync(DB_FILE)) {
    throw new Error('Staging SQLite DB not found. Run migrate first.');
  }
  if (name === 'check') {
    console.log('WORKTREE=' + ROOT);
    console.log('DATABASE=prisma/band-staging.db');
    console.log('APP_ENV=' + env.APP_ENV);
    console.log('BAND_EXTERNAL_POSTING_ENABLED=' + env.BAND_EXTERNAL_POSTING_ENABLED);
    console.log('PORT=' + PORT + ' (127.0.0.1 only)');
    console.log('DB exists: ' + fs.existsSync(DB_FILE));
    return;
  }
  const cli = name === 'migrate'
    ? path.join(ROOT, 'node_modules', 'prisma', 'build', 'index.js')
    : name === 'seed'
      ? path.join(__dirname, 'seed-band-staging.cjs')
      : path.join(ROOT, 'node_modules', 'next', 'dist', 'bin', 'next');
  const args = name === 'migrate' ? [cli, 'migrate', 'deploy']
    : name === 'seed' ? [cli]
    : [cli, 'dev', '-H', '127.0.0.1', '-p', String(PORT)];

  console.log('BAND staging: ' + name + ' with isolated SQLite and external posting disabled.');
  const result = spawnSync(process.execPath, args, { cwd: ROOT, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.exitCode = result.status || 1;
    return;
  }
  if (name === 'migrate') {
    // A clean worktree needs its Prisma Client regenerated after migrations.
    const generator = spawnSync(process.execPath,
      [path.join(ROOT, 'node_modules', 'prisma', 'build', 'index.js'), 'generate'],
      { cwd: ROOT, env, stdio: 'inherit' });
    if (generator.error) throw generator.error;
    if (generator.status !== 0) process.exitCode = generator.status || 1;
  }
}

if (require.main === module) {
  try {
    const [op, ...args] = process.argv.slice(2);
    if (op === 'init') init(args.includes(CONFIRM));
    else if (['migrate', 'seed', 'start', 'check'].includes(op)) command(op);
    else throw new Error('Usage: node scripts/band-staging.cjs init --confirm-band-staging | migrate | seed | start | check');
  } catch (error) {
    console.error('BAND staging safety check failed:', error.message);
    process.exitCode = 1;
  }
}

module.exports = { assertWorktree, parseEnv, assertStageEnv, init, getStageEnv, DB_URL, PORT };
