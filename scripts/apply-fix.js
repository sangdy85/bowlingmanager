const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("--- 마볼러스 A/B 스쿼드 교체 작업 시작 ---");

  try {
    const results = await prisma.$transaction([
      // 2번 테이블: 마볼러스 A -> B
      prisma.leagueMatchup.update({
        where: { id: "cmmstocxy003wkiqchni9dyc6" },
        data: { teamBSquad: "B" }
      }),
      // 5번 테이블: 마볼러스 B -> A
      prisma.leagueMatchup.update({
        where: { id: "cmmstocxy003zkiqcmtvkvucy" },
        data: { teamBSquad: "A" }
      })
    ]);

    console.log("✅ 교체 성공!");
    console.log("1. 2번 테이블(ID: ...chni9dyc6): 스쿼드 B로 변경됨");
    console.log("2. 5번 테이블(ID: ...vkvucy): 스쿼드 A로 변경됨");
    
  } catch (error) {
    console.error("❌ 교체 작업 중 오류 발생:");
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
