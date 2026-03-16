const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const keyword = '상주리그';
  const number = '19';

  console.log(`--- [${keyword}] 관련 대회 검색 중... ---`);
  const tournaments = await prisma.tournament.findMany({
    where: {
      AND: [
        { name: { contains: keyword } },
        { name: { contains: number } }
      ]
    },
    include: {
      leagueRounds: {
        orderBy: { roundNumber: 'asc' }
      }
    }
  });

  if (tournaments.length === 0) {
    console.log(`오류: '${keyword}'와 '${number}'를 포함하는 대회를 찾을 수 없습니다.`);
    console.log("현재 등록된 모든 대회 목록:");
    const all = await prisma.tournament.findMany({ select: { name: true } });
    all.forEach(t => console.log(` - ${t.name}`));
    return;
  }

  for (const t of tournaments) {
    console.log(`\n[대회 발견] ID: ${t.id} | 이름: ${t.name}`);
    console.log(`라운드 수: ${t.leagueRounds.length}`);

    // 특정 라운드 (예: 16라운드) 상세 조회
    const targetRoundNumber = 16;
    const round = t.leagueRounds.find(r => r.roundNumber === targetRoundNumber);

    if (round) {
      console.log(`\n--- ${targetRoundNumber}주차 매치업 리스트 ---`);
      const matchups = await prisma.leagueMatchup.findMany({
        where: { roundId: round.id },
        include: {
          teamA: true,
          teamB: true
        },
        orderBy: { lanes: 'asc' }
      });

      if (matchups.length === 0) {
        console.log("매치업 정보가 없습니다.");
      } else {
        matchups.forEach((m, idx) => {
          console.log(`${idx + 1}번 테이블 (ID: ${m.id})`);
          console.log(`   팀 A: ${m.teamA?.name || 'Unknown'} [스쿼드: ${m.teamASquad}]`);
          console.log(`   팀 B: ${m.teamB?.name || 'Unknown'} [스쿼드: ${m.teamBSquad}]`);
          console.log('-----------------------------------');
        });
      }
    } else {
      console.log(`\n${targetRoundNumber}주차 정보가 아직 생성되지 않았습니다.`);
    }
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
