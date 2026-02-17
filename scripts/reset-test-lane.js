const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    const tournaments = await prisma.tournament.findMany({
        include: { leagueRounds: true }
    })

    const tournament = tournaments.find(t => t.name.includes('2026') && t.name.includes('챔프전2'))

    if (!tournament) {
        console.log('Tournament not found among:')
        tournaments.forEach(t => console.log(`- ${t.name}`))
        return
    }

    console.log(`Found tournament: ${tournament.name}`)

    const round = tournament.leagueRounds.find(r => r.roundNumber === 2)
    if (!round) {
        console.log('Round 2 not found. Available rounds:')
        tournament.leagueRounds.forEach(r => console.log(`- Round ${r.roundNumber} (id: ${r.id})`))
        return
    }

    const result = await prisma.roundParticipant.updateMany({
        where: {
            roundId: round.id,
            lane: { not: null }
        },
        data: { lane: null }
    })

    console.log(`Successfully reset lanes for ${result.count} participants in ${tournament.name} Round ${round.roundNumber}`)
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect())
