const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const cp = require('node:child_process');
const ts = require('typescript');
const { PrismaClient } = require('@prisma/client');
const root = path.resolve(__dirname, '..');

function loader(db, session, refreshed = []) {
    const cache = new Map();
    function load(file) {
        const full = path.resolve(root, file);
        if (cache.has(full)) return cache.get(full).exports;
        const mod = { exports: {} }; cache.set(full, mod);
        const req = id => {
            if (id === '@/lib/prisma') return { __esModule: true, default: db };
            if (id === '@/auth') return { auth: async () => session.user ? { user: { id: session.user } } : null };
            if (id === 'next/cache') return { revalidatePath: value => refreshed.push(value) };
            if (id === './tournament-center') return { updateTournamentBasicInfo: () => assert.fail('Unrelated tournament mutation') };
            if (id.startsWith('@/')) return load('src/' + id.slice(2) + '.ts');
            return require(id);
        };
        const code = ts.transpileModule(fs.readFileSync(full, 'utf8'), { compilerOptions: {
            module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
        } }).outputText;
        new Function('require', 'module', 'exports', code)(req, mod, mod.exports);
        return mod.exports;
    }
    return load;
}

test('unpaid deadline follows this round entry and KST midnight, including month boundaries', () => {
    const { unpaidRoundEntryDeadline } = loader(null, {})('src/lib/round-unpaid-cancellation.ts');
    assert.equal(unpaidRoundEntryDeadline(new Date('2026-10-01T00:00:00+09:00')).toISOString(), '2026-10-04T14:59:59.999Z');
    assert.equal(unpaidRoundEntryDeadline(new Date('2026-10-31T23:59:00+09:00')).toISOString(), '2026-11-03T14:59:59.999Z');
    assert.equal(unpaidRoundEntryDeadline(new Date('invalid')), null);
});

