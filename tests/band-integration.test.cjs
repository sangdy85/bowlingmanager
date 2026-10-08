const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function loadTs(relativePath, mocks = {}) {
  const filename = path.join(process.cwd(), relativePath);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  const localRequire = id => Object.prototype.hasOwnProperty.call(mocks, id) ? mocks[id] : require(id);
  new Function('require', 'module', 'exports', '__filename', '__dirname', output)(localRequire, module, module.exports, filename, path.dirname(filename));
  return module.exports;
}

const content = loadTs('src/lib/band/content.ts');
const policy = loadTs('src/lib/band/policy.ts');

test('모집글 템플릿은 대회 데이터와 상세 URL을 포함한다', () => {
  const result = content.buildRecruitmentPost({ title: '대회 참가자 모집', tournamentName: '가을 대회', centerName: '테스트 볼링장', participantCount: 3, maxParticipants: 20, detailUrl: 'https://www.bowlingmanager.co.kr/test' });
  assert.match(result, /가을 대회/); assert.match(result, /현재 3명 \/ 정원 20명/); assert.match(result, /https:\/\/www\./);
});

test('결과글 템플릿은 기존 결과 순위를 유지하며 Top 3만 만든다', () => {
  const result = content.buildFinalResultPost({ title: '최종 결과', tournamentName: '대회', participantCount: 4, detailUrl: 'https://www.bowlingmanager.co.kr/results', results: [
    { name: 'A', total: 900 }, { name: 'B', total: 800 }, { name: 'C', total: 750 }, { name: 'D', total: 700 },
  ] });
  assert.ok(result.indexOf('A') < result.indexOf('B')); assert.ok(result.indexOf('B') < result.indexOf('C')); assert.doesNotMatch(result, /D/);
});

test('없는 선택 항목은 모집글에서 생략한다', () => {
  const result = content.buildRecruitmentPost({ title: '모집', tournamentName: '대회', centerName: '', participantCount: 0, detailUrl: 'https://www.bowlingmanager.co.kr/x' });
  assert.doesNotMatch(result, /장소|경기일|경기 방식|참가비|미정/);
});

test('중복 키는 대상과 타입 및 revision을 고정적으로 결합한다', () => {
  assert.equal(policy.bandPostDedupeKey('t1', null, 'RECRUITMENT', 1), 'TOURNAMENT:t1:RECRUITMENT:1');
  assert.equal(policy.bandPostDedupeKey('t1', 'r1', 'FINAL_RESULT', 2), 'ROUND:r1:FINAL_RESULT:2');
});

test('재게시 revision은 이전 값보다 1 증가한다', () => {
  assert.equal(policy.nextBandPostRevision(null), 1); assert.equal(policy.nextBandPostRevision(2), 3);
});

test('연결 없는 센터는 publish skip이다', () => assert.match(policy.bandAutoPublishSkipReason(null, 'RECRUITMENT'), /연결된 BAND/));
test('autoRecruitment=false이면 skip이다', () => assert.match(policy.bandAutoPublishSkipReason({ enabled: true, bandKey: 'b', autoRecruitment: false, autoFinalResult: true }, 'RECRUITMENT'), /꺼져/));
test('autoFinalResult=false이면 skip이다', () => assert.match(policy.bandAutoPublishSkipReason({ enabled: true, bandKey: 'b', autoRecruitment: true, autoFinalResult: false }, 'FINAL_RESULT'), /꺼져/));

test('토큰은 AES-GCM으로 왕복되고 변조되면 거부된다', () => {
  process.env.BAND_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
  const crypto = loadTs('src/lib/band/token-crypto.ts');
  const encrypted = crypto.encryptBandToken('secret-access-token');

  assert.notEqual(encrypted, 'secret-access-token');
  assert.equal(crypto.decryptBandToken(encrypted), 'secret-access-token');

  const parts = encrypted.split('.');
  assert.equal(parts.length, 4);

  const ciphertext = Buffer.from(parts[3], 'base64url');
  ciphertext[0] ^= 0x01;
  parts[3] = ciphertext.toString('base64url');

  assert.throws(() => crypto.decryptBandToken(parts.join('.')));
});

