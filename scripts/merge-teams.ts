import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const keepTeamName = 'J&B';
    const keepTeamCode = 'RTW62C';
    const removeTeamName = '배볼러';
    const removeTeamCode = 'T1CG9B';

    try {
        console.log(`Starting team merge...`);
        
        // 1. Find Teams
        const keepTeam = await prisma.team.findFirst({
            where: { name: keepTeamName, code: keepTeamCode }
        });

        const removeTeam = await prisma.team.findFirst({
            where: { name: removeTeamName, code: removeTeamCode }
        });

        if (!keepTeam) {
            console.error(`Error: Support team "${keepTeamName}" (${keepTeamCode}) not found.`);
            process.exit(1);
        }

        if (!removeTeam) {
            console.warn(`Warning: Target team to remove "${removeTeamName}" (${removeTeamCode}) not found. Proceeding with update only.`);
        }

        if (keepTeam && removeTeam) {
            console.log(`Merging "${removeTeam.name}" (ID: ${removeTeam.id}) into "${keepTeam.name}" (ID: ${keepTeam.id})...`);

            // 2. Move Members (Handle duplicates)
            const removeMembers = await prisma.teamMember.findMany({
                where: { teamId: removeTeam.id }
            });

            console.log(`Checking ${removeMembers.length} members from "${removeTeam.name}"...`);

            for (const member of removeMembers) {
                const existingMember = await prisma.teamMember.findUnique({
                    where: {
                        userId_teamId: {
                            userId: member.userId,
                            teamId: keepTeam.id
                        }
                    }
                });

                if (existingMember) {
                    console.log(`  User ${member.userId} is already in "${keepTeam.name}". Removing duplicate membership.`);
                    await prisma.teamMember.delete({
                        where: { id: member.id }
                    });
                } else {
                    console.log(`  Moving user ${member.userId} to "${keepTeam.name}".`);
                    await prisma.teamMember.update({
                        where: { id: member.id },
                        data: { teamId: keepTeam.id }
                    });
                }
            }

            // 3. Move Other Records
            console.log(`Updating related records...`);

            // Posts
            const postsUpdate = await prisma.post.updateMany({
                where: { teamId: removeTeam.id },
                data: { teamId: keepTeam.id }
            });
            console.log(`  Moved ${postsUpdate.count} posts.`);

            // Scores
            const scoresUpdate = await prisma.score.updateMany({
                where: { teamId: removeTeam.id },
                data: { teamId: keepTeam.id }
            });
            console.log(`  Moved ${scoresUpdate.count} scores.`);

            // Center Members
            const centerMembersUpdate = await prisma.centerMember.updateMany({
                where: { teamId: removeTeam.id },
                data: { teamId: keepTeam.id }
            });
            console.log(`  Moved ${centerMembersUpdate.count} center memberships.`);

            // Matchups (TeamA)
            const matchupAUpdate = await prisma.leagueMatchup.updateMany({
                where: { teamAId: removeTeam.id },
                data: { teamAId: keepTeam.id }
            });
            console.log(`  Updated ${matchupAUpdate.count} matchups as Team A.`);

            // Matchups (TeamB)
            const matchupBUpdate = await prisma.leagueMatchup.updateMany({
                where: { teamBId: removeTeam.id },
                data: { teamBId: keepTeam.id }
            });
            console.log(`  Updated ${matchupBUpdate.count} matchups as Team B.`);

            // Individual Matchup Scores
            const matchupIndScoreUpdate = await prisma.leagueMatchupIndividualScore.updateMany({
                where: { teamId: removeTeam.id },
                data: { teamId: keepTeam.id }
            });
            console.log(`  Updated ${matchupIndScoreUpdate.count} individual matchup scores.`);

            // Tournament Registrations
            const registrationsUpdate = await prisma.tournamentRegistration.updateMany({
                where: { teamId: removeTeam.id },
                data: { teamId: keepTeam.id }
            });
            console.log(`  Updated ${registrationsUpdate.count} tournament registrations.`);

            // 4. Delete the target team
            console.log(`Deleting old team "${removeTeam.name}"...`);
            await prisma.team.delete({
                where: { id: removeTeam.id }
            });
        }

        // 5. Update the "keep" team to the final name and code
        console.log(`Updating "${keepTeam.name}" (${keepTeam.code}) to Name: "${removeTeamName}", Code: "${removeTeamCode}"...`);
        await prisma.team.update({
            where: { id: keepTeam.id },
            data: {
                name: removeTeamName,
                code: removeTeamCode
            }
        });

        console.log(`Successfully completed team merge and update.`);
        
    } catch (error: any) {
        console.error('Error during team merge:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
