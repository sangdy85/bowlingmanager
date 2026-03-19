const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 실행 방법: node scripts/remote-fix.js <TARGET_ID>
const targetId = process.argv[2];

async function main() {
  console.log('--- [서버] 대회 상태 복구 스크립트 ---');

  if (!targetId) {
    console.error('오류: 대상 대회 ID가 입력되지 않았습니다.');
    console.log('사용법: node scripts/remote-fix.js [ID값]');
    return;
  }

  // 1. 대회 존재 여부 확인
  const tournament = await prisma.tournament.findUnique({
    where: { id: targetId }
  });

  if (!tournament) {
    console.error(`오류: ID가 "${targetId}"인 대회를 찾을 수 없습니다.`);
    return;
  }

  console.log(`대상 대회: ${tournament.name}`);
  console.log(`현재 상태: ${tournament.status}`);

  if (tournament.status !== 'FINISHED') {
    console.log('알림: 이 대회는 현재 FINISHED 상태가 아닙니다. 수정을 중단합니다.');
    return;
  }

  // 2. 상태를 PLANNING으로 복구
  await prisma.tournament.update({
    where: { id: targetId },
    data: { status: 'PLANNING' }
  });

  console.log('\n결과: 대회 상태가 "PLANNING"으로 성공적으로 복구되었습니다!');
  console.log('이제 사이트에서 대회가 다시 노출되는지 확인하세요.');
}

main()
  .catch(err => console.error('실행 중 오류:', err))
  .finally(() => prisma.$disconnect());
