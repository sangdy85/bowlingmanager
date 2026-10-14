'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function loadAction(prisma) {
    const output = ts.transpileModule(fs.readFileSync('src/app/actions/league-leaderboard.ts', 'utf8'), {
        compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2022,
            esModuleInterop: true
        }
    }).outputText;
    const module = { exports: {} };
    new Function('require', 'module', 'exports', output)(
        id => id === '@/lib/prisma' ? { __esModule: true, default: prisma } : require(id),
        module,
        module.exports
    );
    return module.exports;
}

function score(id, playerName, games) {
    return {
        id,
        userId: 'member-1',
        playerName,
        User: { id: 'member-1', name: '박동수' },
        teamId: 'team-1',
        teamSquad: null,
        handicap: 0,
        score1: games[0],
        score2: games[1],
        score3: games[2]
    };
}

function matchup(id, individualScores) {
    return {
        id,
        status: 'FINISHED',
        teamAId: 'team-1',
        teamBId: null,
        teamASquad: null,
        teamBSquad: null,
        teamA: { id: 'team-1', name: '배볼러' },
        teamB: null,
        pointsA: 4,
        pointsB: 0,
        scoreA1: null,
        scoreA2: null,
        scoreA3: null,
        scoreB1: null,
        scoreB2: null,
        scoreB3: null,
        individualScores
    };
}

async function testLinkedMemberUsesOneIdentityAcrossDisplayNameChanges() {
    const tournament = {
        id: 'tournament-1',
        settings: null,
        manualTeamHandicaps: null,
        teamHandicapLimit: null,
        awardMinGames: 0,
        avgTopRankCount: 30,
        avgMinParticipationPct: 0,
        reportNotice: null,
        registrations: [{ userId: 'member-1', guestName: null, squad: null, team: { id: 'team-1' }, user: { id: 'member-1', name: '박동수' } }],
        leagueRounds: [
            { roundNumber: 1, matchups: [matchup('match-1', [score('score-1', null, [200, 210, 220])])] },
            { roundNumber: 2, matchups: [matchup('match-2', [score('score-2', '박동수', [230, 240, 250])])] }
        ]
    };
    const action = loadAction({ tournament: { findUnique: async () => tournament } });

    const individual = await action.getIndividualLeaderboard('tournament-1');
    assert.equal(individual.teams.length, 1);
    assert.equal(individual.teams[0].players.length, 1);
    assert.deepEqual(individual.teams[0].players[0], {
        userId: 'member-1',
        name: '박동수',
        gamesCount: 6,
        handicap: 0,
        totalRawPins: 1350,
        totalHandicappedPins: 1350,
        highSeries: 720,
        highGame: 250,
        lastMatchRawScore: 720,
        previousTotalRawPins: 630,
        currentWeekPins: 720
    });

    const leaderboard = await action.getLeagueLeaderboard('tournament-1');
    assert.equal(leaderboard.awards.individual.average[0].userId, 'member-1');
    assert.equal(leaderboard.awards.individual.average[0].playerName, '박동수');
    assert.equal(leaderboard.awards.individual.average[0].totalGames, 6);
    assert.equal(leaderboard.awards.individual.average[0].totalPinfall, 1350);
}

testLinkedMemberUsesOneIdentityAcrossDisplayNameChanges()
    .then(() => console.log('league leaderboard member identity regression: PASS'))
    .catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
