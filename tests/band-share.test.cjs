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

  const compiled = ts.transpileModule(
    fs.readFileSync(filename, 'utf8'),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        esModuleInterop: true,
      },
    },
  ).outputText;

  new Function('require', 'module', 'exports', compiled)(
    localRequire,
    module,
    module.exports,
  );

  return module.exports;
}

test('BAND token storage encrypts with authenticated encryption and detects tampering', () => {
  const previous = process.env.BAND_TOKEN_ENCRYPTION_KEY;
  process.env.BAND_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');

  try {
    const crypto = loadTs('src/lib/band/token-crypto.ts', {
      'server-only': {},
    });

    const secret = 'band-access-token-fixture';
    const encrypted = crypto.encryptBandToken(secret);

    assert.notEqual(encrypted, secret);
    assert.equal(encrypted.includes(secret), false);
    assert.equal(crypto.decryptBandToken(encrypted), secret);

    const parts = encrypted.split('.');
    parts[3] = parts[3].slice(0, -1) + (parts[3].endsWith('A') ? 'B' : 'A');

    assert.throws(
      () => crypto.decryptBandToken(parts.join('.')),
      /authenticate|Unsupported|Invalid/i,
    );
  } finally {
    if (previous === undefined) delete process.env.BAND_TOKEN_ENCRYPTION_KEY;
    else process.env.BAND_TOKEN_ENCRYPTION_KEY = previous;
  }
});

