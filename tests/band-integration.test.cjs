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
  new Function('require', 'module', 'exports', '__filename', '__dirname', output)(
    localRequire,
    module,
    module.exports,
    filename,
    path.dirname(filename),
  );
  return module.exports;
}

const content = loadTs('src/lib/band/content.ts');
const policy = loadTs('src/lib/band/policy.ts');

test('참가자 명단 템플릿은 대회명·회차·팀·대기 상태를 표시한다', () => {
  const result = content.buildParticipantListPost({
    tournamentName: '가을 챔프전',
    roundNumber: 2,
    participants: [
      { name: '홍길동', team: 'A팀' },
      { name: '김볼링', team: 'B팀', waitlisted: true },
    ],
    detailUrl: 'https://www.bowlingmanager.co.kr/round',
  });
  assert.match(result, /가을 챔프전 · 2회차/);
  assert.match(result, /홍길동 · A팀/);
  assert.match(result, /김볼링 · B팀 · 대기/);
  assert.match(result, /https:\/\/www\.bowlingmanager\.co\.kr\/round/);
});

test('레인 배정 템플릿은 팀·이름·레인을 현재 순서대로 표시한다', () => {
  const result = content.buildLaneAssignmentPost({
    tournamentName: '이벤트전',
    roundNumber: 1,
    entries: [
      { name: '가나다', team: '테스트팀', lane: '2-1' },
      { name: '라마바', team: '개인', lane: '2-2' },
    ],
    detailUrl: 'https://www.bowlingmanager.co.kr/lanes',
  });
  assert.ok(result.indexOf('가나다') < result.indexOf('라마바'));
  assert.match(result, /가나다 · 테스트팀 · 2-1/);
  assert.match(result, /라마바 · 개인 · 2-2/);
});

test('최종 결과 템플릿은 전달된 결과 순서를 그대로 유지한다', () => {
  const result = content.buildFinalResultPost({
    title: '2회차 최종 결과',
    tournamentName: '챔프전',
    roundNumber: 2,
    participantCount: 4,
    detailUrl: 'https://www.bowlingmanager.co.kr/results',
    results: [
      { name: 'A', team: '가팀', total: 900 },
      { name: 'B', team: '나팀', total: 800 },
      { name: 'C', team: '다팀', total: 750 },
      { name: 'D', team: '라팀', total: 700 },
    ],
  });
  assert.ok(result.indexOf('A') < result.indexOf('B'));
  assert.ok(result.indexOf('B') < result.indexOf('C'));
  assert.ok(result.indexOf('C') < result.indexOf('D'));
});

test('상주리그 주차 결과 템플릿은 네 가지 요구 섹션을 모두 포함한다', () => {
  const result = content.buildLeagueWeeklyResultPost({
    tournamentName: '상주리그',
    iteration: 1,
    roundNumber: 4,
    teamStandings: [{ name: 'A팀', wins: 10, totalPinfall: 5000 }],
    individualStandings: [{ name: '홍길동', teamName: 'A팀', rank: 1, average: 210.5, totalPins: 1895 }],
    matchResults: [{ teamA: 'A팀', teamB: 'B팀', pointsA: 3, pointsB: 1 }],
    averageTop: [{ name: '홍길동', teamName: 'A팀', average: 210.5 }],
    detailUrl: 'https://www.bowlingmanager.co.kr/league',
  });
  assert.match(result, /1차 · 4주차 경기 결과/);
  assert.match(result, /팀 순위/);
  assert.match(result, /개인 순위/);
  assert.match(result, /4주차 경기 결과/);
  assert.match(result, /개인 에버 TOP/);
  assert.match(result, /A팀 3 : 1 B팀/);
  assert.match(result, /A팀 · 1위 홍길동/);
});

test('게시 revision 키는 대회·회차·게시유형을 분리한다', () => {
  assert.equal(
    policy.bandPostDedupeKey('t1', 'r1', 'PARTICIPANTS', 1),
    'ROUND:r1:PARTICIPANTS:1',
  );
  assert.equal(
    policy.bandPostDedupeKey('t1', 'r1', 'LEAGUE_WEEKLY_RESULT', 2),
    'ROUND:r1:LEAGUE_WEEKLY_RESULT:2',
  );
  assert.equal(policy.nextBandPostRevision(null), 1);
  assert.equal(policy.nextBandPostRevision(2), 3);
});

test('토큰은 AES-GCM으로 왕복되고 변조되면 거부된다', () => {
  process.env.BAND_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
  const crypto = loadTs('src/lib/band/token-crypto.ts');
  const encrypted = crypto.encryptBandToken('secret-access-token');
  assert.notEqual(encrypted, 'secret-access-token');
  assert.equal(crypto.decryptBandToken(encrypted), 'secret-access-token');

  const parts = encrypted.split('.');
  const ciphertext = Buffer.from(parts[3], 'base64url');
  ciphertext[0] ^= 0x01;
  parts[3] = ciphertext.toString('base64url');
  assert.throws(() => crypto.decryptBandToken(parts.join('.')));
});

test('posting 권한 API 요청과 권한 없는 결과를 구분할 수 있다', async () => {
  const originalFetch = global.fetch;
  global.fetch = async url => {
    assert.match(String(url), /permissions=posting/);
    return new Response(JSON.stringify({ result_code: 1, result_data: { permissions: [] } }), { status: 200 });
  };
  try {
    const client = loadTs('src/lib/band/client.ts');
    assert.deepEqual(await client.getPermissions('token', 'band'), []);
  } finally {
    global.fetch = originalFetch;
  }
});

