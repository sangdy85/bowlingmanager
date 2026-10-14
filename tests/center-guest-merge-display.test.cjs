'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function loadTypeScript(file, mocks) {
    const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
        compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2022,
            esModuleInterop: true
        }
    }).outputText;
    const module = { exports: {} };
    new Function('require', 'module', 'exports', output)(
        id => Object.prototype.hasOwnProperty.call(mocks, id) ? mocks[id] : require(id),
        module,
        module.exports
    );
    return module.exports;
}

async function testMergePreservesHistoricalPlayerName() {
    let scoreUpdate;
    const tx = {
        tournamentRegistration: { findMany: async () => [] },
        leagueMatchup: { findMany: async () => [{ id: 'match-1' }] },
        leagueMatchupIndividualScore: {
            updateMany: async input => {
                scoreUpdate = input;
                return { count: 1 };
            }
        }
    };
    const prisma = {
        bowlingCenter: {
            findUnique: async () => ({ ownerId: 'manager-1', managers: [] })
        },
        $transaction: async callback => callback(tx)
    };
    const action = loadTypeScript('src/app/actions/center-guest-actions.ts', {
        '@/lib/prisma': { __esModule: true, default: prisma },
        '@/auth': { auth: async () => ({ user: { id: 'manager-1' } }) },
        'next/cache': { revalidatePath() {} }
    });

    const result = await action.mergeCenterGuestStats('center-1', '경기당시이름', 'user-1');
    assert.equal(result.success, true);
    assert.equal(scoreUpdate.data.userId, 'user-1');
    assert.equal(Object.hasOwn(scoreUpdate.data, 'playerName'), false);
    assert.equal(scoreUpdate.where.playerName, '경기당시이름');
}

async function testResultFallsBackToLinkedAccountName() {
    const prisma = {
        leagueRound: {
            findUnique: async () => ({
                id: 'round-1',
                roundNumber: 1,
                date: null,
                tournament: {
                    name: '상주리그', settings: null, type: 'LEAGUE',
                    teamHandicapLimit: null, manualTeamHandicaps: null, reportNotice: null
                },
                participants: [],
                matchups: [{
                    id: 'match-1', teamAId: 'team-1', teamBId: null,
                    teamASquad: null, teamBSquad: null,
                    teamA: null, teamB: null, lanes: '1-2',
                    pointsA: 4, pointsB: 0, status: 'FINISHED',
                    scoreA1: 600, scoreA2: 600, scoreA3: 600,
                    scoreB1: 0, scoreB2: 0, scoreB3: 0,
                    individualScores: [{
                        id: 'score-1', userId: 'user-1', playerName: null,
                        teamId: 'team-1', teamSquad: null, handicap: 0,
                        score1: 200, score2: 200, score3: 200,
                        User: { id: 'user-1', name: '연결된회원', handicap: 0 },
                        Team: { id: 'team-1', name: '테스트팀' }
                    }]
                }]
            })
        }
    };
    const action = loadTypeScript('src/app/actions/league-results.ts', {
        '@/lib/prisma': { __esModule: true, default: prisma }
    });

    const result = await action.getLeagueRoundResults('round-1');
    assert.equal(result.matchups[0].individualScores[0].playerName, '연결된회원');
}

Promise.resolve()
    .then(testMergePreservesHistoricalPlayerName)
    .then(testResultFallsBackToLinkedAccountName)
    .then(() => console.log('center guest merge display regression: PASS'))
    .catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