test('BAND OAuth pending cookie is signed and rejects tampering', () => {
  const previous = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = 'fixture-auth-secret-at-least-32-bytes-long';

  try {
    const state = loadTs('src/lib/band/oauth-cookie.ts', {
      'server-only': {},
    });

    const pending = {
      returnTo: '/centers/c1/tournaments/t1',
      userId: 'user-1',
      createdAt: 1_800_000_000_000,
    };

    const encoded = state.encodeBandOAuthPending(pending);
    assert.deepEqual(state.decodeBandOAuthPending(encoded), pending);

    const tampered = encoded.slice(0, -1) + (encoded.endsWith('A') ? 'B' : 'A');
    assert.equal(state.decodeBandOAuthPending(tampered), null);
  } finally {
    if (previous === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = previous;
  }
});

test('BAND OAuth URL uses only the documented authorization parameters', () => {
  const previous = {
    id: process.env.BAND_CLIENT_ID,
    secret: process.env.BAND_CLIENT_SECRET,
    redirect: process.env.BAND_REDIRECT_URI,
  };

  process.env.BAND_CLIENT_ID = '12345';
  process.env.BAND_CLIENT_SECRET = 'client-secret';
  process.env.BAND_REDIRECT_URI = 'https://www.bowlingmanager.co.kr/api/integrations/band/callback';

  try {
    const client = loadTs('src/lib/band/client.ts', {
      'server-only': {},
    });

    const url = new URL(client.buildBandAuthorizationUrl());

    assert.equal(url.origin, 'https://auth.band.us');
    assert.equal(url.pathname, '/oauth2/authorize');
    assert.equal(url.searchParams.get('response_type'), 'code');
    assert.equal(url.searchParams.get('client_id'), '12345');
    assert.equal(
      url.searchParams.get('redirect_uri'),
      'https://www.bowlingmanager.co.kr/api/integrations/band/callback',
    );
    assert.equal(url.searchParams.has('state'), false);
  } finally {
    if (previous.id === undefined) delete process.env.BAND_CLIENT_ID;
    else process.env.BAND_CLIENT_ID = previous.id;

    if (previous.secret === undefined) delete process.env.BAND_CLIENT_SECRET;
    else process.env.BAND_CLIENT_SECRET = previous.secret;

    if (previous.redirect === undefined) delete process.env.BAND_REDIRECT_URI;
    else process.env.BAND_REDIRECT_URI = previous.redirect;
  }
});

test('league weekly BAND formatter produces deterministic editable text', () => {
  const formatter = loadTs('src/lib/band/league-share.ts');

  const text = formatter.buildLeagueWeeklyBandPost({
    tournamentName: 'Fixture League',
    roundNumber: 4,
    roundDate: '2026-10-07T10:00:00.000Z',
    teamStandings: [
      { name: 'Alpha', wins: 3, losses: 1, totalPinfall: 7123 },
      { name: 'Beta', wins: 2, losses: 2, totalPinfall: 6987 },
    ],
    topPlayers: [
      {
        name: '홍길동',
        teamName: 'Alpha',
        gamesCount: 12,
        totalHandicappedPins: 2400,
      },
    ],
    matchups: [
      {
        teamA: { name: 'Alpha' },
        teamB: { name: 'Beta' },
        teamASquad: null,
        teamBSquad: null,
        pointsA: 3,
        pointsB: 1,
      },
    ],
    reportNotice: '결과 문의는 운영진에게 전달해주세요.',
  });

  assert.match(text, /Fixture League 4주차 경기결과/);
  assert.match(text, /1\. Alpha \| 3승 1패/);
  assert.match(text, /Alpha 3 : 1 Beta/);
  assert.match(text, /홍길동 \(Alpha\) - 200\.00/);
  assert.match(text, /결과 문의는 운영진에게 전달해주세요/);
});

test('BAND client uses official list, permission, profile and post endpoints without image attachment parameters', () => {
  const clientSource = source('src/lib/band/client.ts');

  assert.match(clientSource, /\/v2\/profile/);
  assert.match(clientSource, /\/v2\.1\/bands/);
  assert.match(clientSource, /\/v2\/band\/permissions/);
  assert.match(clientSource, /\/v2\.2\/band\/post\/create/);
  assert.match(clientSource, /permissions", "posting"/);
  assert.match(clientSource, /body\.set\("content"/);
  assert.match(clientSource, /body\.set\("do_push"/);
  assert.doesNotMatch(clientSource, /body\.set\("(?:image|photo|attachment)/i);
});

test('BAND league publish rechecks bowling center admin and posting permission before create', () => {
  const actionSource = source('src/app/actions/band-actions.ts');

  const adminCheck = actionSource.indexOf('verifyCenterAdmin');
  const permissionCheck = actionSource.indexOf('canWriteBandPost(');
  const createPost = actionSource.indexOf('createBandPost({');

  assert.ok(adminCheck >= 0);
  assert.ok(permissionCheck >= 0);
  assert.ok(createPost >= 0);
  assert.ok(permissionCheck < createPost);
  assert.match(actionSource, /fetchJoinedBands\(accessToken\)/);
  assert.match(actionSource, /band\.band_key === input\.bandKey/);
});

test('BAND migration is additive and stores no plaintext token columns', () => {
  const migration = source(
    'prisma/migrations/20261007120000_add_band_sharing/migration.sql',
  );

  assert.match(migration, /CREATE TABLE "BandConnection"/);
  assert.match(migration, /"encryptedAccessToken" TEXT NOT NULL/);
  assert.match(migration, /"encryptedRefreshToken" TEXT/);
  assert.match(migration, /CREATE TABLE "BandShareLog"/);
  assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN|DELETE FROM/i);
  assert.doesNotMatch(migration, /"accessToken" TEXT| "refreshToken" TEXT/);
});

test('weekly report screen keeps four PNG downloads and adds BAND share panel', () => {
  const downloader = source(
    'src/components/tournaments/WeeklyResultDownloader.tsx',
  );

  assert.match(downloader, /BandLeagueSharePanel/);
  assert.match(downloader, /TEAM_STANDINGS/);
  assert.match(downloader, /INDIVIDUAL_BY_TEAM/);
  assert.match(downloader, /MATCH_RECORD/);
  assert.match(downloader, /TOP_30/);
  assert.match(downloader, /4종 전체 다운로드/);
});
