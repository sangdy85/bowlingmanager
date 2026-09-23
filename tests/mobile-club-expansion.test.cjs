// Synthetic fixtures only. No database or production calls.
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
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText;
  new Function('require', 'module', 'exports', compiled)(localRequire, module, module.exports);
  return module.exports;
}

const service = loadTs('src/lib/mobile-api/club-expansion.ts', { '@/lib/prisma': {} });

const members = [
  { id: 'member-a', userId: 'user-a', name: '동명이인' },
  { id: 'member-b', userId: 'user-b', name: '동명이인' },
  { id: 'member-c', userId: 'user-c', name: '세 번째' },
];

function score(id, value, date, userId, changes = {}) {
  return {
    id,
    score: value,
    gameDate: new Date(`${date}T03:00:00.000Z`),
    gameType: '정기전',
    userId,
    guestName: null,
    memo: null,
    createdAt: new Date(`${date}T03:00:00.000Z`),
    user: userId ? { name: '표시하지 않는 실명' } : null,
    ...changes,
  };
}

test('season ranking derives podium points from regular activities and excludes guests', () => {
  const scores = [
    score('a-1', 210, '2026-01-10', 'user-a'),
    score('b-1', 200, '2026-01-10', 'user-b'),
    score('c-1', 190, '2026-01-10', 'user-c'),
    score('guest', 300, '2026-01-10', null, { guestName: '게스트' }),
    score('b-2', 220, '2026-02-10', 'user-b'),
    score('a-2', 180, '2026-02-10', 'user-a'),
    score('casual', 300, '2026-02-10', 'user-c', { gameType: '벙개' }),
  ];
  const rows = service.calculateSeasonRanking('team-1', scores, members, 'PODIUM', [5, 3, 1]);
  assert.equal(rows.length, 3);
  assert.equal(rows.some(row => row.name === '게스트'), false);
  assert.deepEqual(rows.map(row => ({ id: row.id, points: row.points })), [
    { id: 'member-b', points: 6 },
    { id: 'member-a', points: 6 },
    { id: 'member-c', points: 0 },
  ]);
});

test('FULL_RANK uses configured places and undefined places receive zero points', () => {
  const scores = [
    score('a', 230, '2026-03-10', 'user-a'),
    score('b', 220, '2026-03-10', 'user-b'),
    score('c', 210, '2026-03-10', 'user-c'),
  ];
  const rows = service.calculateSeasonRanking('team-1', scores, members, 'FULL_RANK', [10, 4]);
  assert.deepEqual(rows.map(row => row.points), [10, 4, 0]);
});

test('season ranking keeps equal display names distinct and resolves complete ties by membership id', () => {
  const rows = service.calculateSeasonRanking('team-1', [], members.slice(0, 2), 'PODIUM', [5, 3, 1]);
  assert.deepEqual(rows.map(row => ({ rank: row.rank, id: row.id })), [
    { rank: 1, id: 'member-a' },
    { rank: 2, id: 'member-b' },
  ]);
});

test('season ranking is fully recalculated from the supplied current score set', () => {
  const original = service.calculateSeasonRanking('team-1', [
    score('a', 230, '2026-04-10', 'user-a'),
    score('b', 200, '2026-04-10', 'user-b'),
  ], members.slice(0, 2), 'PODIUM', [5, 3, 1]);
  const edited = service.calculateSeasonRanking('team-1', [
    score('a', 180, '2026-04-10', 'user-a'),
    score('b', 240, '2026-04-10', 'user-b'),
  ], members.slice(0, 2), 'PODIUM', [5, 3, 1]);
  const deleted = service.calculateSeasonRanking('team-1', [], members.slice(0, 2), 'PODIUM', [5, 3, 1]);
  assert.equal(original[0].id, 'member-a');
  assert.equal(edited[0].id, 'member-b');
  assert.equal(deleted.every(row => row.points === 0 && row.games === 0), true);
});

