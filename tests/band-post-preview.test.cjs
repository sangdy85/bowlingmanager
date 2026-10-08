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
    new Function('require', 'module', 'exports', '__filename', '__dirname', transpiled)(
        localRequire, module, module.exports, filename, path.dirname(filename),
    );
    return module.exports;
}

function publisherFixture() {
    process.env.AUTH_SECRET = 'band-preview-local-fixture-secret-at-least-32-bytes';
    const counters = { create: 0, update: 0, permissions: 0, post: 0, decrypt: 0 };
    const flags = { postFails: false, outboundAllowed: true };
    const connection = {
        enabled: true,
        bandKey: 'band-key-1',
        bandName: '볼링장 운영 밴드',
        doPush: false,
        autoRecruitment: true,
        autoFinalResult: true,
        accessTokenEncrypted: 'encrypted-token',
    };
    const tournament = {
        id: 't1',
        centerId: 'center-1',
        name: '가을 챔프전',
        startDate: '2026-10-09T09:00:00.000Z',
        settings: null,
        maxParticipants: 20,
        entryFee: 0,
        center: { name: '테스트 볼링장', address: '주소' },
        registrations: [{ id: 'r1' }],
        leagueRounds: [],
    };
    const history = [];
    const db = {
        bandConnection: { findUnique: async () => connection },
        bandPost: {
            findFirst: async () => history.length ? history[history.length - 1] : null,
            create: async ({ data }) => {
                counters.create++;
                if (history.some(item => item.dedupeKey === data.dedupeKey)) {
                    const error = new Error('Unique constraint violation');
                    error.code = 'P2002';
                    throw error;
                }
                const post = { id: `post-${history.length + 1}`, ...data };
                history.push(post);
                return post;
            },
            update: async ({ where, data }) => {
                counters.update++;
                const record = history.find(item => item.id === where.id);
                Object.assign(record, data);
                return record;
            },
        },
        tournament: { findUnique: async () => tournament },
    };
    const policy = loadTs('src/lib/band/policy.ts');
    const content = loadTs('src/lib/band/content.ts');
    const contentGuard = loadTs('src/lib/band/content-guard.ts');
    const approval = loadTs('src/lib/band/preview-signature.ts');
    const publisher = loadTs('src/lib/band/publisher.ts', {
        '@/lib/prisma': { __esModule: true, default: db },
        '@/lib/public-web': { PUBLIC_ORIGIN: 'https://www.bowlingmanager.co.kr' },
        '@/lib/tournament-utils': { formatLane: lane => String(lane) },
        '@/app/actions/champ-results': { getChampRoundResults: async () => ({ results: [] }) },
        '@/app/actions/league-leaderboard': {
            getLeagueLeaderboard: async () => ({ teamStandings: [] }),
            getIndividualLeaderboard: async () => ({ teams: [], top30: [] }),
        },
        './client': {
            BandApiError: class BandApiError extends Error {},
            bandErrorMessage: error => error.message,
            getPermissions: async () => { counters.permissions++; return ['posting']; },
            createPost: async () => {
                counters.post++;
                if (flags.postFails) throw new Error('network timeout');
                return { postKey: `band-post-${counters.post}` };
            },
        },
        './token-crypto': { decryptBandToken: () => { counters.decrypt++; return 'access-token'; } },
        './league-weekly-content': { buildLeagueWeeklyPost: () => '', isLeagueWeekReady: () => false },
        './content': content,
        './content-guard': contentGuard,
        './outbound-policy': { bandExternalPostingAllowed: () => flags.outboundAllowed, BAND_POSTING_DISABLED_MESSAGE: '외부 BAND 게시가 비활성화된 환경입니다.' },
        './preview-signature': approval,
        './policy': policy,
    });
    return { publisher, connection, tournament, history, counters, flags };
}

test('스테이징 외부 게시 차단은 이력 생성과 토큰 복호화 전에 실행되며 미리보기는 허용된다', async () => {
    const { publisher, flags, counters, history } = publisherFixture();
    flags.outboundAllowed = false;
    const options = { tournamentId: 't1', type: 'RECRUITMENT', requestedById: 'manager-1' };
    const preview = await publisher.republishBandPost({ ...options, previewOnly: true });
    assert.equal(preview.status, 'SUCCESS');
    assert.match(preview.preview.content, /가을 챔프전/);
    const outcome = await publisher.republishBandPost({ ...options, previewToken: preview.preview.previewToken });
    assert.equal(outcome.status, 'SKIPPED');
    assert.match(outcome.message, /비활성화/);
    assert.equal(history.length, 0);
    assert.equal(counters.create, 0);
    assert.equal(counters.decrypt, 0);
    assert.equal(counters.permissions, 0);
    assert.equal(counters.post, 0);
});

