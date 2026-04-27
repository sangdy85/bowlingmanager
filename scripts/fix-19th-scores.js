const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const TOURNAMENT_ID = 'cmmd9xex90003aicf11ugnw3l'; // 제 19회차 상주리그
  const CLUB_300_ID = 'cmmbmbncs000c1785ir23ygsj';   // 300클럽 팀 ID
  const MONSTER_ID = 'cmmbmfsr5001c17856r5lpxn0';    // 볼링몬스터 팀 ID

  console.log('--- [19회차 누적 점수 기록 팀 정보 수정 시작] ---');

  // 1. 해당 대회의 모든 라운드 및 매치업 ID 가져오기
  const tournament = await prisma.tournament.findUnique({
    where: { id: TOURNAMENT_ID },
    include: {
      leagueRounds: {
        include: {
          matchups: true
        }
      }
    }
  });

  if (!tournament) {
    console.error('❌ 대회를 찾을 수 없습니다.');
    return;
  }

  const allMatchupIds = tournament.leagueRounds.flatMap(r => r.matchups.map(m => m.id));

  // 2. 해당 매치업들에 속한 개인 점수 기록(LeagueMatchupIndividualScore) 수정
  const individualScores = await prisma.leagueMatchupIndividualScore.findMany({
    where: {
      matchupId: { in: allMatchupIds }
    }
  });

  console.log(`대상 개인 점수 기록 수: ${individualScores.length}개`);

  let updateCount = 0;
  for (const score of individualScores) {
    let updateData = {};
    let needsUpdate = false;

    // 해당 점수가 300클럽(기존) 기록인 경우 -> 스쿼드 A 부여
    if (score.teamId === CLUB_300_ID && score.teamSquad !== 'A') {
      updateData.teamSquad = 'A';
      needsUpdate = true;
    } 
    // 해당 점수가 볼링몬스터 기록인 경우 -> 300클럽 ID로 변경 + 스쿼드 B 부여
    else if (score.teamId === MONSTER_ID) {
      updateData.teamId = CLUB_300_ID;
      updateData.teamSquad = 'B';
      needsUpdate = true;
    }

    if (needsUpdate) {
      await prisma.leagueMatchup.updateMany({
         where: { id: score.matchupId },
         data: {
            // Already handled by previous script, but good to be sure if this script is run alone
         }
      });
      
      await prisma.leagueMatchupIndividualScore.update({
        where: { id: score.id },
        data: updateData
      });
      updateCount++;
    }
  }

  console.log(`\n✅ 완료: ${updateCount}개의 개인 점수 기록이 300클럽 A/B로 이관되었습니다.`);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
