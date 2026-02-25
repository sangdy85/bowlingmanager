import { PrismaClient } from '@prisma/client';
import { LEAGUE_TEMPLATES } from '../src/lib/league-templates';

/**
 * [제 17차 상주리그 대진표 강제 업데이트 스크립트 - 진단 버전]
 */

const TOURNAMENT_ID_ARG = process.argv[2];

const TEAM_NAME_ORDER = [
    "럭셔리A", "럭셔리B", "마블러스A", "마블러스B", "올앤텐핀A", "올앤텐핀B",
    "볼링몬스터", "볼링사랑", "도토리", "300클럽", "JK", "핀버스터",
    "배볼러A", "배볼러B", "떼굴떼굴A", "떼굴떼굴B", "R&B", "베가"
];

const prisma = new PrismaClient();

async function main() {
    console.log("--- 1. 토너먼트 목록 진단 ---");
    const allSangjuTournaments = await prisma.tournament.findMany({
        where: { name: { contains: "상주" } },
        include: { _count: { select: { registrations: true } } }
    });

    console.log(`Found ${allSangjuTournaments.length} tournaments containing "상주":`);
    allSangjuTournaments.forEach(t => {
        console.log(`- ID: ${t.id} | Name: ${t.name} | Registrations: ${(t as any)._count.registrations}`);
    });

    let targetId = TOURNAMENT_ID_ARG;
    if (!targetId) {
        // 자동으로 "17"이 포함된 가장 최근 토너먼트 선택
        const autoMatch = allSangjuTournaments.find(t => t.name.includes("17"));
        if (autoMatch) targetId = autoMatch.id;
    }

    if (!targetId) {
        console.error("\nError: 적용할 토너먼트 ID를 찾을 수 없습니다.");
        console.log("위 목록에서 ID를 복사하여 다음과 같이 실행하세요:");
        console.log("npx tsx scripts/apply-league-17-schedule.ts <TournamentId>");
        return;
    }

    console.log(`\n--- 2. 선택된 토너먼트 상세 조회 [${targetId}] ---`);
    const tournament = await prisma.tournament.findUnique({
        where: { id: targetId },
        include: {
            registrations: {
                include: { team: true, user: true }
            }
        }
    });

    if (!tournament) {
        console.error("Error: 해당 ID의 토너먼트를 찾을 수 없습니다.");
        return;
    }

    console.log(`Target Tournament: ${tournament.name}`);
    console.log(`Total Registrations Found: ${tournament.registrations.length}`);

    if (tournament.registrations.length === 0) {
        console.error("Error: 이 토너먼트에 등록된 팀이 하나도 없습니다.");
        console.log("먼저 '참가자 명단' 메뉴에서 18개 팀을 등록해 주세요.");
        return;
    }

    // 샘플 데이터 출력 (디버깅용)
    console.log("\n--- 3. 참가 등록 데이터 샘플 (첫 3개) ---");
    tournament.registrations.slice(0, 3).forEach((r, idx) => {
        console.log(`[Reg ${idx + 1}] ID: ${r.id}`);
        console.log(`  - guestName: ${r.guestName}`);
        console.log(`  - guestTeamName: ${r.guestTeamName}`);
        console.log(`  - team.name: ${r.team?.name}`);
        console.log(`  - user.name: ${r.user?.name}`);
    });

    // 팀 매핑
    console.log("\n--- 4. 팀 이름 매핑 시작 ---");
    const teamMap: Record<number, string> = {};
    for (let i = 0; i < TEAM_NAME_ORDER.length; i++) {
        const teamName = TEAM_NAME_ORDER[i];
        const reg = tournament.registrations.find((r: any) =>
            r.guestName === teamName ||
            r.guestTeamName === teamName ||
            (r as any).playerName === teamName ||
            (r.team && r.team.name === teamName) ||
            (r.user && r.user.name === teamName)
        );

        if (!reg) {
            console.error(`Error: Team "${teamName}" 을(를) 찾을 수 없습니다.`);
            const available = tournament.registrations.map((r: any) =>
                r.guestName || r.guestTeamName || r.team?.name || r.user?.name
            ).filter(Boolean);
            console.log('현재 등록 완료된 팀 목록:', available);
            return;
        }
        teamMap[i + 1] = reg.id;
    }

    console.log('모든 18개 팀 매핑 성공!');

    // 기존 대진표 삭제 및 재생성
    console.log("\n--- 5. 대진표 재생성 시작 ---");
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
            teamAId: teamMap[m.teamA],
            teamBId: teamMap[m.teamB],
            lanes: `${1 + (m.lanePairIndex * 2)}-${2 + (m.lanePairIndex * 2)}`,
            status: 'PENDING'
        }));

        await (prisma as any).leagueMatchup.createMany({ data: matchups });
        console.log(`Round ${i + 1} 생성 완료.`);
    }

    console.log('\n--- 모든 작업이 성공적으로 완료되었습니다! ---');
}

main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(async () => { await prisma.$disconnect(); });
