const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * 19회차 상주리그에서 팀을 교체하는 스크립트
 * 
 * 사용법:
 * 1. 아래 TARGET_TOURNAMENT_NAME이 정확한지 확인
 * 2. MAPPING 객체에 '기존 팀명': '바뀔 팀명'을 입력
 */

async function main() {
  const TARGET_TOURNAMENT_NAME = '19'; // 19를 포함하는 대회
  const MAPPING = {
    '기존팀명A': '새로운팀명A',
    // '기존팀명B': '새로운팀명B',
  };

  console.log('--- [팀 교체 작업 시작] ---');

  // 1. 대회 찾기
  const tournament = await prisma.tournament.findFirst({
    where: { name: { contains: TARGET_TOURNAMENT_NAME } }
  });

  if (!tournament) {
    console.error('❌ 대회를 찾을 수 없습니다.');
    return;
  }
  console.log(`대상 대회: ${tournament.name}`);

  // 2. 전체 팀 목록 미리 가져오기
  const allTeams = await prisma.team.findMany();
  const getTeamId = (name) => {
    const team = allTeams.find(t => t.name.trim() === name.trim());
    return team ? team.id : null;
  };

  // 3. 매핑 확인 및 ID 변환
  const idMapping = {};
  for (const [oldName, newName] of Object.entries(MAPPING)) {
    const oldId = getTeamId(oldName);
    const newId = getTeamId(newName);

    if (!oldId) {
      console.error(`❌ 기존 팀을 찾을 수 없습니다: ${oldName}`);
      continue;
    }
    if (!newId) {
      console.error(`❌ 교체할 새 팀을 찾을 수 없습니다: ${newName}`);
      continue;
    }
    idMapping[oldId] = newId;
    console.log(`매핑 확인: ${oldName} (${oldId}) -> ${newName} (${newId})`);
  }

  if (Object.keys(idMapping).length === 0) {
    console.log('작업할 매핑 정보가 없습니다. 스크립트 상단의 MAPPING을 수정하세요.');
    return;
  }

  // 4. 해당 대회의 모든 라운드/매치업 수정
  const rounds = await prisma.leagueRound.findMany({
    where: { tournamentId: tournament.id }
  });

  let updateCount = 0;
  for (const round of rounds) {
    const matchups = await prisma.leagueMatchup.findMany({
      where: { roundId: round.id }
    });

    for (const m of matchups) {
      let needsUpdate = false;
      const updateData = {};

      if (idMapping[m.teamAId]) {
        updateData.teamAId = idMapping[m.teamAId];
        needsUpdate = true;
      }
      if (idMapping[m.teamBId]) {
        updateData.teamBId = idMapping[m.teamBId];
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
  }

  console.log(`\n✅ 작업 완료! 총 ${updateCount}개의 매치업이 수정되었습니다.`);
}

main()
  .catch(e => {
    console.error('❌ 작업 중 오류 발생:');
    console.error(e);
  })
  .finally(() => prisma.$disconnect());