test('미리보기는 게시글을 만들지만 DB 작성, 토큰 복호화, BAND 전송은 하지 않는다', async () => {
    const { publisher, counters, history } = publisherFixture();
    const result = await publisher.republishBandPost({ tournamentId: 't1', type: 'RECRUITMENT', previewOnly: true, requestedById: 'manager-1' });

    assert.equal(result.status, 'SUCCESS');
    assert.equal(result.preview.bandName, '볼링장 운영 밴드');
    assert.equal(result.preview.bandKey, 'band-key-1');
    assert.equal(result.preview.nextRevision, 1);
    assert.equal(result.preview.doPush, false);
    assert.match(result.preview.previewToken, /^\d{13}\.[a-f0-9]{64}$/);
    assert.match(result.preview.content, /가을 챔프전/);
    assert.deepEqual(history, []);
    assert.deepEqual(counters, { create: 0, update: 0, permissions: 0, post: 0, decrypt: 0 });
});

test('내부 길이 제한을 초과한 글은 미리보기·자동 게시 모두 전송 전에 차단된다', async () => {
    const { publisher, tournament, counters, history } = publisherFixture();
    tournament.name = '가'.repeat(6000);
    const options = { tournamentId: 't1', type: 'RECRUITMENT', requestedById: 'manager-1' };
    const preview = await publisher.republishBandPost({ ...options, previewOnly: true });
    assert.equal(preview.status, 'SKIPPED');
    assert.match(preview.message, /내부 안전 기준/);
    const automatic = await publisher.publishTournamentRecruitment({ tournamentId: 't1' });
    assert.equal(automatic.status, 'SKIPPED');
    assert.equal(counters.post, 0);
    assert.equal(counters.create, 0);
    assert.equal(history.length, 0);
});

test('확인한 미리보기 내용은 실제 게시 본문과 동일하며 같은 확인으로 재게시할 수 없다', async () => {
    const { publisher, counters, history } = publisherFixture();
    const options = { tournamentId: 't1', type: 'RECRUITMENT', requestedById: 'manager-1' };
    const pre = await publisher.republishBandPost({ ...options, previewOnly: true });
    const sent = await publisher.republishBandPost({ ...options, previewToken: pre.preview.previewToken });

    assert.equal(sent.status, 'SUCCESS');
    assert.equal(history[0].contentSnapshot, pre.preview.content);
    assert.equal(counters.post, 1);
    assert.equal(counters.create, 1);
    assert.equal(counters.permissions, 1);

    const duplicate = await publisher.republishBandPost({ ...options, previewToken: pre.preview.previewToken });
    assert.equal(duplicate.status, 'SKIPPED');
    assert.match(duplicate.message, /다시 미리보기/);
    assert.equal(counters.post, 1);
    assert.equal(counters.create, 1);
});

test('미리보기 후 데이터가 변경되면 게시하지 않는다', async () => {
    const { publisher, tournament, counters } = publisherFixture();
    const options = { tournamentId: 't1', type: 'RECRUITMENT', requestedById: 'manager-1' };
    const pre = await publisher.republishBandPost({ ...options, previewOnly: true });
    tournament.registrations.push({ id: 'r2' });

    const result = await publisher.republishBandPost({ ...options, previewToken: pre.preview.previewToken });
    assert.equal(result.status, 'SKIPPED');
    assert.match(result.message, /변경되었습니다/);
    assert.equal(counters.create, 0);
    assert.equal(counters.post, 0);
});

