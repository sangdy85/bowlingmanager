import { PrismaClient } from '@prisma/client';
import { LEAGUE_TEMPLATES } from '../src/lib/league-templates';

/**
 * [사용법]
 * 1. 아래 TOURNAMENT_ID에 실제 서버의 '제 17차 상주리그' ID를 넣으세요.
 * 2. terminal에서 다음 명령을 실행하세요:
 *    npx tsx scripts/apply-league-17-schedule.ts
 */

const TOURNAMENT_ID_ARG = process.argv[2];
const TOURNAMENT_NAME = "제 17차 상주리그"; // 또는 "제 17회차 상주리그"

const TEAM_NAME_ORDER = [
    "럭셔리A", "럭셔리B", "마블러스A", "마블러스B", "올앤텐핀A", "올앤텐핀B",
    "볼링몬스터", "볼링사랑", "도토리", "300클럽", "JK", "핀버스터",
    "배볼러A", "배볼러B", "떼굴떼굴A", "떼굴떼굴B", "R&B", "베가"
];

const prisma = new PrismaClient();

async function main() {
    let tournamentId = TOURNAMENT_ID_ARG;

    // 1. 토너먼트 찾기 (인자 -> 이름 검색)
    let tournament: any = null;
    if (tournamentId) {
        tournament = await prisma.tournament.findUnique({
            where: { id: tournamentId },
            include: {
                registrations: {
                    include: { team: true }
                }
            }
        });
    }

    if (!tournament) {
        console.log(`Searching for tournament with name containing "17" and "상주리그"...`);
        tournament = await prisma.tournament.findFirst({
            where: {
                AND: [
                    { name: { contains: "17" } },
                    { name: { contains: "상주리그" } }
                ]
            },
            include: {
                registrations: {
                    include: { team: true }
                }
            }
        });
    }

    if (!tournament) {
        console.error('Error: Tournament "제 17차 상주리그" not found in the database.');
        console.log('Please specify the tournament ID as an argument: npx tsx scripts/apply-league-17-schedule.ts <TournamentId>');
        return;
    }

    tournamentId = tournament.id;
    console.log(`Starting schedule update for tournament: [${tournamentId}] ${tournament.name}`);

    if (tournament.type !== 'LEAGUE') {
        console.error('Error: This tournament is not a LEAGUE type.');
        return;
    }

    console.log(`Found tournament: ${tournament.name}`);

    // 2. 팀 매핑 (이름 기반으로 ID 찾기)
    const teamMap: Record<number, string> = {};
    for (let i = 0; i < TEAM_NAME_ORDER.length; i++) {
        const teamName = TEAM_NAME_ORDER[i];
        const reg = tournament.registrations.find((r: any) =>
            r.guestName === teamName ||
            r.guestTeamName === teamName ||
            (r as any).playerName === teamName ||
            (r.team && r.team.name === teamName)
        );

        if (!reg) {
            console.error(`Error: Team "${teamName}" not found in tournament registrations.`);
            console.log('Available teams:', tournament.registrations.map((r: any) =>
                r.guestName || r.guestTeamName || (r.team && r.team.name)
            ).filter(Boolean));
            return;
        }
        teamMap[i + 1] = reg.id;
    }

    console.log('Successfully mapped all 18 teams.');

    // 3. 기존 대진표 삭제
    console.log('Deleting existing league rounds and matchups...');
    await prisma.leagueRound.deleteMany({
        where: { tournamentId: tournamentId }
    });

    // 4. 새 대진표 생성 (LEAGUE_TEMPLATES[18] 사용)
    const template = LEAGUE_TEMPLATES[18];
    if (!template) {
        console.error('Error: 18-team template not found in LEAGUE_TEMPLATES.');
        return;
    }

    const startLanes = 1; // 이미지 기준 1번 레인부터 시작
    const roundsCount = template.rounds.length;

    // 날짜 계산 (첫 시작일로부터 매주 7일씩 가산)
    const startDate = new Date(tournament.startDate);
    const [hours, minutes] = (tournament.leagueTime || "19:30").split(':').map(Number);
    startDate.setHours(hours || 19, minutes || 30, 0, 0);

    console.log(`Creating ${roundsCount} rounds...`);

    for (let i = 0; i < roundsCount; i++) {
        const roundTemplate = template.rounds[i];

        // 일주일 간격 날짜 계산
        const roundDate = new Date(startDate);
        roundDate.setDate(startDate.getDate() + (i * 7));

        const round = await prisma.leagueRound.create({
            data: {
                tournamentId: tournamentId,
                roundNumber: i + 1,
                date: roundDate
            }
        });

        const matchups = roundTemplate.map(m => {
            const laneStart = startLanes + (m.lanePairIndex * 2);
            return {
                roundId: round.id,
                teamAId: teamMap[m.teamA],
                teamBId: teamMap[m.teamB],
                lanes: `${laneStart}-${laneStart + 1}`,
                status: 'PENDING' as const
            };
        });

        await (prisma as any).leagueMatchup.createMany({
            data: matchups
        });

        console.log(`Round ${i + 1} created.`);
    }

    console.log('--- Done! League schedule has been forced to matching the image. ---');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
