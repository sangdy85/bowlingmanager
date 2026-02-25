const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Tournament Diagnostic ---');
    const tournaments = await prisma.tournament.findMany({
        select: {
            id: true,
            name: true,
            leagueRounds: {
                select: {
                    roundNumber: true,
                    individualScores: { take: 1 }
                }
            }
        }
    });

    tournaments.forEach(t => {
        const finishedRounds = t.leagueRounds.filter(r => r.individualScores.length > 0);
        console.log(`Tournament: ${t.name} (ID: ${t.id})`);
        console.log(`  Total Rounds: ${t.leagueRounds.length}`);
        console.log(`  Finished Rounds (w/ scores): ${finishedRounds.length}`);
        console.log(`  Round Numbers: ${finishedRounds.map(r => r.roundNumber).sort((a, b) => a - b).join(', ')}`);
    });

    console.log('\n--- Checking for potential caching issues ---');
    // Just a simple count of all scores
    const scoreCount = await prisma.tournamentScore.count();
    console.log(`Total TournamentScore records: ${scoreCount}`);
}

main().catch(err => console.error(err)).finally(() => prisma.$disconnect());
