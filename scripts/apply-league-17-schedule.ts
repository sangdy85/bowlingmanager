import { PrismaClient } from '@prisma/client';
import { LEAGUE_TEMPLATES } from '../src/lib/league-templates';

/**
 * [제 17차 상주리그 대진표 강제 업데이트 스크립트 - 팀 자동 생성 버전]
 */

const TOURNAMENT_ID_ARG = process.argv[2];

const TEAM_NAME_ORDER = [
    "럭셔리A", "럭셔리B", "마블러스A", "마블러스B", "올앤텐핀A", "올앤텐핀B",
    "볼링몬스터", "볼링사랑", "도토리", "300클럽", "JK", "핀버스터",
    "배볼러A", "배볼러B", "떼굴떼굴A", "떼굴떼굴B", "R&B", "베가"
];

const prisma = new PrismaClient();

async function main() {
    console.log("--- 1. 토너먼트 조회 ---");
    const allSangjuTournaments = await prisma.tournament.findMany({
        where: { name: { contains: "상주" } }
    });

    let targetId = TOURNAMENT_ID_ARG;
    if (!targetId) {
        const autoMatch = allSangjuTournaments.find(t => t.name.includes("17"));
        if (autoMatch) targetId = autoMatch.id;
    }

    if (!targetId) {
        console.error("Error: 적용할 토너먼트 ID를 찾을 수 없습니다.");
        return;
    }

    const tournament = await prisma.tournament.findUnique({
        where: { id: targetId },
        include: { registrations: { include: { team: true } } }
    });

    if (!tournament) {
        console.error("Error: 토너먼트를 찾을 수 없습니다.");
        return;
    }

    console.log(`선택된 토너먼트: ${tournament.name} [${targetId}]`);

    console.log("\n--- 2. 팀 정보 보정 및 자동 등록 ---");
    const teamMap: Record<number, string> = {}; // 슬롯번호 -> Team ID

    for (let i = 0; i < TEAM_NAME_ORDER.length; i++) {
        const teamName = TEAM_NAME_ORDER[i];

        // 2-1. 시스템 전역 팀 테이블에서 해당 이름이 있는지 확인
        let globalTeam = await prisma.team.findFirst({
            where: { name: teamName, centerId: tournament.centerId }
        });

        // 2-2. 만약 "럭셔리A" 같은 이름이 없으면, 자동으로 생성 (이번 리그 대진표 표시를 위해)
        if (!globalTeam) {
            console.log(`Team "${teamName}" 가 시스템에 없어 새로 생성합니다...`);
            // 랜덤 코드 생성 (6자리)
            const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
            globalTeam = await prisma.team.create({
                data: {
                    name: teamName,
                    code: randomCode,
                    centerId: tournament.centerId,
                    isActive: true
                }
            });
        }

        // 2-3. 토너먼트 참가 등록(Registration) 확인
        let reg = tournament.registrations.find((r: any) => r.teamId === globalTeam!.id);

        if (!reg) {
            console.log(`  -> 토너먼트에 "${teamName}" 등록 정보를 생성합니다.`);
            reg = await prisma.tournamentRegistration.create({
                data: {
                    tournamentId: targetId,
                    teamId: globalTeam!.id,
                    paymentStatus: 'PAID'
                }
            });
        }

        teamMap[i + 1] = globalTeam!.id;
    }

    console.log('총 18개 팀(A/B 분리 포함) 전역 등록 및 토너먼트 매핑 완료.');

    console.log("\n--- 3. 대진표 재생성 시작 ---");
    // 기존 데이터 삭제
    await prisma.leagueRound.deleteMany({ where: { tournamentId: targetId } });

    const template = LEAGUE_TEMPLATES[18];
    const startDate = new Date(tournament.startDate);
    const [hours, minutes] = (tournament.leagueTime || "19:30").split(':').map(Number);
    startDate.setHours(hours || 19, minutes || 30, 0, 0);

    for (let i = 0; i < template.rounds.length; i++) {
        const roundTemplate = template.rounds[i];
        const roundDate = new Date(startDate);
        roundDate.setDate(startDate.getDate() + (i * 7));

        const round = await prisma.leagueRound.create({
            data: {
                tournamentId: targetId,
                roundNumber: i + 1,
                date: roundDate
            }
        });

        const matchups = roundTemplate.map(m => ({
            roundId: round.id,
            teamAId: teamMap[m.teamA], // 이제 실제 Team ID가 들어감
            teamBId: teamMap[m.teamB],
            lanes: `${1 + (m.lanePairIndex * 2)}-${2 + (m.lanePairIndex * 2)}`,
            status: 'PENDING'
        }));

        await (prisma as any).leagueMatchup.createMany({ data: matchups });
        console.log(`Round ${i + 1} 생성 성공.`);
    }

    console.log('\n--- 제 17차 상주리그 대진표 수동 업데이트가 완료되었습니다! ---');
    console.log('이제 리그 페이지에서 럭셔리A, 럭셔리B 등의 명칭으로 구성된 대진표를 확인하실 수 있습니다.');
}

main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(async () => { await prisma.$disconnect(); });
