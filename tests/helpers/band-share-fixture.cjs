const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Load real actions/builders with in-memory Prisma and session boundaries.
// All outbound BAND modules and all DB mutations are forbidden, not mocked successes.
function createShareFixture(root = path.resolve(__dirname, '../..')) {
    const flags = { user: 'owner' };
    const calls = { target: 0, writes: 0, external: 0 };
    const score = (registrationId, gameNumber, value = 200) => ({ registrationId, gameNumber, score: value });
    const people = Array.from({ length: 4 }, (_, i) => ({
        id: `p${i}`, registrationId: `reg${i}`, createdAt: new Date(2026, 0, i + 1), lane: 11 + i,
        registration: { guestName: `선수${i}`, guestTeamName: '테스트팀', handicap: 0 },
    }));
    const rounds = [1, 2, 3, 4].map(n => ({ id: `r${n}`, roundNumber: n, date: new Date(2026, 0, n),
        participants: people.map(p => ({ ...p })),
        individualScores: people.flatMap(p => [1, 2, 3].map(g => score(p.registrationId, g, 180 + n))),
        matchups: n === 4 ? [] : [{ id: `m${n}`, status: n === 2 ? 'PENDING' : 'FINISHED',
            teamAId: 'A', teamBId: 'B', teamA: { name: 'A팀' }, teamB: { name: 'B팀' },
            pointsA: 3, pointsB: 1, scoreA1: 600 + n, scoreA2: 610 + n, scoreA3: 620 + n,
            scoreB1: 500, scoreB2: 510, scoreB3: 520, useStoredTeamTotals: true,
            individualScores: [1, 2].flatMap(i => ['A', 'B'].map(teamId => ({
                teamId, userId: teamId + i, playerName: teamId + '선수' + i,
                score1: 180 + n, score2: 190 + n, score3: 200 + n, handicap: 0,
            }))),
        }],
    }));
    const tournament = { id: 't1', centerId: 'center', name: '가상 대회', type: 'LEAGUE', status: 'ONGOING',
        startDate: new Date(2026, 0, 1), iteration: 20, settings: '{"gameCount":3}',
        maxParticipants: 4, entryFee: 0, center: { name: '가상 볼링장' }, registrations: [], leagueRounds: rounds,
        avgTopRankCount: 2, avgMinParticipationPct: 0, awardMinGames: 3, teamHandicapLimit: 30,
    };
    const db = {
        bowlingCenter: { findUnique: async ({ where }) => where.id === 'center'
            ? { ownerId: 'owner', managers: [{ id: 'manager' }] }
            : where.id === 'other' ? { ownerId: 'other-manager', managers: [] } : null },
        tournament: { findUnique: async query => {
            calls.target++;
            if (query.where.id !== tournament.id) return null;
            const filter = query.select?.leagueRounds?.where?.id;
            const finishedOnly = query.include?.leagueRounds?.include?.matchups?.where?.status === 'FINISHED';
            return { ...tournament, leagueRounds: filter !== undefined ? rounds.filter(r => r.id === filter)
                : finishedOnly ? rounds.map(r => ({ ...r, matchups: r.matchups.filter(m => m.status === 'FINISHED') })) : rounds };
        } },
        leagueRound: {
            findFirst: async ({ where }) => { const r = rounds.find(r => r.roundNumber === where.roundNumber && where.tournamentId === tournament.id); return r && { ...r, tournament }; },
            findUnique: async ({ where }) => { const r = rounds.find(r => r.id === where.id); return r && { ...r, tournament }; },
        },
        $queryRaw: async (parts, roundId) => rounds.find(r => r.id === roundId)?.individualScores || [],
    };
    const forbidden = () => { calls.writes++; throw new Error('DB mutation forbidden'); };
    for (const model of Object.values(db)) if (typeof model === 'object') {
        for (const key of ['create', 'update', 'delete', 'createMany', 'updateMany', 'deleteMany', 'upsert']) model[key] = forbidden;
    }
    for (const name of ['bandConnection', 'bandPost']) Object.defineProperty(db, name, { get() { throw new Error('Share must not access ' + name); } });
    const cache = new Map();
    function load(file) {
        const full = path.resolve(root, file);
        if (cache.has(full)) return cache.get(full).exports;
        const mod = { exports: {} }; cache.set(full, mod);
        const code = ts.transpileModule(fs.readFileSync(full, 'utf8'), {
            compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
        }).outputText;
        const req = id => {
            if (id === 'next/cache') return { revalidatePath: () => {} };
            if (id === '@/lib/prisma') return { __esModule: true, default: db };
            if (id === '@/auth') return { auth: async () => flags.user ? { user: { id: flags.user } } : null };
            if (/\/(client|token-crypto|publisher|config)$/.test(id)) { calls.external++; throw new Error('BAND dependency forbidden'); }
            if (id.startsWith('@/') || id.startsWith('.')) {
                const base = id.startsWith('@/') ? path.resolve(root, 'src', id.slice(2)) : path.resolve(path.dirname(full), id);
                return load(base + '.ts');
            }
            return require(id);
        };
        new Function('require', 'module', 'exports', code)(req, mod, mod.exports);
        return mod.exports;
    }
    const actions = load('src/app/actions/band-share-actions.ts');
    const input = { centerId: 'center', tournamentId: 't1', roundId: 'r1', week: 1, type: 'LEAGUE_WEEKLY_RESULT' };
    return { actions, input, flags, calls, rounds, tournament, load, db };
}
module.exports = { createShareFixture };