test('posting 권한 API 요청과 권한 없는 결과를 구분할 수 있다', async () => {
  const originalFetch = global.fetch;
  global.fetch = async url => { assert.match(String(url), /permissions=posting/); return new Response(JSON.stringify({ result_code: 1, result_data: { permissions: [] } }), { status: 200 }); };
  try { const client = loadTs('src/lib/band/client.ts'); assert.deepEqual(await client.getPermissions('token', 'band'), []); }
  finally { global.fetch = originalFetch; }
});

test('OAuth pending context는 서명 쿠키, nonce, 10분 만료와 callback 사용자 검증을 적용한다', () => {
  const authSource = fs.readFileSync('src/lib/band/auth.ts', 'utf8');
  const connectSource = fs.readFileSync('src/app/api/integrations/band/connect/route.ts', 'utf8');
  const callbackSource = fs.readFileSync('src/app/api/integrations/band/callback/route.ts', 'utf8');

  assert.match(authSource, /SignJWT/);
  assert.match(authSource, /nonce: randomUUID\(\)/);
  assert.match(authSource, /setExpirationTime\('10m'\)/);
  assert.doesNotMatch(authSource, /searchParams\.set\('state'/);

  assert.match(connectSource, /createBandOAuthState/);
  assert.match(connectSource, /response\.cookies\.set\(COOKIE_NAME/);
  assert.match(connectSource, /httpOnly:\s*true/);
  assert.match(connectSource, /sameSite:\s*'lax'/);
  assert.match(connectSource, /secure:\s*process\.env\.NODE_ENV === 'production'/);

  assert.match(callbackSource, /request\.cookies\.get\(COOKIE_NAME\)/);
  assert.match(callbackSource, /stateData\.userId !== session\.user\.id/);
  assert.match(callbackSource, /verifyCenterAdmin\(stateData\.centerId\)/);
  assert.doesNotMatch(callbackSource, /searchParams\.get\('state'\)/);
});

test('다른 센터 관리자가 아니면 공통 권한 검사가 차단한다', async () => {
  const authUtils = loadTs('src/lib/auth-utils.ts', {
    '@/auth': { auth: async () => ({ user: { id: 'outsider' } }) },
    '@/lib/prisma': { __esModule: true, default: { bowlingCenter: { findUnique: async () => ({ ownerId: 'owner', managers: [{ id: 'manager' }] }) } } },
  });
  await assert.rejects(() => authUtils.verifyCenterAdmin('center-a'), /관리 권한/);
});

test('BAND API 실패여도 Tournament 상태 변경은 성공한 채 유지된다', async () => {
  let updated = false;
  const prisma = { tournament: {
    findUnique: async () => ({ centerId: 'c1', status: 'PLANNING' }),
    update: async () => { updated = true; },
  } };
  const actions = loadTs('src/app/actions/tournament-center.ts', {
    '@/lib/prisma': { __esModule: true, default: prisma },
    'next/cache': { revalidatePath() {} },
    'next/navigation': { redirect() {} },
    '@/lib/tournament-utils': { parseKSTDate() {} },
    '@/lib/auth-utils': { verifyCenterAdmin: async () => 'manager' },
    '@/lib/band/publisher': { publishTournamentRecruitment: async () => { throw new Error('BAND down'); }, publishTournamentFinalResult: async () => { throw new Error('BAND down'); } },
  });
  const result = await actions.updateTournamentStatus('t1', 'OPEN');
  assert.equal(updated, true); assert.equal(result.success, true); assert.equal(result.band.status, 'FAILED');
});

test('명시적으로 OPEN된 리그 대회는 기존 참가 신청 흐름을 유지한다', () => {
  const source = fs.readFileSync('src/app/actions/tournament-reg.ts', 'utf8');
  assert.match(source, /tournament\.status === 'OPEN'/);
});

test('토큰과 client secret은 클라이언트 컴포넌트로 전달되지 않는다', () => {
  const ui = fs.readFileSync('src/components/centers/BandIntegrationSettings.tsx', 'utf8');
  assert.doesNotMatch(ui, /accessToken|refreshToken|CLIENT_SECRET/);
});


test('BAND OAuth token 교환은 공식 문서의 code와 grant_type만 전송한다', () => {
  const source = fs.readFileSync('src/lib/band/auth.ts', 'utf8');
  const exchangeStart = source.indexOf('export async function exchangeBandAuthorizationCode');
  const exchangeSource = source.slice(exchangeStart);

  assert.match(exchangeSource, /grant_type/);
  assert.match(exchangeSource, /authorization_code/);
  assert.match(exchangeSource, /url\.searchParams\.set\('code', code\)/);
  assert.doesNotMatch(exchangeSource, /url\.searchParams\.set\('redirect_uri'/);
});

test('실제 BAND 게시 직전에 posting 권한을 다시 검사한다', () => {
  const source = fs.readFileSync('src/lib/band/publisher.ts', 'utf8');
  const permissionIndex = source.indexOf('getPermissions(accessToken, connection.bandKey)');
  const createIndex = source.indexOf('createPost({');

  assert.ok(permissionIndex >= 0);
  assert.ok(createIndex >= 0);
  assert.ok(permissionIndex < createIndex);
  assert.match(source, /permissions\.includes\('posting'\)/);
});

test('모집 자동 게시 trigger는 PLANNING에서 OPEN 또는 JOINING으로 갈 때만 동작한다', () => {
  const source = fs.readFileSync('src/app/actions/tournament-center.ts', 'utf8');
  assert.match(
    source,
    /tournament\.status === 'PLANNING' && \['OPEN', 'JOINING'\]\.includes\(status\)/,
  );
  assert.match(
    source,
    /publishTournamentRecruitment\(\{ tournamentId, requestedById: actorId \}\)/,
  );
});


test('수동 재게시에서는 자동 게시 설정이 꺼져 있어도 연결된 BAND로 게시할 수 있다', () => {
  const source = fs.readFileSync('src/lib/band/publisher.ts', 'utf8');
  assert.match(
    source,
    /if \(!input\.forceRevision\) \{\s*const skipReason = bandAutoPublishSkipReason/,
  );
  assert.match(
    source,
    /if \(!connection\?\.enabled \|\| !connection\.bandKey\)/,
  );
});


test('참가자 명단 템플릿은 대기자를 표시하고 순서를 유지한다', () => {
  const result = content.buildParticipantPost({
    title: '2회차 참가자 명단',
    tournamentName: '챔프전',
    roundNumber: 2,
    activeCount: 2,
    waitlistCount: 1,
    detailUrl: 'https://www.bowlingmanager.co.kr/round',
    participants: [
      { name: '홍길동', team: 'A팀' },
      { name: '김철수', team: 'B팀' },
      { name: '이영희', team: 'C팀', waitlisted: true },
    ],
  });
  assert.ok(result.indexOf('홍길동') < result.indexOf('김철수'));
  assert.ok(result.indexOf('김철수') < result.indexOf('이영희'));
  assert.match(result, /참가 2명 · 대기 1명/);
  assert.match(result, /이영희 · C팀 \[대기\]/);
});

test('레인 배정 템플릿은 이름 팀 레인을 함께 표시한다', () => {
  const result = content.buildLaneAssignmentPost({
    title: '2회차 레인 배정',
    tournamentName: '챔프전',
    roundNumber: 2,
    detailUrl: 'https://www.bowlingmanager.co.kr/round',
    entries: [
      { name: '홍길동', team: 'A팀', lane: '2-1' },
      { name: '김철수', team: 'B팀', lane: '2-2' },
    ],
  });
  assert.match(result, /홍길동 · A팀 · 2-1/);
  assert.match(result, /김철수 · B팀 · 2-2/);
});

test('회차 게시 타입도 회차 단위 dedupe key를 사용한다', () => {
  assert.equal(policy.bandPostDedupeKey('t1', 'r1', 'PARTICIPANTS', 1), 'ROUND:r1:PARTICIPANTS:1');
  assert.equal(policy.bandPostDedupeKey('t1', 'r1', 'LANE_ASSIGNMENT', 3), 'ROUND:r1:LANE_ASSIGNMENT:3');
});

test('참가자와 레인 게시 타입은 모집 자동 게시 설정 정책을 사용한다', () => {
  const connection = { enabled: true, bandKey: 'b', autoRecruitment: false, autoFinalResult: true };
  assert.match(policy.bandAutoPublishSkipReason(connection, 'PARTICIPANTS'), /꺼져/);
  assert.match(policy.bandAutoPublishSkipReason(connection, 'LANE_ASSIGNMENT'), /꺼져/);
});

test('회차 BAND 게시 UI는 참가자 명단 레인 배정 최종 결과를 제공한다', () => {
  const source = fs.readFileSync('src/components/tournaments/BandPublishStatus.tsx', 'utf8');
  assert.match(source, /PARTICIPANTS/);
  assert.match(source, /LANE_ASSIGNMENT/);
  assert.match(source, /FINAL_RESULT/);
  assert.match(source, /참가자 명단/);
  assert.match(source, /레인 배정/);
});

test('레인 배정 게시 로직은 실제 참가자 전원 배정을 요구한다', () => {
  const source = fs.readFileSync('src/lib/band/publisher.ts', 'utf8');
  assert.match(source, /실제 참가자 전원의 레인 배정이 완료된 뒤 게시할 수 있습니다/);
  assert.match(source, /formatLane\(participant\.lane\)/);
});

test('회차 BAND 게시 후 회차 페이지도 revalidate한다', () => {
  const source = fs.readFileSync('src/app/actions/band-actions.ts', 'utf8');
  assert.match(source, /if \(input\.roundId\)/);
  assert.match(source, /rounds\/\$\{input\.roundId\}/);
});


test('상주리그 주차 결과 BAND 글에는 필수 결과 구역과 실제 주차가 모두 포함된다', () => {
  const weekly = loadTs('src/lib/band/league-weekly-content.ts');
  const text = weekly.buildLeagueWeeklyPost({
    tournamentName: '제 3회차 상주리그',
    iteration: 3,
    week: 8,
    teams: [
      { name: 'A팀', wins: 20, losses: 4, points: 60, totalPinfall: 12345 },
      { name: 'B팀', wins: 15, losses: 9, points: 45, totalPinfall: 11987 },
    ],
    individualByTeam: [{ teamName: 'A팀', players: [{ name: '홍길동', gamesCount: 6, totalHandicappedPins: 1200 }] }],
    matches: [{
      teamA: 'A팀', teamB: 'B팀', pointsA: 2, pointsB: 1,
      scoresA: [600, 590, 580], scoresB: [570, 575, 580],
    }],
    averageTop: [{ name: '홍길동', teamName: 'A팀', gamesCount: 6, totalHandicappedPins: 1200 }],
    detailUrl: 'https://www.bowlingmanager.co.kr/centers/test/tournaments/league',
  });

  for (const term of ['제 3회차 상주리그', '제 3차 · 8주차', '팀 순위표', '개인 순위표', '8주차 경기 결과', '개인 평균 TOP', '승점 60', '12,345핀', '홍길동', 'AVG 200.0', '600/590/580', 'https://www.bowlingmanager.co.kr/']) {
    assert.ok(text.includes(term), `Missing section/value: ${term}`);
  }
  assert.ok(text.indexOf('팀 순위표') < text.indexOf('개인 순위표'));
  assert.ok(text.indexOf('개인 순위표') < text.indexOf('8주차 경기 결과'));
  assert.ok(text.indexOf('8주차 경기 결과') < text.indexOf('개인 평균 TOP'));
  assert.equal((text.match(/제 3회차 상주리그/g) || []).length, 1);
});

test('상주리그 주차 게시 준비 여부는 모든 매치 완료를 요구한다', () => {
  const { isLeagueWeekReady } = loadTs('src/lib/band/league-weekly-content.ts');
  assert.equal(isLeagueWeekReady([]), false);
  assert.equal(isLeagueWeekReady([{ status: 'FINISHED' }, { status: 'PENDING' }]), false);
  assert.equal(isLeagueWeekReady([{ status: 'FINISHED' }, { status: 'FINISHED' }]), true);
});

test('상주리그 주차별 BAND 게시 이력은 다른 주차와 구분된다', () => {
  assert.equal(policy.bandPostDedupeKey('t1', 'week-1', 'LEAGUE_WEEKLY_RESULT', 1), 'ROUND:week-1:LEAGUE_WEEKLY_RESULT:1');
  assert.equal(policy.bandPostDedupeKey('t1', 'week-2', 'LEAGUE_WEEKLY_RESULT', 1), 'ROUND:week-2:LEAGUE_WEEKLY_RESULT:1');
});

test('상주리그 BAND 버튼은 완료된 주차 관리 화면에만 제공된다', () => {
  const source = fs.readFileSync('src/components/tournaments/LeagueResultManager.tsx', 'utf8');
  const publisher = fs.readFileSync('src/lib/band/publisher.ts', 'utf8');
  assert.ok(source.includes('isManager && finished &&'));
  assert.ok(source.includes('LeagueWeeklyBandButton'));
  assert.ok(publisher.includes('isLeagueWeekReady(round.matchups)'));
  assert.ok(publisher.includes('getLeagueLeaderboard(tournament.id, round.roundNumber)'));
  assert.ok(publisher.includes('getIndividualLeaderboard(tournament.id, round.roundNumber)'));
});

test('Prisma Client 생성은 TypeScript 검사보다 먼저 실행된다', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  assert.ok(pkg.scripts.build.indexOf('prisma generate') < pkg.scripts.build.indexOf('typecheck'));
});


test('과거 주차 평균 TOP은 이후 주차의 결과에 영향받지 않는다', async () => {
  const baseMatch = {
    status: 'FINISHED',
    teamAId: 'team-a', teamBId: 'team-b',
    teamA: { name: 'A팀' }, teamB: { name: 'B팀' },
    teamASquad: null, teamBSquad: null, pointsA: 2, pointsB: 1,
  };
  const tournament = {
    avgTopRankCount: 30,
    avgMinParticipationPct: 100,
    registrations: [],
    leagueRounds: [
      { roundNumber: 1, matchups: [{ ...baseMatch, individualScores: [{
        teamId: 'team-a', teamSquad: null, userId: 'user-a', playerName: '홍길동',
        score1: 200, score2: 200, score3: 200, handicap: 0,
      }] }] },
      { roundNumber: 2, matchups: [{ ...baseMatch, individualScores: [] }] },
    ],
  };
  const leaderboard = loadTs('src/app/actions/league-leaderboard.ts', {
    '@/lib/prisma': { __esModule: true, default: { tournament: { findUnique: async () => tournament } } },
  });
  const week1 = await leaderboard.getIndividualLeaderboard('league', 1);
  assert.equal(week1.metadata.currentRound, 1);
  assert.equal(week1.top30.length, 1);
  assert.equal(week1.top30[0].name, '홍길동');

  const latest = await leaderboard.getIndividualLeaderboard('league');
  assert.equal(latest.metadata.currentRound, 2);
  assert.equal(latest.top30.length, 0);
});
