const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function loadTs(relativePath, mocks = {}) {
    const filename = path.join(process.cwd(), relativePath);
    const transpiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    const module = { exports: {} };
    const localRequire = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
    new Function('require', 'module', 'exports', transpiled)(localRequire, module, module.exports);
    return module.exports;
}

test('본문 제한은 내부 안전값이며 한글을 UTF-8 바이트로 측정한다', () => {
    const guard = loadTs('src/lib/band/content-guard.ts');
    assert.equal(guard.bandPostContentSize('가'), 3);
    assert.equal(guard.bandPostContentIssue('가'.repeat(100)), null);
    assert.match(guard.bandPostContentIssue('가'.repeat(6000)), /내부 안전 기준/);
    assert.match(guard.bandPostContentIssue('    '), /비어 있습니다/);
    assert.equal(guard.BAND_POST_MAX_UTF8_BYTES, 16000);
});

test('미리보기 서명은 사용자·본문에 귀속되고 15분 후 만료된다', () => {
    process.env.AUTH_SECRET = 'band-operational-qa-secret-longer-than-32-bytes';
    const signer = loadTs('src/lib/band/preview-signature.ts');
    const issuedAt = 1791500000000;
    const token = signer.createBandPreviewApproval('original', 'admin-1', issuedAt);
    assert.match(token, /^\d{13}\.[a-f0-9]{64}$/);
    assert.equal(signer.verifyBandPreviewApproval(token, 'original', 'admin-1', issuedAt + 1000), true);
    assert.equal(signer.verifyBandPreviewApproval(token, 'modified', 'admin-1', issuedAt + 1000), false);
    assert.equal(signer.verifyBandPreviewApproval(token, 'original', 'admin-2', issuedAt + 1000), false);
    assert.equal(signer.verifyBandPreviewApproval(token, 'original', 'admin-1', issuedAt + 900001), false);
    assert.equal(signer.verifyBandPreviewApproval(token, 'original', 'admin-1', issuedAt - 1), false);
    assert.equal(signer.verifyBandPreviewApproval('fake', 'original', 'admin-1', issuedAt), false);
});

test('BAND 연결 시 자동 게시 기본값은 비활성화되며 푸시도 꺼져 있다', () => {
    const schema = fs.readFileSync('prisma/schema.prisma', 'utf8');
    const migration = fs.readFileSync('prisma/migrations/20261007120000_add_band_integration/migration.sql', 'utf8');
    const callback = fs.readFileSync('src/app/api/integrations/band/callback/route.ts', 'utf8');
    const settings = fs.readFileSync('src/components/centers/BandIntegrationSettings.tsx', 'utf8');
    assert.match(schema, /autoRecruitment\s+Boolean\s+@default\(false\)/);
    assert.match(schema, /autoFinalResult\s+Boolean\s+@default\(false\)/);
    assert.match(migration, /"autoRecruitment" BOOLEAN NOT NULL DEFAULT false/);
    assert.match(migration, /"autoFinalResult" BOOLEAN NOT NULL DEFAULT false/);
    assert.match(callback, /autoRecruitment: false/);
    assert.match(callback, /autoFinalResult: false/);
    assert.match(callback, /doPush: false/);
    assert.match(settings, /autoRecruitment: connection\?\.autoRecruitment \?\? false/);
    assert.match(settings, /autoFinalResult: connection\?\.autoFinalResult \?\? false/);
    assert.match(settings, /실제 테스트 게시글이 올라갑니다/);
});

test('상주리그 상태 변경은 일반 모집·최종 결과 자동 게시를 발생시키지 않는다', async () => {
    let published = 0;
    const prisma = { tournament: {
        findUnique: async () => ({ centerId: 'center-1', status: 'PLANNING', type: 'LEAGUE' }),
        update: async () => undefined,
    }};
    const actions = loadTs('src/app/actions/tournament-center.ts', {
        '@/lib/prisma': { __esModule: true, default: prisma },
        'next/cache': { revalidatePath() {} },
        'next/navigation': { redirect() {} },
        '@/lib/tournament-utils': { parseKSTDate() {} },
        '@/lib/auth-utils': { verifyCenterAdmin: async () => 'admin-1' },
        '@/lib/band/publisher': {
            publishTournamentRecruitment: async () => { published++; return { status: 'SUCCESS' }; },
            publishTournamentFinalResult: async () => { published++; return { status: 'SUCCESS' }; },
        },
    });
    await actions.updateTournamentStatus('league', 'OPEN');
    assert.equal(published, 0);
});

