const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  // 1. 19회차 대회 찾기
  const t = await prisma.tournament.findFirst({
    where: { name: { contains: '19' } }
  });

  if (!t) {
    console.log('❌ 19회차 대회를 찾을 수 없습니다.');
    return;
  }

  console.log(`\n✅ [${t.name}] 대진표를 출력합니다.`);

  // 2. 해당 대회의 라운드와 대진 정보 가져오기
  const rounds = await prisma.leagueRound.findMany({
    where: { tournamentId: t.id },
    include: {
      matchups: {
        include: {
          teamA: true,
          teamB: true
        }
      }
    },
    orderBy: { roundNumber: 'asc' }
  });

  // 3. 결과 출력
  rounds.forEach(r => {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`[ ${r.roundNumber} 라운드 ]`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    // 레인 순서대로 정렬해서 출력
    const sortedMatchups = r.matchups.sort((a,b) => parseInt(a.lanes || 0) - parseInt(b.lanes || 0));
    
    if (sortedMatchups.length === 0) {
      console.log('  (생성된 대진표가 없습니다)');
    } else {
      sortedMatchups.forEach(m => {
        const teamA = m.teamA?.name || 'GUEST';
        const teamB = m.teamB?.name || 'GUEST';
        console.log(`  📍 레인 ${m.lanes || '??'} : ${teamA} vs ${teamB}`);
      });
    }
  });
}

run()
  .catch(err => console.error('에러 발생:', err))
  .finally(() => prisma.$disconnect());