test('published EVENT awards replace regular rank points without double-counting score statistics', () => {
  const scores = [
    score('a', 200, '2026-05-10', 'user-a'),
    score('b', 190, '2026-05-10', 'user-b'),
  ];
  const awards = [{
    date: '2026-05-10',
    gameType: '정기전',
    rows: [
      { memberId: 'member-a', rank: 2, seasonPoint: 17 },
      { memberId: 'member-b', rank: 1, seasonPoint: 20 },
    ],
  }];
  const rows = service.calculateSeasonRanking(
    'team-1', scores, members.slice(0, 2), 'PODIUM', [5, 3, 1], awards,
  );
  const first = rows.find(row => row.id === 'member-a');
  const second = rows.find(row => row.id === 'member-b');
  assert.deepEqual(
    { points: first.points, attended: first.attended, games: first.games, total: first.total, silver: first.silver },
    { points: 17, attended: 1, games: 1, total: 200, silver: 1 },
  );
  assert.deepEqual(
    { points: second.points, attended: second.attended, games: second.games, total: second.total, gold: second.gold },
    { points: 20, attended: 1, games: 1, total: 190, gold: 1 },
  );
});

test('non-regular EVENT awards add attendance and points without changing game average', () => {
  const rows = service.calculateSeasonRanking(
    'team-1', [], members.slice(0, 2), 'PODIUM', [5, 3, 1], [{
      date: '2026-06-10',
      gameType: '이벤트전',
      rows: [
        { memberId: 'member-a', rank: 1, seasonPoint: 20 },
        { memberId: 'member-b', rank: null, seasonPoint: 0 },
      ],
    }],
  );
  assert.deepEqual(
    rows.map(row => ({ id: row.id, points: row.points, attended: row.attended, games: row.games, total: row.total })),
    [
      { id: 'member-a', points: 20, attended: 1, games: 0, total: 0 },
      { id: 'member-b', points: 0, attended: 1, games: 0, total: 0 },
    ],
  );
});

test('member profile uses KST year boundaries and exposes no user id or private account fields', async () => {
  const fakePrisma = {
    team: {
      findFirst: async () => ({
        id: 'team-1', name: '팀', ownerId: 'user-a', description: null,
        notice: null, seasonRankingEnabled: false, User: [],
        members: [{
          id: 'member-a', userId: 'user-a', alias: '별명',
          joinedAt: new Date('2025-01-01T00:00:00.000Z'),
          user: { name: '실명', handicap: null },
        }],
      }),
    },
    score: {
      findMany: async () => [
        score('kst-new-year', 200, '2025-12-31', 'user-a', {
          gameDate: new Date('2025-12-31T15:30:00.000Z'),
        }),
      ],
    },
  };
  const isolated = loadTs('src/lib/mobile-api/club-expansion.ts', {
    '@/lib/prisma': fakePrisma,
  });
  const profile = await isolated.getMobileMemberProfile('user-a', 'team-1', 'member-a', 2026);
  assert.equal(profile.gameCount, 1);
  assert.equal(profile.activityStartDate, '2026-01-01');
  for (const privateKey of ['userId', 'email', 'password']) {
    assert.equal(Object.hasOwn(profile, privateKey), false);
  }
});

test('additive migration preserves Team and constrains season mode and dates', () => {
  const sql = fs.readFileSync(
    path.resolve(__dirname, '../prisma/migrations/20260922170000_add_team_profile_and_seasons/migration.sql'),
    'utf8',
  );
  assert.doesNotMatch(sql, /DROP\s+TABLE\s+"Team"/i);
  assert.match(sql, /ADD COLUMN "description" TEXT/);
  assert.match(sql, /ADD COLUMN "notice" TEXT/);
  assert.match(sql, /CREATE TABLE "TeamSeason"/);
  assert.match(sql, /scoringMode_check/);
  assert.match(sql, /date_check/);
  assert.match(sql, /ON DELETE CASCADE/);
});

test('board route requires auth and scopes the actor and team through the service', async () => {
  let call = null;
  const route = loadTs('src/app/api/mobile/v1/teams/[teamId]/posts/route.ts', {
    '@/lib/mobile-api/auth': {
      getMobileApiUserId: async request => request.headers.get('x-user'),
    },
    '@/lib/mobile-api/club-expansion': {
      listMobileTeamPosts: async (userId, teamId, page, limit) => {
        call = { userId, teamId, page, limit };
        return { items: [], pagination: { page, limit, total: 0, totalPages: 0 } };
      },
      createMobileTeamPost: async () => ({ postId: 'post-1' }),
      ClubExpansionError: service.ClubExpansionError,
    },
  });
  let response = await route.GET(new Request('https://example.test/posts'), {
    params: Promise.resolve({ teamId: 'team-1' }),
  });
  assert.equal(response.status, 401);
  assert.equal(call, null);
  response = await route.GET(new Request('https://example.test/posts?page=2&limit=10', {
    headers: { 'x-user': 'user-a' },
  }), { params: Promise.resolve({ teamId: 'team-1' }) });
  assert.equal(response.status, 200);
  assert.deepEqual(call, { userId: 'user-a', teamId: 'team-1', page: 2, limit: 10 });
});

