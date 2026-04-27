const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // 1. 19회차 대회 찾기
  const tournament = await prisma.tournament.findFirst({
    where: { name: { contains: '19' } },
    include: {
      leagueRounds: {
        orderBy: { roundNumber: 'asc' },
        include: {
          matchups: {
            include: {
              teamA: true,
              teamB: true
            },
            orderBy: { lanes: 'asc' }
          }
        }
      }
    }
  });

  if (!tournament) {
    console.log('❌ 19회차 대회를 찾을 수 없습니다.');
    const all = await prisma.tournament.findMany({ select: { name: true } });
    console.log('현재 DB에 있는 대회 목록:');
    all.forEach(t => console.log(` - ${t.name}`));
    return;
  }

  console.log(`\n✅ 대상 대회: ${tournament.name} (ID: ${tournament.id})`);

  // 2. 참여 팀 목록 출력 (수정 시 참조용 ID 포함)
  const teams = new Map();
  tournament.leagueRounds.forEach(r => {
    r.matchups.forEach(m => {
      if (m.teamA) teams.set(m.teamA.id, m.teamA.name);
      if (m.teamB) teams.set(m.teamB.id, m.teamB.name);
    });
  });

  console.log('\n--- [참여 팀 목록] ---');
  teams.forEach((name, id) => {
    console.log(`팀명: ${name.padEnd(10)} | ID: ${id}`);
  });

  // 3. 라운드별 대진표 출력
  console.log('\n--- [라운드별 대진표] ---');
  for (const round of tournament.leagueRounds) {
    console.log(`\n[${round.roundNumber}라운드] (ID: ${round.id})`);
    if (round.matchups.length === 0) {
      console.log('   (등록된 대진표 없음)');
      continue;
    }
    round.matchups.forEach(m => {
      const teamA = m.teamA ? `${m.teamA.name}${m.teamASquad || ''}` : '미지정';
      const teamB = m.teamB ? `${m.teamB.name}${m.teamBSquad || ''}` : '미지정';
      console.log(`   레인 ${m.lanes.padEnd(5)} | ${teamA.padStart(10)} vs ${teamB.padEnd(10)} | (Matchup ID: ${m.id})`);
    });
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
