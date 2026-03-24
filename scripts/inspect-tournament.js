const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const keyword = "2026";
  
  console.log(`--- [${keyword}] 관련 대회 검색 중... ---`);
  const tournaments = await prisma.tournament.findMany({
    where: {
      name: {
        contains: keyword
      }
    },
    include: {
      leagueRounds: {
        orderBy: {
          roundNumber: "asc"
        }
      }
    }
  });

  if (tournaments.length === 0) {
    console.log("대회를 찾을 수 없습니다.");
    return;
  }

  for (const t of tournaments) {
    console.log(`\n[대회 발견] ID: ${t.id} | 이름: ${t.name} | 상태: ${t.status}`);
    console.log(`가이드 날짜: ${t.startDate} ~ ${t.endDate}`);
    console.log(`라운드 수: ${t.leagueRounds.length}`);

    for (const r of t.leagueRounds) {
      console.log(`  - ${r.roundNumber}회차: ${r.date} | ID: ${r.id} | DB 상태: ${r.status}`);
    }
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
