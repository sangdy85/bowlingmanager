// Real actions and Prisma against a new, isolated SQLite database. No live user data.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { createRequire } = require('node:module');
const ts = require('typescript');
const { PrismaClient } = require('@prisma/client');
const root = path.resolve(__dirname, '..');
function loader(overrides) {
    const cache = new Map();
    return function load(file) {
        file = path.resolve(root, file);
        if (cache.has(file)) return cache.get(file).exports;
        const module = { exports: {} }; cache.set(file, module);
        const nativeRequire = createRequire(file);
        const req = id => Object.hasOwn(overrides, id) ? overrides[id]
            : id.startsWith('@/') ? load(`src/${id.slice(2)}.ts`)
            : id.startsWith('.') ? load(path.resolve(path.dirname(file), id + '.ts')) : nativeRequire(id);
        const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
            compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
        }).outputText;
        new Function('require', 'module', 'exports', output)(req, module, module.exports);
        return module.exports;
    };
}

test('center/team/name links recurring guest history on real membership and score-save paths', { timeout: 120000 }, async t => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-center-identity-'));
    const url = 'file:' + path.join(dir, 'test.db').replace(/\\/g, '/');
    let db = new PrismaClient({ datasources: { db: { url } } });
    try {
        await db.$queryRawUnsafe('SELECT 1'); await db.$disconnect();
        execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
            cwd: root, env: { ...process.env, DATABASE_URL: url, CHECKPOINT_DISABLE: '1' }, stdio: 'pipe',
        });
        db = new PrismaClient({ datasources: { db: { url } } });
        let session = null;
        const refreshed = [];
        const load = loader({
            '@/lib/prisma': { __esModule: true, default: db },
            '@/auth': { auth: async () => session },
            'next/cache': { revalidatePath: (...args) => refreshed.push(args) },
            uuid: { v4: require('node:crypto').randomUUID },
        });
        const actions = load('src/app/actions/center-members.ts');
        const linking = load('src/lib/center-league-identity.ts');
        const league = load('src/app/actions/league-actions.ts');
        const leaderboard = load('src/app/actions/league-leaderboard.ts');
        const teamJoin = load('src/lib/team-membership.ts');
        const statistics = load('src/lib/personal-statistics.ts');
        for (const [id, name] of [['owner','관리자'],['member','이강욱'],['namesake','이강욱'],['other','박동수'],['club-user','동호회원']]) {
            await db.user.create({ data: { id, name, email: `${id}@example.invalid` } });
        }
        for (const id of ['center','elsewhere']) await db.bowlingCenter.create({ data: {
            id, name: '테스트 퍼펙트', address: '가상 주소', code: id, ownerId: 'owner', managers: { connect: { id: 'owner' } },
        } });
        for (const [id, centerId] of [['team','center'],['other-team','center'],['foreign','elsewhere']]) {
            await db.team.create({ data: { id, name: '배볼러', code: id === 'team' ? 'ABC123' : id, centerId } });
        }
        async function fixture(id, centerId, teamId, name = '이강욱', userId = null) {
            await db.tournament.create({ data: { id, name: id, centerId, type: 'LEAGUE', status: 'COMPLETED',
                startDate: new Date('2023-01-01'), endDate: new Date('2023-12-31') } });
            for (let week = 1; week <= 2; week++) {
                await db.leagueRound.create({ data: { id: `${id}-r${week}`, tournamentId: id, roundNumber: week, date: new Date('2023-09-25') } });
                await db.leagueMatchup.create({ data: { id: `${id}-m${week}`, roundId: `${id}-r${week}`,
                    teamAId: teamId, status: 'FINISHED', pointsA: 4, pointsB: 0,
                    individualScores: { create: { id: `${id}-s${week}`, teamId, playerName: name, userId,
                        handicap: 12, score1: 150 + week, score2: 180 + week, score3: 210 + week } } } });
            }
        }
        await fixture('history','center','team');
        await fixture('other-history','center','other-team');
        await fixture('foreign-history','elsewhere','foreign');
        const before = await db.leagueMatchupIndividualScore.findMany({ orderBy: { id: 'asc' } });
        const immutable = rows => rows.map(({ userId, updatedAt, ...row }) => row);

        await t.test('unregistered repeated games accumulate within team; other teams stay separate', async () => {
            const report = await leaderboard.getIndividualLeaderboard('history');
            assert.equal(report.teams[0].players.length, 1);
            assert.equal(report.teams[0].players[0].gamesCount, 6);
            assert.equal(report.teams[0].players[0].totalHandicappedPins, 1161);
        });
        await t.test('login and actual center/team relationship are checked before linking', async () => {
            assert.equal((await actions.joinCenter('center','team','이강욱')).success, false);
            session = { user: { id: 'member' } };
            const savedError = console.error; console.error = () => {};
            try { assert.equal((await actions.joinCenter('center','foreign','이강욱')).success, false); }
            finally { console.error = savedError; }
            assert.equal(await db.centerMember.count(), 0);
            assert.equal(await db.leagueMatchupIndividualScore.count({ where: { userId: 'member' } }), 0);
        });
        await t.test('joining links all historical rows only in the chosen center/team, preserving scores and names', async () => {
            const result = await actions.joinCenter('center','team','偽の別名');
            assert.equal(result.success, true);
            assert.match(result.message, /과거 기록/);
            assert.equal(await db.teamMember.count({ where: { userId: 'member', teamId: 'team' } }), 1);
            assert.equal(await db.leagueMatchupIndividualScore.count({ where: { userId: 'member' } }), 2);
            assert.deepEqual(immutable(await db.leagueMatchupIndividualScore.findMany({ orderBy: { id: 'asc' } })), immutable(before));
            assert.equal((await leaderboard.getIndividualLeaderboard('history')).teams[0].players.length, 1);
            const personal = await statistics.getPersonalStatisticsData({id:'member',name:'이강욱',teamMemberships:[{teamId:'team',team:{name:'배볼러'}}]},2023,db);
            assert.equal(personal.officialRecords.length,6);
            assert.equal(personal.officialRecords.reduce((sum,r)=>sum+r.score,0),1161);
            assert.ok(refreshed.some(([p]) => p === '/personal'));
            assert.equal((await actions.joinCenter('center','team','이강욱')).success, true);
            assert.equal(await db.leagueMatchupIndividualScore.count({ where: { userId: 'member' } }), 2);
        });
        await t.test('existing center membership team update also creates membership and backfills', async () => {
            await fixture('late','center','team','박동수');
            await db.centerMember.create({ data: { id: 'existing', centerId: 'center', userId: 'other' } });
            session = { user: { id: 'other' } };
            assert.equal((await actions.joinCenter('center','team','박동수')).success, true);
            assert.equal(await db.teamMember.count({ where: { userId: 'other', teamId: 'team' } }), 1);
            assert.equal(await db.leagueMatchupIndividualScore.count({ where: { userId: 'other' } }), 2);
        });
        await t.test('unique current roster member auto-links in both real single and bulk saves', async () => {
            session = { user: { id: 'owner' } };
            for (const bulk of [false, true]) {
                const s = { teamId: 'team', playerName: '박동수', handicap: 12, score1: 200, score2: 210, score3: 220 };
                const id = `late-m${bulk ? 2 : 1}`;
                if (bulk) await league.updateLeagueRoundResults('late-r2', [{ matchupId: id, teamAScores: [s], teamBScores: [] }]);
                else await league.updateLeagueMatchupResult(id, { teamAScores: [s], teamBScores: [] });
                const saved = await db.leagueMatchupIndividualScore.findMany({ where: { matchupId: id } });
                assert.equal(saved[0].userId, 'other');
                assert.deepEqual([saved[0].handicap,saved[0].score1,saved[0].score2,saved[0].score3], [12,200,210,220]);
            }
        });
        await t.test('two same-name accounts do not claim remaining guest records', async () => {
            await fixture('ambiguous','center','team');
            session = { user: { id: 'namesake' } };
            const result = await actions.joinCenter('center','team','이강욱');
            assert.equal(result.success,true); assert.match(result.message,/관리자 확인/);
            assert.equal(await db.leagueMatchupIndividualScore.count({ where: { matchupId: { startsWith: 'ambiguous' }, userId: null } }), 2);
            const personal = await statistics.getAllPersonalStatisticsData({id:'namesake',name:'이강욱',teamMemberships:[{teamId:'team',team:{name:'배볼러'}}]},db);
            assert.equal(personal.officialRecords.length,0);
            session = { user: { id: 'owner' } };
            await assert.rejects(league.updateLeagueMatchupResult('ambiguous-m1', { teamAScores: [{ teamId:'team',playerName:'이강욱',handicap:0,score1:100,score2:100,score3:100 }], teamBScores:[] }), /동명 회원/);
        });
        await t.test('registration conflict and duplicate same-match scores are retained for review', async () => {
            await fixture('conflict','center','team','박동수');
            await db.leagueMatchupIndividualScore.create({ data: { matchupId:'conflict-m1',teamId:'team',playerName:'박동수',userId:'other',score1:200,score2:200,score3:200 } });
            await db.tournamentRegistration.create({ data: { id:'reg-user',tournamentId:'conflict',teamId:'team',userId:'other' } });
            await db.tournamentRegistration.create({ data: { id:'reg-guest',tournamentId:'conflict',teamId:'team',guestName:'박동수',scores:{create:{gameNumber:1,score:190}} } });
            const result = await db.$transaction(tx => linking.linkCenterTeamGuestRecords(tx,'center','team','other'));
            assert.equal(result.reviewRequired,true);
            assert.equal((await db.leagueMatchupIndividualScore.findUnique({where:{id:'conflict-s1'}})).userId,null);
            assert.equal(await db.tournamentRegistration.count({where:{tournamentId:'conflict'}}),2);
            assert.equal(await db.tournamentScore.count({where:{registrationId:'reg-guest'}}),1);
        });
        await t.test('uncontested registration is attached without deleting name, participants or scores', async () => {
            await db.tournamentRegistration.create({data:{id:'old-registration',tournamentId:'late',teamId:'team',guestName:' 박동수 ',
                roundParticipations:{create:{roundId:'late-r1'}},scores:{create:{gameNumber:1,score:201}}}});
            const result = await db.$transaction(tx => linking.linkCenterTeamGuestRecords(tx,'center','team','other'));
            assert.equal(result.linkedRegistrations,1);
            const reg = await db.tournamentRegistration.findUnique({where:{id:'old-registration'},include:{roundParticipations:true,scores:true}});
            assert.equal(reg.userId,'other'); assert.equal(reg.guestName,' 박동수 ');
            assert.equal(reg.roundParticipations.length,1); assert.equal(reg.scores[0].score,201);
        });
        await t.test('multiple same-name guest registrations cannot claim an arbitrary first registration', async () => {
            await db.tournamentRegistration.createMany({data:[1,2].map(i=>({id:`duplicate-reg-${i}`,tournamentId:'other-history',teamId:'other-team',guestName:'박동수'}))});
            await db.teamMember.create({data:{teamId:'other-team',userId:'other'}});
            const result = await db.$transaction(tx=>linking.linkCenterTeamGuestRecords(tx,'center','other-team','other'));
            assert.equal(result.reviewRequired,true);
            assert.equal(await db.tournamentRegistration.count({where:{id:{startsWith:'duplicate-reg-'},userId:null}}),2);
        });
        await t.test('center team-code join links history without rewriting other team records', async () => {
            await db.team.create({data:{id:'code-team',name:'센터팀',code:'CODE01',centerId:'center'}});
            await fixture('code-history','center','code-team','동호회원');
            await fixture('stay','elsewhere','foreign','동호회원','club-user');
            const beforeOther = await db.leagueMatchupIndividualScore.findMany({where:{matchupId:{startsWith:'stay'}},orderBy:{id:'asc'}});
            assert.equal((await teamJoin.joinTeamByCode({userId:'club-user',code:'CODE01'})).status,'JOINED');
            assert.equal(await db.leagueMatchupIndividualScore.count({where:{teamId:'code-team',userId:'club-user'}}),2);
            assert.deepEqual(await db.leagueMatchupIndividualScore.findMany({where:{matchupId:{startsWith:'stay'}},orderBy:{id:'asc'}}),beforeOther);
            assert.equal((await teamJoin.joinTeamByCode({userId:'club-user',code:'CODE01'})).status,'ALREADY_MEMBER');
        });
        await t.test('manager adding an existing team member also connects history', async () => {
            await fixture('admin-added','center','other-team','박동수');
            await db.centerMember.delete({where:{userId_centerId:{userId:'other',centerId:'center'}}});
            session = {user:{id:'owner'}};
            await actions.addCenterMember('center','other');
            assert.equal(await db.leagueMatchupIndividualScore.count({where:{matchupId:{startsWith:'admin-added'},userId:'other'}}),2);
        });
        await t.test('same-name guests on different teams remain separate in individual awards', async () => {
            await fixture('guest-scope','center','team','미가입선수');
            await db.tournament.update({where:{id:'guest-scope'},data:{awardMinGames:0}});
            await db.leagueMatchup.create({data:{roundId:'guest-scope-r2',teamAId:'other-team',status:'FINISHED',pointsA:4,pointsB:0,
                individualScores:{create:{teamId:'other-team',playerName:'미가입선수',score1:220,score2:230,score3:240}}}});
            const report = await leaderboard.getLeagueLeaderboard('guest-scope');
            const winners = Object.values(report.awards.individual).flat();
            assert.equal(winners.length,2);
            assert.deepEqual(winners.map(p=>p.totalGames).sort((a,b)=>a-b),[3,6]);
            assert.deepEqual(winners.map(p=>p.teamId).sort(),['other-team','team']);
        });
    } finally { await db.$disconnect(); fs.rmSync(dir,{recursive:true,force:true}); }
});