function resolveFixture(options = {}) {
    const data = {
        id: 'post-1', centerId: options.centerId || 'center-1',
        tournamentId: 't-1', roundId: 'r-1', type: 'LEAGUE_WEEKLY_RESULT',
        revision: 1, status: options.status || 'UNKNOWN',
        createdAt: options.createdAt || new Date(Date.now() - 40 * 60 * 1000),
    };
    let updated = null;
    const db = {
        bandPost: {
            findUnique: async () => data,
            findFirst: async () => ({ id: options.latestId || 'post-1' }),
            updateMany: async ({ where, data: patch }) => {
                if (where.status !== data.status) return { count: 0 };
                updated = patch;
                return { count: 1 };
            },
        },
    };
    const cacheCalls = [];
    const actions = loadTs('src/app/actions/band-actions.ts', {
        '@/lib/prisma': { __esModule: true, default: db },
        'next/cache': { revalidatePath: p => cacheCalls.push(p) },
        '@/lib/auth-utils': { verifyCenterAdmin: async centerId => {
            if (centerId !== 'center-1') throw new Error('관리 권한 없음');
            return 'admin-1';
        }},
        '@/lib/band/config': loadTs('src/lib/band/config.ts'),
        '@/lib/band/client': { getBands() {}, getPermissions() {}, bandErrorMessage() {} },
        '@/lib/band/token-crypto': { decryptBandToken() {} },
        '@/lib/band/publisher': { republishBandPost() {}, sendBandTestPost() {} },
    });
    return { actions, data, cacheCalls, getUpdated: () => updated };
}

test('확인되지 않은 BAND 게시 이력은 관리자 직접 확인 없이는 변경되지 않는다', async () => {
    const { actions, getUpdated } = resolveFixture();
    const base = { centerId: 'center-1', postId: 'post-1', resolution: 'POSTED' };
    const blocked = await actions.resolveUncertainBandPostAction({ ...base, confirmed: false });
    assert.equal(blocked.success, false);
    assert.equal(getUpdated(), null);
});

test('BAND 게시됨 확인은 감사 정보를 기록하고 게시 성공으로 고정한다', async () => {
    const { actions, cacheCalls, getUpdated } = resolveFixture();
    const result = await actions.resolveUncertainBandPostAction({
        centerId: 'center-1', postId: 'post-1', resolution: 'POSTED', confirmed: true,
    });
    assert.equal(result.success, true);
    assert.equal(getUpdated().status, 'SUCCESS');
    assert.equal(getUpdated().errorCode, 'MANUAL_VERIFIED_POSTED');
    assert.match(getUpdated().errorMessage, /admin-1/);
    assert.equal(cacheCalls.length, 2);
});

test('미게시 확인은 FAILED 처리해 새 미리보기와 재게시를 허용한다', async () => {
    const { actions, getUpdated } = resolveFixture();
    const result = await actions.resolveUncertainBandPostAction({
        centerId: 'center-1', postId: 'post-1', resolution: 'NOT_POSTED', confirmed: true,
    });
    assert.equal(result.success, true);
    assert.equal(getUpdated().status, 'FAILED');
    assert.equal(getUpdated().errorCode, 'MANUAL_VERIFIED_ABSENT');
});

test('최근 PENDING, 이전 이력 및 다른 센터 게시물은 복구할 수 없다', async () => {
    for (const options of [
        { status: 'PENDING', createdAt: new Date() },
        { latestId: 'post-newer' },
        { centerId: 'other-center' },
    ]) {
        const { actions, getUpdated } = resolveFixture(options);
        const result = await actions.resolveUncertainBandPostAction({
            centerId: 'center-1', postId: 'post-1', resolution: 'NOT_POSTED', confirmed: true,
        });
        assert.equal(result.success, false);
        assert.equal(getUpdated(), null);
    }
});

test('BAND 미리보기와 게시 서버 액션은 권한 없는 호출 및 다른 센터 대회를 거부한다', async () => {
    let published = 0;
    let queried = 0;
    const prisma = { tournament: {
        findUnique: async () => { queried++; return { centerId: 'center-2' }; },
    }};
    const publisher = {
        republishBandPost: async () => { published++; return { status: 'SUCCESS', preview: {} }; },
        sendBandTestPost: async () => undefined,
    };
    const actionMocks = {
        '@/lib/prisma': { __esModule: true, default: prisma },
        'next/cache': { revalidatePath() {} },
        '@/lib/auth-utils': { verifyCenterAdmin: async centerId => {
            if (centerId === 'center-denied') throw new Error('관리 권한 없음');
            return 'admin-1';
        }},
        '@/lib/band/client': { getBands() {}, getPermissions() {}, bandErrorMessage() {} },
        '@/lib/band/token-crypto': { decryptBandToken() {} },
        '@/lib/band/config': loadTs('src/lib/band/config.ts'),
        '@/lib/band/publisher': publisher,
    };
    const actions = loadTs('src/app/actions/band-actions.ts', actionMocks);
    await assert.rejects(actions.getBandPostPreviewAction({
        centerId: 'center-denied', tournamentId: 't1', type: 'RECRUITMENT',
    }), /관리 권한 없음/);
    assert.equal(queried, 0);

    const differentCenter = await actions.getBandPostPreviewAction({
        centerId: 'center-1', tournamentId: 't1', type: 'RECRUITMENT',
    });
    assert.equal(differentCenter.success, false);
    assert.equal(published, 0);
});