test('대상 밴드 또는 알림 설정이 변경되면 이전 확인으로는 게시할 수 없다', async () => {
    const { publisher, connection, counters } = publisherFixture();
    const options = { tournamentId: 't1', type: 'RECRUITMENT', requestedById: 'manager-1' };
    const before = await publisher.republishBandPost({ ...options, previewOnly: true });
    connection.bandKey = 'band-key-2';
    const changedBand = await publisher.republishBandPost({ ...options, previewToken: before.preview.previewToken });
    assert.equal(changedBand.status, 'SKIPPED');

    const refreshed = await publisher.republishBandPost({ ...options, previewOnly: true });
    connection.doPush = true;
    const changedPush = await publisher.republishBandPost({ ...options, previewToken: refreshed.preview.previewToken });
    assert.equal(changedPush.status, 'SKIPPED');
    assert.deepEqual([counters.create, counters.post], [0, 0]);
});

test('미리보기 이후 게시 상태가 달라져도 새 확인이 필요하다', async () => {
    const { publisher, history, counters } = publisherFixture();
    const options = { tournamentId: 't1', type: 'RECRUITMENT', requestedById: 'manager-1' };
    history.push({ id: 'existing-1', revision: 1, status: 'FAILED' });
    const pre = await publisher.republishBandPost({ ...options, previewOnly: true });
    history[0].status = 'SUCCESS';

    const result = await publisher.republishBandPost({ ...options, previewToken: pre.preview.previewToken });
    assert.equal(result.status, 'SKIPPED');
    assert.match(result.message, /다시 미리보기/);
    assert.equal(counters.post, 0);
});

test('이전 게시가 PENDING 상태일 때 중복 전송하지 않는다', async () => {
    const { publisher, history, counters } = publisherFixture();
    const options = { tournamentId: 't1', type: 'RECRUITMENT', requestedById: 'manager-1' };
    history.push({ id: 'pending-1', revision: 1, status: 'PENDING', dedupeKey: 'TOURNAMENT:t1:RECRUITMENT:1' });
    const pre = await publisher.republishBandPost({ ...options, previewOnly: true });
    assert.equal(pre.preview.latestStatus, 'PENDING');

    const result = await publisher.republishBandPost({ ...options, previewToken: pre.preview.previewToken });
    assert.equal(result.status, 'SKIPPED');
    assert.match(result.message, /미확인 상태/);
    assert.equal(counters.post, 0);
});

test('전송 중 타임아웃은 실패로 단정하지 않고 미확인 상태로 기록해 중복 게시를 막는다', async () => {
    const { publisher, flags, counters, history } = publisherFixture();
    const options = { tournamentId: 't1', type: 'RECRUITMENT', requestedById: 'manager-1' };
    const pre = await publisher.republishBandPost({ ...options, previewOnly: true });
    flags.postFails = true;

    const outcome = await publisher.republishBandPost({ ...options, previewToken: pre.preview.previewToken });
    assert.equal(outcome.status, 'FAILED');
    assert.match(outcome.message, /게시 결과를 확인할 수 없습니다/);
    assert.equal(history[0].status, 'UNKNOWN');
    assert.equal(history[0].errorCode, 'PUBLISH_UNCONFIRMED');

    const secondPreview = await publisher.republishBandPost({ ...options, previewOnly: true });
    assert.equal(secondPreview.preview.latestStatus, 'UNKNOWN');
    const duplicate = await publisher.republishBandPost({ ...options, previewToken: secondPreview.preview.previewToken });
    assert.equal(duplicate.status, 'SKIPPED');
    assert.equal(counters.post, 1);
});

test('수동 BAND 게시 액션은 관리자 검증 및 미리보기 토큰을 필수로 요구한다', () => {
    const actions = fs.readFileSync('src/app/actions/band-actions.ts', 'utf8');
    const control = fs.readFileSync('src/components/tournaments/BandPublishControl.tsx', 'utf8');
    const weekly = fs.readFileSync('src/components/tournaments/LeagueWeeklyBandButton.tsx', 'utf8');
    const status = fs.readFileSync('src/components/tournaments/BandPublishStatus.tsx', 'utf8');

    assert.match(actions, /export async function getBandPostPreviewAction/);
    assert.match(actions, /previewOnly:\s*true/);
    assert.match(actions, /await verifyCenterAdmin\(input\.centerId\)/);
    assert.match(actions, /previewToken/);
    assert.match(actions, /previewToken:\s*input\.previewToken/);

    assert.match(control, /getBandPostPreviewAction/);
    assert.match(control, /preview\.previewToken/);
    assert.match(control, /!approved/);
    assert.match(control, /onCancel/);
    assert.match(weekly, /BandPublishControl/);
    assert.match(status, /BandPublishControl/);
});
