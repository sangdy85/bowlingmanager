const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const scheduleData = require('./transcribed_schedule');

async function run() {
  // 1. Find the tournament
  const t = await prisma.tournament.findFirst({
    where: { name: { contains: '19' } }
  });
  
  if (!t) {
    console.log('19회차 대회를 찾을 수 없습니다.');
    return;
  }
  console.log(`대상 대회: ${t.name} (${t.id})`);

  // 2. Map Team Names to IDs
  const allTeams = await prisma.team.findMany();
  const findTeamId = (name) => {
    // Normalize name for matching
    const norm = (s) => s.replace(/\s/g, '').toLowerCase();
    const target = norm(name);
    
    // Exact match (normalized)
    let match = allTeams.find(t => norm(t.name) === target);
    if (match) return match.id;
    
    // Fuzzy match (R&B / 알앤비)
    if (target.includes('알앤비') || target.includes('rb')) {
       match = allTeams.find(t => norm(t.name).includes('알앤비') || norm(t.name).includes('rb') || norm(t.name).includes('r&b'));
       if (match) return match.id;
    }
    
    // Partial match
    match = allTeams.find(t => norm(t.name).includes(target) || target.includes(norm(t.name)));
    return match ? match.id : null;
  };

  // 3. Process Rounds
  for (let rIndex = 0; rIndex < scheduleData.length; rIndex++) {
    const roundNumber = rIndex + 1;
    const matchupsData = scheduleData[rIndex];
    
    // Find or create round
    let round = await prisma.leagueRound.findFirst({
      where: { tournamentId: t.id, roundNumber }
    });
    
    if (!round) {
      round = await prisma.leagueRound.create({
        data: { tournamentId: t.id, roundNumber }
      });
    }
    
    console.log(`\n[${roundNumber}라운드] 처리 중...`);
    
    // Clear existing matchups for this round
    await prisma.leagueMatchup.deleteMany({
      where: { roundId: round.id }
    });
    
    const lanes = ["1-2", "3-4", "5-6", "7-8", "9-10", "11-12", "13-14", "15-16", "17-18"];
    
    const newMatchups = [];
    for (let mIndex = 0; mIndex < matchupsData.length; mIndex++) {
      const [teamAName, squadA, teamBName, squadB] = matchupsData[mIndex];
      
      const teamAId = findTeamId(teamAName);
      const teamBId = findTeamId(teamBName);
      
      if (!teamAId || !teamBId) {
        console.warn(`❌ 매핑 실패: ${teamAName} (${teamAId}) vs ${teamBName} (${teamBId})`);
        continue;
      }
      
      newMatchups.push({
        roundId: round.id,
        teamAId,
        teamASquad: squadA,
        teamBId,
        teamBSquad: squadB,
        lanes: lanes[mIndex],
        status: 'PENDING'
      });
    }
    
    await prisma.leagueMatchup.createMany({
      data: newMatchups
    });
    console.log(`✅ ${newMatchups.length}개 대진 등록 완료.`);
  }

  console.log('\n모든 대진표 업데이트가 성공적으로 완료되었습니다.');
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
