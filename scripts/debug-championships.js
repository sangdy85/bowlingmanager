const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tournaments = await prisma.tournament.findMany({
    where: { 
      type: 'CHAMP'
    },
    include: {
      leagueRounds: {
        orderBy: { roundNumber: 'asc' }
      }
    }
  });

  console.log(`Found ${tournaments.length} CHAMP tournaments.`);
  
  const now = new Date();
  console.log(`Current Time (UTC): ${now.toISOString()}`);

  tournaments.forEach(t => {
    console.log(`\n--- Tournament: ${t.name} (ID: ${t.id}) ---`);
    console.log(`DB Status: ${t.status}`);
    console.log(`Start Date: ${t.startDate.toISOString()}`);
    console.log(`End Date: ${t.endDate.toISOString()}`);
    
    const roundStatuses = t.leagueRounds.map(r => {
      // Mocking calculateTournamentStatus logic
      let status = 'UPCOMING';
      const start = r.date;
      const regStart = r.registrationStart;
      
      const finishDate = r.date; 
      if (finishDate) {
        const kstFinish = new Date(finishDate.getTime() + 9 * 60 * 60000);
        const nextDayKST = new Date(Date.UTC(kstFinish.getUTCFullYear(), kstFinish.getUTCMonth(), kstFinish.getUTCDate() + 1));
        const nextDayUTC = new Date(nextDayKST.getTime() - 9 * 60 * 60000);
        
        if (now >= nextDayUTC) status = 'FINISHED';
        else if (start && now >= start) status = 'ONGOING';
        else if (start && now >= new Date(start.getTime() - 30 * 60000)) status = 'CLOSED';
        else if (regStart && now >= regStart) status = 'OPEN';
      }
      
      return {
        roundNumber: r.roundNumber,
        date: r.date?.toISOString(),
        regStart: r.registrationStart?.toISOString(),
        calculatedStatus: status
      };
    });

    console.log("Round Statuses:");
    console.table(roundStatuses);

    const allFinished = roundStatuses.every(s => s.calculatedStatus === 'FINISHED');
    const anyOngoing = roundStatuses.some(s => ['OPEN', 'CLOSED', 'ONGOING'].includes(s.calculatedStatus));
    
    let currentStatus = 'UPCOMING';
    if (t.status === 'FINISHED') currentStatus = 'FINISHED';
    else if (allFinished) currentStatus = 'FINISHED';
    else if (anyOngoing) currentStatus = 'ONGOING';

    console.log(`Resulting Current Status: ${currentStatus}`);
  });
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