test('board service rejects outsiders and keeps edit/delete author-only', async () => {
  let member = false;
  let updated = 0;
  let deleted = 0;
  const fakePrisma = {
    team: {
      findFirst: async () => member ? fakeTeam() : null,
    },
    post: {
      findFirst: async () => ({ authorId: 'author' }),
      update: async () => { updated += 1; },
      delete: async () => { deleted += 1; },
    },
  };
  const isolated = loadTs('src/lib/mobile-api/club-expansion.ts', {
    '@/lib/prisma': fakePrisma,
  });
  await assert.rejects(
    isolated.updateMobileTeamPost('outsider', 'team-1', 'post-1', { title: '제목', content: '본문' }),
    error => error.code === 'TEAM_NOT_FOUND' && error.status === 404,
  );
  member = true;
  await assert.rejects(
    isolated.updateMobileTeamPost('member', 'team-1', 'post-1', { title: '제목', content: '본문' }),
    error => error.code === 'FORBIDDEN' && error.status === 403,
  );
  await assert.rejects(
    isolated.deleteMobileTeamPost('member', 'team-1', 'post-1'),
    error => error.code === 'FORBIDDEN' && error.status === 403,
  );
  await isolated.updateMobileTeamPost('author', 'team-1', 'post-1', { title: '제목', content: '본문' });
  await isolated.deleteMobileTeamPost('author', 'team-1', 'post-1');
  assert.equal(updated, 1);
  assert.equal(deleted, 1);
});

test('board list, detail and create reuse Post data without exposing author ids', async () => {
  const now = new Date('2026-09-22T00:00:00.000Z');
  const fakePrisma = {
    team: { findFirst: async () => fakeTeam() },
    $transaction: async operations => Promise.all(operations),
    post: {
      findMany: async () => [{
        id: 'post-1', title: '게시글', createdAt: now, updatedAt: now,
        author: { name: '작성자' }, _count: { images: 2 },
      }],
      count: async () => 1,
      findFirst: async () => ({
        id: 'post-1', title: '게시글', content: '본문', authorId: 'author',
        createdAt: now, updatedAt: now, author: { name: '작성자' },
        images: [{ id: 'image-1', url: '/uploads/test.png' }],
      }),
      create: async args => {
        assert.equal(args.data.authorId, 'author');
        assert.equal(args.data.teamId, 'team-1');
        return { id: 'post-new' };
      },
    },
  };
  const isolated = loadTs('src/lib/mobile-api/club-expansion.ts', {
    '@/lib/prisma': fakePrisma,
  });
  const list = await isolated.listMobileTeamPosts('author', 'team-1', 1, 20);
  const detail = await isolated.getMobileTeamPost('author', 'team-1', 'post-1');
  const created = await isolated.createMobileTeamPost('author', 'team-1', {
    title: ' 새 글 ', content: ' 본문 ',
  });
  assert.equal(list.items.length, 1);
  assert.equal(list.items[0].imageCount, 2);
  assert.equal(Object.hasOwn(list.items[0], 'authorId'), false);
  assert.equal(detail.canEdit, true);
  assert.equal(Object.hasOwn(detail, 'authorId'), false);
  assert.deepEqual(created, { postId: 'post-new' });
});

