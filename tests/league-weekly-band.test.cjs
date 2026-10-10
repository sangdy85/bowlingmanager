const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const originalSecret = process.env.AUTH_SECRET;
after(() => { if (originalSecret === undefined) delete process.env.AUTH_SECRET; else process.env.AUTH_SECRET = originalSecret; });
function load(file, mocks = {}) {
    const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    const module = { exports: {} };
    new Function('require', 'module', 'exports', source)(id => Object.hasOwn(mocks, id) ? mocks[id] : require(id), module, module.exports);
    return module.exports;
}
function fixture() {
    process.env.AUTH_SECRET = 'league-weekly-preview-test-only-32-byte-secret';
    const counters = { post: 0, save: 0, permissions: 0 };
    const flags = { configured: true, user: 'owner' };
    const score = (teamId, i, pins) => ({ teamId, teamSquad: null, userId: teamId + i, playerName: teamId + '선수' + i, User: { name: teamId + i }, score1: pins, score2: pins, score3: pins, handicap: 20 });
    const match = (id, pins = 230, status = 'FINISHED') => ({ id, status, teamAId: 'A', teamBId: 'B', teamASquad: null, teamBSquad: null, teamA: { name: 'A팀' }, teamB: { name: 'B팀' }, pointsA: 3, pointsB: 1, scoreA1: 999, scoreA2: 999, scoreA3: 999, scoreB1: 999, scoreB2: 999, scoreB3: 999, lanes: '11-12', individualScores: [1,2,3].flatMap(i => [score('A', i, pins), score('B', i, 180)]) });
    const rounds = [{ id: 'r1', roundNumber: 1, matchups: [match('m1')] }, { id: 'r2', roundNumber: 2, matchups: [match('m2', 200, 'PENDING')] }, { id: 'r3', roundNumber: 3, matchups: [match('m3', 280)] }, { id: 'r4', roundNumber: 4, matchups: [] }];
    const tournament = { id: 'league', centerId: 'center', name: '가상 상주리그', type: 'LEAGUE', iteration: 4, leagueRounds: rounds, registrations: [], teamHandicapLimit: 30, manualTeamHandicaps: null, awardMinGames: 3, avgTopRankCount: 2, avgMinParticipationPct: 0, reportNotice: '가상 테스트 시상 안내' };
    const connection = { enabled: true, bandKey: 'fixture-band', bandName: '가상 테스트 BAND', doPush: false, autoFinalResult: false, accessTokenEncrypted: 'fixture-not-real-token' };
    const history = [];
    const db = {
        bowlingCenter: { findUnique: async () => ({ ownerId: 'owner', managers: [{ id: 'manager' }] }) },
        tournament: { findUnique: async query => {
            if (query.where.id !== tournament.id) return null;
            const filter = query.select?.leagueRounds?.where?.id;
            if (filter !== undefined) return { ...tournament, leagueRounds: rounds.filter(r => r.id === filter) };
            return { ...tournament, leagueRounds: rounds.map(r => ({ ...r, matchups: r.matchups.filter(m => m.status === 'FINISHED') })) };
        } },
        leagueRound: { findFirst: async ({ where }) => { const r = rounds.find(r => r.roundNumber === where.roundNumber && where.tournamentId === tournament.id); return r ? { ...r, tournament: { teamHandicapLimit: tournament.teamHandicapLimit } } : null; } },
        bandConnection: { findUnique: async () => connection },
        bandPost: {
            findFirst: async ({ where }) => history.filter(p => p.tournamentId === where.tournamentId && p.roundId === where.roundId && p.type === where.type).sort((a,b) => b.revision-a.revision)[0] || null,
            create: async ({ data }) => { if (history.some(p => p.dedupeKey === data.dedupeKey)) throw Object.assign(new Error('duplicate'), { code: 'P2002' }); counters.save++; const p = { id: 'post-'+history.length, createdAt: new Date(), ...data }; history.push(p); return p; },
            update: async ({ where, data }) => Object.assign(history.find(p => p.id === where.id), data),
        },
    };
    const common = { '@/lib/prisma': { __esModule: true, default: db } };
    const report = load('src/lib/league-report.ts');
    const leaderboard = load('src/app/actions/league-leaderboard.ts', common);
    const publisher = load('src/lib/band/publisher.ts', {
        ...common, '@/lib/public-web': { PUBLIC_ORIGIN: 'https://www.bowlingmanager.co.kr' }, '@/lib/tournament-utils': { formatLane: String },
        '@/app/actions/champ-results': { getChampRoundResults: async () => ({ results: [] }) }, '@/app/actions/league-leaderboard': leaderboard, '@/lib/league-report': report,
        './league-weekly-content': load('src/lib/band/league-weekly-content.ts', { '@/lib/league-report': report }),
        './content': load('src/lib/band/content.ts'), './policy': load('src/lib/band/policy.ts'), './preview-signature': load('src/lib/band/preview-signature.ts'), './content-guard': load('src/lib/band/content-guard.ts'),
        './config': { isBandConfigured: () => flags.configured, BAND_NOT_CONFIGURED_MESSAGE: '준비 중' },
        './token-crypto': { decryptBandToken: () => 'test-token-not-used-on-network' },
        './client': { BandApiError: class extends Error {}, bandErrorMessage: () => 'fixture error', getPermissions: async () => { counters.permissions++; return ['posting']; }, createPost: async input => { counters.post++; return { postKey: 'fixture-post', ...input }; } },
    });
    const auth = { auth: async () => flags.user ? { user: { id: flags.user } } : null };
    const authUtils = load('src/lib/auth-utils.ts', { ...common, '@/auth': auth });
    const actions = load('src/app/actions/band-actions.ts', { ...common, '@/lib/auth-utils': authUtils, '@/lib/band/publisher': publisher, '@/lib/band/config': { isBandConfigured: () => flags.configured }, 'next/cache': { revalidatePath() {} }, '@/lib/band/client': {}, '@/lib/band/token-crypto': {} });
    const input = { centerId: 'center', tournamentId: 'league', roundId: 'r1', week: 1, type: 'LEAGUE_WEEKLY_RESULT' };
    return { report, leaderboard, publisher, actions, counters, flags, connection, history, rounds, tournament, input };
}
test('selected week preview includes four official sections, awards, configured TOP and shared match calculations', async () => {
    const f=fixture();const result=await f.actions.getBandPostPreviewAction(f.input);assert.equal(result.success,true);const text=result.outcome.preview.content;
    for(const marker of ['제 4차 · 1주차','🏆 팀 순위표','🏅 시상','👥 개인 순위표','📝 1주차 경기 결과','🔥 개인 평균 TOP 2','가상 테스트 시상 안내','?week=1'])assert.ok(text.includes(marker),marker);
    assert.ok(text.includes('[720/720/720]'));assert.ok(!text.includes('999'));assert.equal((text.split('🔥')[1].match(/위 /g)||[]).length,2);assert.deepEqual(f.counters,{post:0,save:0,permissions:0});
});
test('official report reads fresh selected-week matches; later-week changes cannot alter week-one cumulative results',async()=>{
    const f=fixture();const before=await f.leaderboard.getWeeklyLeagueReport('league',1);f.rounds[2].matchups[0].individualScores[0].score1=300;
    const after=await f.leaderboard.getWeeklyLeagueReport('league',1);assert.deepEqual(after.leaderboard,before.leaderboard);assert.deepEqual(after.individual,before.individual);assert.equal(after.roundInfo.id,'r1');assert.equal(after.individual.top30.length,2);
    f.rounds[0].matchups[0].individualScores[0].score1=250;const fresh=await f.leaderboard.getWeeklyLeagueReport('league',1);assert.notDeepEqual(fresh.individual,before.individual);
});
test('server rejects wrong week, foreign round, missing week and wrong center before preview/publish',async()=>{
    const f=fixture();for(const patch of [{week:3},{roundId:'foreign'},{week:undefined},{week:1.5},{centerId:'other-center'}]){
        const input={...f.input,...patch};assert.equal((await f.actions.getBandPostPreviewAction(input)).success,false);assert.equal((await f.actions.publishBandPostAction({...input,previewToken:'1234567890123.'+'a'.repeat(64)})).success,false);
    }assert.deepEqual(f.counters,{post:0,save:0,permissions:0});
});
test('unfinished and matchless weeks are blocked, while selected-week state isolates history and completion',async()=>{
    const f=fixture();f.history.push({id:'old',tournamentId:'league',roundId:'r1',type:f.input.type,status:'SUCCESS',revision:3,createdAt:new Date(),postedAt:new Date(),errorMessage:null});
    for(const [id,week] of [['r2',2],['r4',4]]){const input={...f.input,roundId:id,week};const state=await f.actions.getLeagueWeeklyBandStateAction(input);assert.equal(state.success,true);assert.equal(state.ready,false);assert.equal(state.latestPost,null);assert.equal((await f.actions.getBandPostPreviewAction(input)).success,false)}
    const state=await f.actions.getLeagueWeeklyBandStateAction(f.input);assert.equal(state.latestPost.id,'old');assert.equal(state.latestPost.revision,3);assert.equal(state.ready,true);assert.deepEqual(f.counters,{post:0,save:0,permissions:0});
});
test('permissions remain common owner/manager checks for state, preview and publish',async()=>{
    const f=fixture();for(const user of [null,'outsider']){f.flags.user=user;await assert.rejects(f.actions.getLeagueWeeklyBandStateAction(f.input));await assert.rejects(f.actions.getBandPostPreviewAction(f.input));await assert.rejects(f.actions.publishBandPostAction({...f.input,previewToken:'1234567890123.'+'a'.repeat(64)}))}f.flags.user='manager';assert.equal((await f.actions.getLeagueWeeklyBandStateAction(f.input)).success,true);assert.equal(f.counters.post,0);
});
test('old-week or changed-score preview cannot publish; client body and revision are not authoritative',async()=>{
    const f=fixture();const pre=await f.actions.getBandPostPreviewAction(f.input);const token=pre.outcome.preview.previewToken;
    assert.equal((await f.actions.publishBandPostAction({...f.input,roundId:'r3',week:3,previewToken:token})).success,false);
    f.rounds[0].matchups[0].individualScores[0].score1=299;assert.equal((await f.actions.publishBandPostAction({...f.input,previewToken:token,content:'forged',revision:99})).success,false);assert.equal(f.counters.post,0);assert.equal(f.counters.save,0);
});
test('manual push override is signed, does not change preferences, and preserves per-week revision history (mock BAND only)',async()=>{
    const f=fixture();f.connection.doPush=true;const pre=await f.actions.getBandPostPreviewAction({...f.input,doPush:false});assert.equal(pre.outcome.preview.doPush,false);
    assert.equal((await f.actions.publishBandPostAction({...f.input,doPush:true,previewToken:pre.outcome.preview.previewToken})).success,false);assert.equal(f.counters.post,0);
    assert.equal((await f.actions.publishBandPostAction({...f.input,doPush:false,previewToken:pre.outcome.preview.previewToken})).success,true);assert.equal(f.history[0].revision,1);assert.equal(f.connection.doPush,true);
    const next=await f.actions.getBandPostPreviewAction(f.input);assert.equal(next.outcome.preview.nextRevision,2);assert.equal(next.outcome.preview.doPush,true);
    const different=await f.actions.getBandPostPreviewAction({...f.input,roundId:'r3',week:3});assert.equal(different.outcome.preview.nextRevision,1);
});
test('shared official match display retains team handicap cap and individual 300-point cap',()=>{
    const f=fixture();const match=f.rounds[0].matchups[0];const capped=f.report.getLeagueMatchTeamReport(match,true,30);assert.equal(capped.g1,720);assert.equal(capped.handiSum,30);assert.equal(f.report.getLeagueMatchTeamReport(match,true,null).g1,750);match.individualScores[0].score1=299;assert.equal(f.report.getLeaguePlayerGames(match.individualScores[0])[0],300);
});
