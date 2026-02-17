import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const tournament = await prisma.tournament.findFirst({
        where: { title: { contains: '2026년 상반기 챔프전2' } },
        include: { leagueRounds: true }
    })

    if (!tournament) {
        console.log('Tournament not found')
        return
    }

    // Round 2
    const round = tournament.leagueRounds.find(r => r.roundNumber === 2)
    if (!round) {
        console.log('Round 2 not found')
        return
    }

    // Find participant 'test1'
    const participant = await prisma.roundParticipant.findFirst({
        where: {
            roundId: round.id,
            registration: {
                OR: [
                    { guestName: 'test1' },
                    { user: { name: 'test1' } }
                ]
            }
        }
    })

    if (!participant) {
        console.log('Participant test1 not found')
        return
    }

    await prisma.roundParticipant.update({
        where: { id: participant.id },
        data: { lane: null }
    })

    console.log(`Successfully reset lane for test1 in ${tournament.title} Round ${round.roundNumber}`)
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect())