test('team profile lets managers configure type-specific season points and rejects invalid dates', async () => {
  let actorRole = 'manager';
  let transactions = 0;
  const fakePrisma = {
    team: {
      findFirst: async () => fakeTeam(actorRole === 'owner' ? 'owner' : 'different-owner'),
    },
    teamSeason: { findFirst: async () => null },
    $transaction: async callback => {
      transactions += 1;
      return callback({
        team: { update: async () => ({}) },
        teamSeason: { updateMany: async () => ({ count: 0 }), create: async () => ({}) },
      });
    },
  };
  const isolated = loadTs('src/lib/mobile-api/club-expansion.ts', {
    '@/lib/prisma': fakePrisma,
  });
  const season = {
    name: '2026 시즌', startDate: '2026-02-01', endDate: '2026-12-31',
    scoringMode: 'PODIUM', points: [5, 3, 1],
  };
  await isolated.updateMobileTeamProfile('manager', 'team-1', {
    seasonRankingEnabled: true,
    season: { ...season, pointTables: { individual: [50, 40], team: [35, 20], event: [50, 40] } },
  });
  actorRole = 'owner';
  await assert.rejects(
    isolated.updateMobileTeamProfile('owner', 'team-1', {
      seasonRankingEnabled: true,
      season: { ...season, startDate: '2026-02-30' },
    }),
    error => error.code === 'INVALID_SETTINGS',
  );
  assert.equal(transactions, 1);
});

test('season ranking reads active publication ledger in one batch and supports feature gating', async () => {
  let enabled = false;
  let entryWhere = null;
  let entryCalls = 0;
  const season = {
    id: 'season-1', teamId: 'team-1', name: '반기', enabled: true, status: 'ACTIVE',
    startDate: new Date('2026-01-01T00:00:00+09:00'),
    endDate: new Date('2026-06-30T23:59:59.999+09:00'),
    scoringMode: 'PODIUM', pointsConfig: '[5,3,1]',
    individualPointsConfig: '{"1":50}', teamPointsConfig: '{"1":35}', eventPointsConfig: '{"1":50}',
  };
  const fakePrisma = {
    team: { findFirst: async () => ({ ...fakeTeam(), bowlerHiddenEnabled: true, seasonRankingEnabled: enabled }) },
    teamSeason: {
      findMany: async () => [season],
    },
    seasonPointEntry: {
      findMany: async args => {
        entryCalls += 1; entryWhere = args.where;
        return [{
          id: 'entry-1', publicationId: 'pub-1', eventId: 'event-1', memberId: 'member-owner',
          memberDisplayName: '팀장', competitionType: 'TEAM',
          competitionDate: new Date('2026-02-10T03:00:00.000Z'), competitionTitle: '2월 팀전',
          finalRank: 1, points: 35, createdAt: new Date('2026-02-10T04:00:00.000Z'),
        }];
      },
    },
  };
  const isolated = loadTs('src/lib/mobile-api/club-expansion.ts', {
    '@/lib/prisma': fakePrisma,
  });
  const disabled = await isolated.getMobileSeasonRanking('owner', 'team-1');
  assert.equal(disabled.enabled, false);
  assert.equal(entryCalls, 0);
  enabled = true;
  const result = await isolated.getMobileSeasonRanking('owner', 'team-1');
  assert.equal(result.enabled, true);
  assert.equal(result.season.name, '반기');
  assert.equal(entryWhere.seasonId, 'season-1');
  assert.deepEqual(entryWhere.publication, { revokedAt: null });
  assert.equal(result.rankings.find(row => row.id === 'member-owner').points, 35);
  assert.equal(result.rankings.find(row => row.id === 'member-owner').teamPoints, 35);
  assert.equal(result.rankings.find(row => row.id === 'member-owner').monthlyHistory[1].length, 1);
  assert.equal(entryCalls, 1);
});

function fakeTeam(ownerId = 'owner') {
  return {
    id: 'team-1', name: '팀', ownerId, description: null, notice: null,
    seasonRankingEnabled: false,
    bowlerHiddenEnabled: true,
    User: [{ id: 'manager' }],
    members: [
      {
        id: 'member-owner', userId: 'owner', alias: null,
        joinedAt: new Date('2025-01-01T00:00:00.000Z'),
        user: { name: '팀장', handicap: null },
      },
      {
        id: 'member-manager', userId: 'manager', alias: '매니저',
        joinedAt: new Date('2025-01-02T00:00:00.000Z'),
        user: { name: '관리자', handicap: 10 },
      },
      {
        id: 'member-author', userId: 'author', alias: null,
        joinedAt: new Date('2025-01-03T00:00:00.000Z'),
        user: { name: '작성자', handicap: null },
      },
      {
        id: 'member-member', userId: 'member', alias: null,
        joinedAt: new Date('2025-01-04T00:00:00.000Z'),
        user: { name: '회원', handicap: null },
      },
    ],
  };
}