test('OAuth pending context는 서명 쿠키, nonce, 10분 만료와 callback 사용자 검증을 적용한다', () => {
  const authSource = fs.readFileSync('src/lib/band/auth.ts', 'utf8');
  const connectSource = fs.readFileSync('src/app/api/integrations/band/connect/route.ts', 'utf8');
  const callbackSource = fs.readFileSync('src/app/api/integrations/band/callback/route.ts', 'utf8');

  assert.match(authSource, /SignJWT/);
  assert.match(authSource, /nonce: randomUUID\(\)/);
  assert.match(authSource, /setExpirationTime\('10m'\)/);
  assert.match(connectSource, /createBandOAuthState/);
  assert.match(connectSource, /httpOnly:\s*true/);
  assert.match(connectSource, /sameSite:\s*'lax'/);
  assert.match(callbackSource, /stateData\.userId !== session\.user\.id/);
  assert.match(callbackSource, /verifyCenterAdmin\(stateData\.centerId\)/);
});

test('센터 소유자와 매니저만 공통 관리 권한을 통과한다', async () => {
  const ownerAuth = loadTs('src/lib/auth-utils.ts', {
    '@/auth': { auth: async () => ({ user: { id: 'owner' } }) },
    '@/lib/prisma': {
      __esModule: true,
      default: { bowlingCenter: { findUnique: async () => ({ ownerId: 'owner', managers: [] }) } },
    },
  });
  assert.equal(await ownerAuth.verifyCenterAdmin('center-a'), 'owner');

  const outsiderAuth = loadTs('src/lib/auth-utils.ts', {
    '@/auth': { auth: async () => ({ user: { id: 'outsider' } }) },
    '@/lib/prisma': {
      __esModule: true,
      default: { bowlingCenter: { findUnique: async () => ({ ownerId: 'owner', managers: [{ id: 'manager' }] }) } },
    },
  });
  await assert.rejects(() => outsiderAuth.verifyCenterAdmin('center-a'), /관리 권한/);
});

test('토큰과 client secret은 클라이언트 컴포넌트로 전달되지 않는다', () => {
  const settings = fs.readFileSync('src/components/centers/BandIntegrationSettings.tsx', 'utf8');
  const share = fs.readFileSync('src/components/tournaments/BandShareButton.tsx', 'utf8');
  assert.doesNotMatch(settings, /accessToken|refreshToken|CLIENT_SECRET/);
  assert.doesNotMatch(share, /accessToken|refreshToken|CLIENT_SECRET/);
});

test('BAND OAuth token 교환은 code와 grant_type을 사용한다', () => {
  const source = fs.readFileSync('src/lib/band/auth.ts', 'utf8');
  const exchangeStart = source.indexOf('export async function exchangeBandAuthorizationCode');
  const exchangeSource = source.slice(exchangeStart);
  assert.match(exchangeSource, /grant_type/);
  assert.match(exchangeSource, /authorization_code/);
  assert.match(exchangeSource, /url\.searchParams\.set\('code', code\)/);
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

test('대회 상태 변경 액션은 BAND 자동 게시를 호출하지 않는다', () => {
  const source = fs.readFileSync('src/app/actions/tournament-center.ts', 'utf8');
  assert.doesNotMatch(source, /band\/publisher|publishTournamentRecruitment|publishTournamentFinalResult/);
});

test('BAND 설정 화면은 자동 게시 대신 운영 화면 수동 공유를 안내한다', () => {
  const source = fs.readFileSync('src/components/centers/BandIntegrationSettings.tsx', 'utf8');
  assert.match(source, /\[BAND에 공유\]/);
  assert.doesNotMatch(source, /모집 공개 시 자동 게시|대회 종료 시 최종 결과 자동 게시/);
});

test('공유 버튼은 미리보기 후 previewContent를 포함해 게시한다', () => {
  const source = fs.readFileSync('src/components/tournaments/BandShareButton.tsx', 'utf8');
  const previewIndex = source.indexOf('previewBandPostAction');
  const publishIndex = source.indexOf('publishBandPostAction');
  assert.ok(previewIndex >= 0);
  assert.ok(publishIndex >= 0);
  assert.match(source, /previewContent:\s*preview\.content/);
});

test('미리보기 이후 DB 내용이 바뀌면 게시를 차단한다', () => {
  const source = fs.readFileSync('src/app/actions/band-actions.ts', 'utf8');
  assert.match(source, /latestPreview\.content !== input\.previewContent/);
  assert.match(source, /최신 미리보기를 다시 확인/);
});

test('게시 본문은 기존 상주리그·챔프전 결과 함수를 재사용한다', () => {
  const source = fs.readFileSync('src/lib/band/publisher.ts', 'utf8');
  assert.match(source, /getLeagueLeaderboard/);
  assert.match(source, /getIndividualLeaderboard/);
  assert.match(source, /getChampRoundResults/);
});

test('운영 회차 화면에 종목별 BAND 공유 버튼이 연결된다', () => {
  const source = fs.readFileSync('src/components/tournaments/RoundDetailPageContent.tsx', 'utf8');
  assert.match(source, /type="PARTICIPANTS"/);
  assert.match(source, /type="LANE_ASSIGNMENT"/);
  assert.match(source, /type="LEAGUE_WEEKLY_RESULT"/);
  assert.match(source, /type="FINAL_RESULT"/);
});

test('BAND 연결 사용자 삭제 시 연결 레코드는 cascade 처리된다', () => {
  const schema = fs.readFileSync('prisma/schema.prisma', 'utf8');
  const migration = fs.readFileSync('prisma/migrations/20261007120000_add_band_integration/migration.sql', 'utf8');
  assert.match(schema, /BandConnectionUser.*onDelete: Cascade/);
  assert.match(migration, /BandConnection_connectedByUserId_fkey.*ON DELETE CASCADE/);
});