test('actual SQLite action preserves historical/scored lanes, scopes future cancellation, and enforces center admin', async t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-cancel-test-'));
    const database = path.join(directory, 'fixture.db');
    fs.writeFileSync(database, '');
    const url = 'file:' + database.replaceAll('\\', '/');
    const initialized = cp.spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'db', 'push', '--schema', 'prisma/schema.prisma', '--skip-generate'], {
        cwd: root, env: { ...process.env, DATABASE_URL: url }, encoding: 'utf8', timeout: 120000,
    });
    assert.equal(initialized.status, 0, initialized.stdout + initialized.stderr);
    const db = new PrismaClient({ datasources: { db: { url } } });
    const session = { user: 'cancel-owner' }, refreshed = [];
    const action = loader(db, session, refreshed)('src/app/actions/round-actions.ts').checkAndCancelUnpaidRegistrations;
    const now = Date.now(), day = 86400000;
    let index = 0;
    try {
        await db.user.create({ data: { id: session.user, name: '가상 관리자', email: 'cancel-owner@example.test' } });
        await db.bowlingCenter.create({ data: { id: 'cancel-center', code: 'CANCEL-QA', name: '가상 볼링장', address: '테스트', ownerId: session.user } });
        async function fixture(options = {}) {
            const key = 'case-' + (++index);
            const tournament = await db.tournament.create({ data: { id: key, centerId: 'cancel-center', name: '가상 챔프전', type: 'CHAMP',
                status: options.status || 'ONGOING', startDate: new Date(now + 10 * day), endDate: new Date(now + 11 * day) } });
            const round = await db.leagueRound.create({ data: { tournamentId: tournament.id, roundNumber: 4, date: new Date(now + (options.past ? -5 : 10) * day) } });
            const earlier = await db.leagueRound.create({ data: { tournamentId: tournament.id, roundNumber: 3, date: new Date(now - 30 * day) } });
            const reg = await db.tournamentRegistration.create({ data: { tournamentId: tournament.id, guestName: '가상 참가자',
                paymentStatus: options.payment || 'PENDING', createdAt: new Date(now - 100 * day) } });
            const entry = await db.roundParticipant.create({ data: { roundId: round.id, registrationId: reg.id, lane: 172, isManual: true,
                createdAt: new Date(now - (options.recent ? 1 : 8) * day) } });
            const old = await db.roundParticipant.create({ data: { roundId: earlier.id, registrationId: reg.id, lane: 92, isManual: true } });
            const unrelated = await db.tournamentRegistration.create({ data: { tournamentId: tournament.id, guestName: '이번 회차에 없는 사람',
                paymentStatus: 'PENDING', createdAt: new Date(now - 100 * day) } });
            await db.roundParticipant.create({ data: { roundId: earlier.id, registrationId: unrelated.id, lane: 143 } });
            if (options.scored) await db.tournamentScore.create({ data: { registrationId: reg.id, roundId: round.id, gameNumber: 1, score: 0 } });
            if (options.raw) await db.rawLaneScore.create({ data: { roundId: round.id, lane: 17, slot: 2, game1: 0 } });
            return { round, reg, entry, old, unrelated };
        }
        for (const options of [{ past: true }, { scored: true }, { raw: true }, { status: 'FINISHED' }, { payment: 'PAID' }, { recent: true }]) {
            await t.test('no cancellation for ' + JSON.stringify(options), async () => {
                const f = await fixture(options);
                assert.deepEqual(await action(f.round.id), { count: 0 });
                const saved = await db.roundParticipant.findUnique({ where: { id: f.entry.id } });
                assert.equal(saved.lane, 172); assert.equal(saved.isManual, true);
                assert.equal((await db.tournamentRegistration.findUnique({ where: { id: f.reg.id } })).paymentStatus, options.payment || 'PENDING');
            });
        }
        await t.test('future overdue entry changes only the selected round; earlier lanes and nonparticipants survive', async () => {
            const f = await fixture();
            assert.deepEqual(await action(f.round.id), { count: 1 });
            assert.equal((await db.roundParticipant.findUnique({ where: { id: f.entry.id } })).lane, null);
            const old = await db.roundParticipant.findUnique({ where: { id: f.old.id } });
            assert.equal(old.lane, 92); assert.equal(old.isManual, true);
            assert.equal((await db.tournamentRegistration.findUnique({ where: { id: f.unrelated.id } })).paymentStatus, 'PENDING');
            assert.deepEqual(await action(f.round.id), { count: 0 });
        });
        await t.test('non-admin and signed-out caller cannot cancel any entry', async () => {
            const f = await fixture();
            for (const user of ['other-center-admin', null]) {
                session.user = user;
                const previous = console.error; console.error = () => {};
                try { assert.deepEqual(await action(f.round.id), { count: 0 }); } finally { console.error = previous; }
                assert.equal((await db.roundParticipant.findUnique({ where: { id: f.entry.id } })).lane, 172);
                assert.equal((await db.tournamentRegistration.findUnique({ where: { id: f.reg.id } })).paymentStatus, 'PENDING');
            }
            session.user = 'cancel-owner';
        });
        await t.test('a lane-update failure rolls back the payment cancellation', async () => {
            const f = await fixture();
            const failing = {
                leagueRound: db.leagueRound, bowlingCenter: db.bowlingCenter,
                $transaction: callback => db.$transaction(tx => callback({
                    leagueRound: tx.leagueRound, tournamentRegistration: tx.tournamentRegistration,
                    roundParticipant: { findMany: args => tx.roundParticipant.findMany(args),
                        updateMany: async () => { throw Error('Simulated lane write failure'); } }
                }))
            };
            const broken = loader(failing, session)('src/app/actions/round-actions.ts').checkAndCancelUnpaidRegistrations;
            const previous = console.error; console.error = () => {};
            try { assert.deepEqual(await broken(f.round.id), { count: 0 }); } finally { console.error = previous; }
            assert.equal((await db.tournamentRegistration.findUnique({ where: { id: f.reg.id } })).paymentStatus, 'PENDING');
            assert.equal((await db.roundParticipant.findUnique({ where: { id: f.entry.id } })).lane, 172);
        });
        assert.equal(refreshed.length, 1);
    } finally {
        await db.$disconnect();
        for (const suffix of ['', '-journal', '-wal', '-shm']) if (fs.existsSync(database + suffix)) fs.unlinkSync(database + suffix);
        fs.rmdirSync(directory);
    }
});
