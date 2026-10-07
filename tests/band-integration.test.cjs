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
  assert.notEqual(encrypted, 'secret-access-token'); assert.equal(crypto.decryptBandToken(encrypted), 'secret-access-token');
  assert.throws(() => crypto.decryptBandToken(`${encrypted.slice(0, -1)}A`));
});

test('posting 권한 API 요청과 권한 없는 결과를 구분할 수 있다', async () => {
  const originalFetch = global.fetch;
  global.fetch = async url => { assert.match(String(url), /permissions=posting/); return new Response(JSON.stringify({ result_code: 1, result_data: { permissions: [] } }), { status: 200 }); };
  try { const client = loadTs('src/lib/band/client.ts'); assert.deepEqual(await client.getPermissions('token', 'band'), []); }
  finally { global.fetch = originalFetch; }
});

test('OAuth state는 서명, nonce, 10분 만료와 callback 사용자 검증을 적용한다', () => {
  const authSource = fs.readFileSync('src/lib/band/auth.ts', 'utf8');
  const callbackSource = fs.readFileSync('src/app/api/integrations/band/callback/route.ts', 'utf8');
  assert.match(authSource, /SignJWT/); assert.match(authSource, /nonce: randomUUID\(\)/); assert.match(authSource, /setExpirationTime\('10m'\)/);
  assert.match(callbackSource, /stateData\.userId !== session\.user\.id/); assert.match(callbackSource, /verifyCenterAdmin\(stateData\.centerId\)/);
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
