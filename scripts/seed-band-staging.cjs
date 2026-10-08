#!/usr/bin/env node
'use strict';

// Synthetic QA data, not a copy of production users, scores or BAND credentials.
const fs = require('node:fs');
const path = require('node:path');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const CENTER_ID = 'band-staging-center';
const ADMIN_ID = 'band-staging-admin';
const VIEWER_ID = 'band-staging-viewer';

function assertStagingSeedTarget(env = process.env, cwd = process.cwd()) {
  if (env.APP_ENV !== 'band-staging' ||
      env.DATABASE_URL !== 'file:./band-staging.db' ||
      env.BAND_EXTERNAL_POSTING_ENABLED !== 'false' ||
      !env.BAND_STAGING_QA_PASSWORD ||
      !/staging/i.test(path.basename(cwd)) ||
      !fs.existsSync(path.join(cwd, '.git')) ||
      !fs.statSync(path.join(cwd, '.git')).isFile()) {
    throw new Error('Synthetic BAND data may only be seeded in the isolated staging worktree and database.');
  }
}

async function seedBandStaging(prisma = new PrismaClient()) {
  const existing = await prisma.bowlingCenter.findUnique({ where: { id: CENTER_ID } });
  if (existing) {
    const connection = await prisma.bandConnection.findUnique({ where: { centerId: CENTER_ID } });
    if (existing.code !== 'BAND_STAGING_CENTER' || connection?.bandKey !== 'STAGING-NO-EXTERNAL-POST') {
      throw new Error('Existing BAND fixture does not match the expected staging identity.');
    }
    return { status: 'already-seeded', centerId: CENTER_ID };
  }
  const [users, centers, tournaments, posts] = await Promise.all([
    prisma.user.count(), prisma.bowlingCenter.count(),
    prisma.tournament.count(), prisma.bandPost.count(),
  ]);
  if (users || centers || tournaments || posts) {
    throw new Error('Seed requires an empty isolated staging database.');
  }

  const pwHash = await bcrypt.hash(process.env.BAND_STAGING_QA_PASSWORD, 10);
  const date = new Date('2026-10-08T10:00:00.000Z');
  await prisma.$transaction(async tx => {
    await tx.user.create({ data: {
      id: ADMIN_ID, email: 'staging-admin@local.test', name: '스테이징 관리자',
      password: pwHash, emailVerified: date, role: 'USER',
    } });
    await tx.user.create({ data: {
      id: VIEWER_ID, email: 'staging-viewer@local.test', name: '스테이징 일반회원',
      password: pwHash, emailVerified: date, role: 'USER',
    } });
    await tx.bowlingCenter.create({ data: {
      id: CENTER_ID, code: 'BAND_STAGING_CENTER', name: 'BAND 스테이징 볼링장',
      address: '테스트 전용 가상 주소', ownerId: ADMIN_ID,
    } });
    await tx.bandConnection.create({ data: {
      id: 'band-staging-connection', centerId: CENTER_ID,
      connectedByUserId: ADMIN_ID,
      accessTokenEncrypted: 'STAGING_FAKE_TOKEN_NEVER_DECRYPT',
      bandKey: 'STAGING-NO-EXTERNAL-POST',
      bandName: '가상 BAND (실제 발행 불가)',
      enabled: true, autoRecruitment: false, autoFinalResult: false, doPush: false,
    } });

    const teamA = await tx.team.create({ data: {
      id: 'band-staging-team-a', name: '스테이징 A팀', code: 'BAND_STAGING_A',
      ownerId: ADMIN_ID, centerId: CENTER_ID,
    } });
    const teamB = await tx.team.create({ data: {
      id: 'band-staging-team-b', name: '스테이징 B팀', code: 'BAND_STAGING_B',
      ownerId: ADMIN_ID, centerId: CENTER_ID,
    } });

    const league = await tx.tournament.create({ data: {
      id: 'band-staging-league', name: '제1회차 스테이징 상주리그',
      type: 'LEAGUE', iteration: 1, status: 'ONGOING', centerId: CENTER_ID,
      startDate: date, endDate: new Date('2026-12-20T09:00:00.000Z'),
    } });
    const week1 = await tx.leagueRound.create({ data: {
      id: 'band-staging-week1', roundNumber: 1, tournamentId: league.id, date,
    } });
    const week2 = await tx.leagueRound.create({ data: {
      id: 'band-staging-week2', roundNumber: 2, tournamentId: league.id,
      date: new Date('2026-10-15T10:00:00.000Z'),
    } });
    await tx.leagueMatchup.create({ data: {
      id: 'band-staging-match1',
      round: { connect: { id: week1.id } },
      teamA: { connect: { id: teamA.id } },
      teamB: { connect: { id: teamB.id } },
      status: 'FINISHED', pointsA: 2, pointsB: 1,
      scoreA1: 610, scoreA2: 620, scoreA3: 590,
      scoreB1: 575, scoreB2: 580, scoreB3: 570,
      individualScores: { create: [
        { Team: { connect: { id: teamA.id } }, playerName: 'A선수1', score1: 205, score2: 208, score3: 195 },
        { Team: { connect: { id: teamA.id } }, playerName: 'A선수2', score1: 190, score2: 196, score3: 183 },
        { Team: { connect: { id: teamB.id } }, playerName: 'B선수1', score1: 191, score2: 194, score3: 189 },
        { Team: { connect: { id: teamB.id } }, playerName: 'B선수2', score1: 182, score2: 184, score3: 179 },
      ] },
    } });
    await tx.leagueMatchup.create({ data: {
      id: 'band-staging-match2', status: 'PENDING',
      round: { connect: { id: week2.id } },
      teamA: { connect: { id: teamA.id } },
      teamB: { connect: { id: teamB.id } },
    } });

    for (const config of [
      { id: 'band-staging-champ', name: '스테이징 챔프전', type: 'CHAMP', roundId: 'band-staging-champ-round' },
      { id: 'band-staging-event', name: '스테이징 이벤트전', type: 'EVENT', roundId: 'band-staging-event-round' },
    ]) {
      const tournament = await tx.tournament.create({ data: {
        id: config.id, name: config.name, type: config.type,
        status: 'ONGOING', centerId: CENTER_ID,
        startDate: date, endDate: new Date('2026-10-09T10:00:00.000Z'),
        maxParticipants: 12,
        settings: JSON.stringify({ gameCount: 3, gameMethod: '올핀 3게임' }),
      } });
      const round = await tx.leagueRound.create({ data: {
        id: config.roundId, tournamentId: tournament.id, roundNumber: 1, date,
      } });
      const people = [
        { name: '테스트 참가자 A', lane: 11, games: [215, 198, 201] },
        { name: '테스트 참가자 B', lane: 12, games: [184, 190, 200] },
        { name: '테스트 참가자 C', lane: 13, games: [170, 175, 168] },
      ];
      for (let i = 0; i < people.length; i += 1) {
        const person = people[i];
        const reg = await tx.tournamentRegistration.create({ data: {
          id: config.id + '-reg-' + i, tournamentId: tournament.id,
          guestName: person.name, guestTeamName: '가상팀',
          handicap: 0, paymentStatus: 'PAID',
        } });
        await tx.roundParticipant.create({ data: {
          roundId: round.id, registrationId: reg.id, lane: person.lane,
        } });
        for (let g = 0; g < 3; g += 1) {
          await tx.tournamentScore.create({ data: {
            roundId: round.id, registrationId: reg.id,
            gameNumber: g + 1, score: person.games[g],
          } });
        }
      }
    }
  }, { timeout: 30000 });
  return { status: 'seeded', centerId: CENTER_ID, tournaments: 3 };
}

if (require.main === module) {
  (async () => {
    try {
      assertStagingSeedTarget();
      const prisma = new PrismaClient();
      try {
        console.log('BAND staging fixture:', await seedBandStaging(prisma));
        console.log('Admin: staging-admin@local.test');
        console.log('Viewer: staging-viewer@local.test');
        console.log('Password: see BAND_STAGING_QA_PASSWORD in .env.band-staging.local');
        console.log('External BAND posting: disabled; no genuine BAND credentials.');
      } finally { await prisma.$disconnect(); }
    } catch (error) {
      console.error('Staging fixture failed:', error.message);
      process.exitCode = 1;
    }
  })();
}

module.exports = { assertStagingSeedTarget, seedBandStaging, CENTER_ID };
