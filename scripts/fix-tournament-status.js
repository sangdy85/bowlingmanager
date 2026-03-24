const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- 챔프전 상태 복구 스크립트 ---');
  
  // 1. 대상 대회 찾기 (정확한 ID로 타겟팅)
  const tournamentId = 'cm6r7q92b000212p07nd9i93c'; 
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId }
  });

  if (!tournament) {
    console.error('오류: "2026년 상반기 챔프전" 대회를 찾을 수 없습니다.');
    return;
  }

  console.log(`발견된 대회: ${tournament.name} (ID: ${tournament.id})`);
  console.log(`현재 상태: ${tournament.status}`);

  if (tournament.status === 'FINISHED') {
    // 2. 상태를 PLANNING으로 복구
    // UI 로직이 startDate/endDate를 기준으로 PLANNING/UPCOMING/ONGOING을 다시 계산하므로
    // DB의 고정 상태인 FINISHED만 풀어주면 됩니다.
    await prisma.tournament.update({
      where: { id: tournament.id },
      data: { status: 'PLANNING' }
    });
    console.log('결과: 대회 상태가 "PLANNING"으로 복구되었습니다.');
  } else {
    console.log('알림: 대회 상태가 이미 FINISHED가 아닙니다.');
  }
}

main()
  .catch(err => console.error('실행 중 오류 발생:', err))
  .finally(() => prisma.$disconnect());
