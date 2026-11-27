const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const t = await prisma.tournament.findFirst({
    where: { name: { contains: '19' } }
  });
  
  if (!t) {
    console.log('19회차 대회를 찾을 수 없습니다.');
    return;
  }
  console.log(`\n=== [${t.name}] 대진표 (A, B 구분 포함) ===`);
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
  rounds.forEach(r => {
    console.log(`\n[${r.roundNumber}라운드]`);
    r.matchups
      .sort((a, b) => (a.lanes || '').localeCompare(b.lanes || ''))
      .forEach(m => {
        const teamA = (m.teamA?.name || 'GUEST') + (m.teamASquad ? ' (' + m.teamASquad + ')' : '');
        const teamB = (m.teamB?.name || 'GUEST') + (m.teamBSquad ? ' (' + m.teamBSquad + ')' : '');
        console.log(`  레인 ${m.lanes || '미지정'}: ${teamA} vs ${teamB}`);
      });
  });
}
run().catch(console.error).finally(() => prisma.$disconnect());
