const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- [서버] 대회 목록 조회 스크립트 ---');
  console.log('대회명에 "상반기" 또는 "2026"이 포함된 목록을 출력합니다.\n');

  const tournaments = await prisma.tournament.findMany({
    where: {
      OR: [
        { name: { contains: '상반기' } },
        { name: { contains: '2026' } }
      ]
    },
    select: {
      id: true,
      name: true,
      status: true,
      startDate: true,
      endDate: true
    },
    orderBy: {
      startDate: 'desc'
    }
  });

  if (tournaments.length === 0) {
    console.log('조건에 맞는 대회를 찾을 수 없습니다.');
  } else {
    console.table(tournaments);
    console.log('\n위 목록에서 수정할 대회의 "id" 값을 복사하세요.');
  }
}

main()
  .catch(err => console.error('실행 중 오류:', err))
  .finally(() => prisma.$disconnect());
