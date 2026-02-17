import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function diagnose() {
    console.log("--- Tournament & League Diagnosis ---");

    const tournaments = await prisma.tournament.findMany({
        where: { type: 'LEAGUE' },
        include: {
            center: true,
            registrations: {
                include: {
                    team: {
                        include: {
                            members: {
                                include: { user: true }
                            }
                        }
                    }
                }
            }
        }
    });

    if (tournaments.length === 0) {
        console.log("No league tournaments found.");
        return;
    }

    tournaments.forEach(t => {
        console.log(`\nTournament: ${t.name} (ID: ${t.id})`);
        console.log(`Center: ${t.center.name}`);
        console.log(`Registrations: ${t.registrations.length}`);

        t.registrations.forEach(r => {
            console.log(`  Team: ${r.team?.name || 'Individual'} (ID: ${r.teamId})`);
            console.log(`    Members: ${r.team?.members.length || 0}`);
            r.team?.members.forEach(m => {
                console.log(`      - ${m.user.name} (${m.user.id})`);
            });
        });
    });

    const rounds = await prisma.leagueRound.findMany({
        include: {
            matchups: {
                include: {
                    teamA: true,
                    teamB: true
                }
            }
        },
        orderBy: { roundNumber: 'desc' },
        take: 1
    });

    if (rounds.length > 0) {
        console.log("\n--- Latest Round Check ---");
        const r = rounds[0];
        console.log(`Round ${r.roundNumber} (ID: ${r.id})`);
        r.matchups.forEach(m => {
            console.log(`  Matchup: ${m.teamA?.name || 'BYE'} vs ${m.teamB?.name || 'BYE'} (Lanes: ${m.lanes})`);
        });
    }
}

diagnose()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
