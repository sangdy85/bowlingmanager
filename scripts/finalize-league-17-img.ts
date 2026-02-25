import { PrismaClient } from '@prisma/client';
import { LEAGUE_TEMPLATES } from '../src/lib/league-templates';

/**
 * [제 17차 상주리그 이미지 대진표 강제 주입 스크립트]
 * 이미지에 포함된 18개 팀의 명칭과 일자별 대진을 DB에 직접 반영합니다.
 */

const TOURNAMENT_ID = 'cmlt36v910001wsb3hwbni7tc'; // 제 17회차 상주리그 ID

// 이미지에 표시된 18개 슬롯의 팀 정보 (이름, 분조)
const IMAGE_TEAM_MAPPING: Record<number, { name: string, squad: string | null }> = {
    1: { name: '럭셔리', squad: 'A' },
    2: { name: '럭셔리', squad: 'B' },
    3: { name: '마블러스', squad: 'A' },
    4: { name: '마블러스', squad: 'B' },
    5: { name: '롤앤텐핀', squad: 'A' },
    6: { name: '롤앤텐핀', squad: 'B' },
    7: { name: '볼링몬스터', squad: null },
    8: { name: '볼링사랑', squad: null },
    9: { name: '도토리', squad: null },
    10: { name: '300클럽', squad: null },
    11: { name: 'JK', squad: null },
    12: { name: '핀버스터', squad: null },
    13: { name: '베블러', squad: 'A' },
    14: { name: '베블러', squad: 'B' },
    15: { name: '떼굴떼굴', squad: 'A' },
    16: { name: '떼굴떼굴', squad: 'B' },
    17: { name: 'R&B', squad: null },
    18: { name: '베가', squad: null }
};

const prisma = new PrismaClient();

async function main() {
    console.log("--- 이미지 기반 대진표 강제 주입 시작 ---");

    // 1. 토너먼트 확인
    const tournament = await prisma.tournament.findUnique({
        where: { id: TOURNAMENT_ID },
        include: { leagueRounds: { orderBy: { roundNumber: 'asc' } } }
    });

    if (!tournament) {
        console.error("Error: 토너먼트를 찾을 수 없습니다.");
        return;
    }

    console.log(`대상: ${tournament.name} (${tournament.id})`);

    if (tournament.leagueRounds.length < 17) {
        console.error(`Error: 라운드가 ${tournament.leagueRounds.length}/17개입니다. 먼저 17주차까지 일정을 생성해 주세요.`);
        return;
    }

    // 2. 팀 ID 매핑 (DB에서 찾거나 없으면 생성)
    const teamNumberToId: Record<number, string> = {};
    const centerId = tournament.centerId;

    for (const [numStr, info] of Object.entries(IMAGE_TEAM_MAPPING)) {
        const num = parseInt(numStr);
        let team = await prisma.team.findFirst({
            where: { name: info.name, centerId }
        });

        if (!team) {
            console.log(`[생성] 팀 '${info.name}'을 새로 만듭니다.`);
            team = await prisma.team.create({
                data: {
                    name: info.name,
                    centerId,
                    code: `team_${info.name}_${Date.now().toString().slice(-4)}`
                }
            });
        }
        teamNumberToId[num] = team.id;

        // 3. 참가 등록(Registration) 확인 및 생성
        const existingReg = await prisma.tournamentRegistration.findFirst({
            where: { tournamentId: TOURNAMENT_ID, teamId: team.id, squad: info.squad }
        });

        if (!existingReg) {
            console.log(`[등록] ${info.name}(${info.squad || '-'}) 참가 등록 생성`);
            await prisma.tournamentRegistration.create({
                data: {
                    tournamentId: TOURNAMENT_ID,
                    teamId: team.id,
                    squad: info.squad,
                    guestTeamName: info.squad ? `${info.name} ${info.squad}` : info.name,
                    paymentStatus: 'PAID'
                }
            });
        }
    }

    // 4. 대진표 데이터 주입 (Matchups)
    const template = LEAGUE_TEMPLATES[18];
    const totalMatchups = [];

    console.log("대진표 데이터 생성 중...");

    for (let i = 0; i < 17; i++) {
        const round = tournament.leagueRounds[i];
        const roundTemplate = template.rounds[i];

        // 해당 라운드 기존 매치업 삭제
        await prisma.leagueMatchup.deleteMany({ where: { roundId: round.id } });

        for (const m of roundTemplate) {
            const teamAInfo = IMAGE_TEAM_MAPPING[m.teamA];
            const teamBInfo = IMAGE_TEAM_MAPPING[m.teamB];

            totalMatchups.push({
                roundId: round.id,
                teamAId: teamNumberToId[m.teamA],
                teamASquad: teamAInfo.squad,
                teamBId: teamNumberToId[m.teamB],
                teamBSquad: teamBInfo.squad,
                lanes: `${1 + (m.lanePairIndex * 2)}-${2 + (m.lanePairIndex * 2)}`,
                status: 'PENDING'
            });
        }
    }

    // 대량 주입
    await prisma.leagueMatchup.createMany({
        data: totalMatchups
    });

    console.log(`총 ${totalMatchups.length}개의 매치업이 성공적으로 주입되었습니다!`);
    console.log("--- 작업 완료 ---");
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
