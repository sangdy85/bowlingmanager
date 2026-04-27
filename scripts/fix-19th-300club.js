const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const TOURNAMENT_ID = 'cmmd9xex90003aicf11ugnw3l'; // 제 19회차 상주리그
  const CLUB_300_ID = 'cmmbmbncs000c1785ir23ygsj';   // 300클럽 팀 ID
  const MONSTER_ID = 'cmmbmfsr5001c17856r5lpxn0';    // 볼링몬스터 팀 ID

  console.log('--- [19회차 300클럽 A/B 분리 작업 시작] ---');

  // 1. 해당 대회의 모든 라운드 가져오기
  const rounds = await prisma.leagueRound.findMany({
    where: { tournamentId: TOURNAMENT_ID }
  });

  const roundIds = rounds.map(r => r.id);
  
  // 2. 해당 대회 모든 매치업 중 300클럽 또는 볼링몬스터가 포함된 경기 찾기
  const matchups = await prisma.leagueMatchup.findMany({
    where: {
      roundId: { in: roundIds },
      OR: [
        { teamAId: CLUB_300_ID },
        { teamBId: CLUB_300_ID },
        { teamAId: MONSTER_ID },
        { teamBId: MONSTER_ID }
      ]
    }
  });

  console.log(`대상 매치업 수: ${matchups.length}개`);

  let updateCount = 0;
  for (const m of matchups) {
    let updateData = {};
    let needsUpdate = false;

    // Team A 처리
    if (m.teamAId === CLUB_300_ID) {
      updateData.teamASquad = 'A';
      needsUpdate = true;
    } else if (m.teamAId === MONSTER_ID) {
      updateData.teamAId = CLUB_300_ID; // 팀 ID를 300클럽으로 변경
      updateData.teamASquad = 'B';     // 스쿼드를 B로 설정
      needsUpdate = true;
    }

    // Team B 처리
    if (m.teamBId === CLUB_300_ID) {
      updateData.teamBSquad = 'A';
      needsUpdate = true;
    } else if (m.teamBId === MONSTER_ID) {
      updateData.teamBId = CLUB_300_ID; // 팀 ID를 300클럽으로 변경
      updateData.teamBSquad = 'B';     // 스쿼드를 B로 설정
      needsUpdate = true;
    }

    if (needsUpdate) {
      await prisma.leagueMatchup.update({
        where: { id: m.id },
        data: updateData
      });
      updateCount++;
    }
  }

  console.log(`\n✅ 완료: ${updateCount}개의 매치업이 300클럽 A/B로 수정되었습니다.`);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
