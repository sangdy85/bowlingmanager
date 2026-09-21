import type { PrismaClient } from "@prisma/client";
import prisma from "@/lib/prisma";

export type PersonalStatisticsUser = {
    id: string;
    name: string;
    teamMemberships: { teamId: string; team: { name: string } }[];
};

type StatisticsDatabase = Pick<PrismaClient, "score" | "leagueMatchupIndividualScore" | "tournamentScore">;

/** Active memberships and UTC year boundaries match /personal. */
export async function getPersonalStatisticsData(user: PersonalStatisticsUser, year: number, db: StatisticsDatabase = prisma) {
    // 해당 연도의 시작과 끝 (KST 기준 처리가 필요할 수 있으나, native Date로 간단히 범위 설정)
    const startOfYear = new Date(`${year}-01-01T00:00:00.000Z`);
    const endOfYear = new Date(`${year}-12-31T23:59:59.999Z`);

    // 해당 연도 점수 조회
    const myYearlyScores = await db.score.findMany({
        where: {
            userId: user.id,
            gameDate: {
                gte: startOfYear,
                lte: endOfYear
            }
        },
        include: {
            Team: {
                select: { id: true, name: true }
            }
        },
        orderBy: {
            gameDate: 'desc'
        }
    });

    // --- 추가: 공식 기록 조회 (상주리그 & 대회) ---
    const userTeamIds = user.teamMemberships.map((tm) => tm.teamId);

    // 1. 상주리그 기록
    const currentTeamNames = user.teamMemberships.map((tm) => tm.team.name);

    const leagueScores = await db.leagueMatchupIndividualScore.findMany({
        where: {
            OR: [
                {
                    AND: [
                        { userId: user.id },
                        {
                            OR: [
                                { playerName: null },
                                { playerName: '' },
                                { playerName: { contains: user.name } }
                            ]
                        }
                    ]
                },
                {
                    AND: [
                        { playerName: { contains: user.name } },
                        { teamId: { in: userTeamIds } }
                    ]
                },
                {
                    AND: [
                        { playerName: { contains: user.name } },
                        { Team: { name: { in: currentTeamNames } } }
                    ]
                }
            ],
            LeagueMatchup: {
                round: {
                    date: {
                        gte: startOfYear,
                        lte: endOfYear
                    }
                }
            }
        },
        include: {
            Team: { select: { name: true } },
            LeagueMatchup: {
                include: {
                    round: {
                        include: { tournament: { select: { name: true, type: true } } }
                    }
                }
            }
        }
    });

    // 2. 대회 기록 (챔프전/이벤트전)
    const tournamentScores = await db.tournamentScore.findMany({
        where: {
            OR: [
                {
                    AND: [
                        { registration: { userId: user.id } },
                        {
                            OR: [
                                { registration: { guestName: null } },
                                { registration: { guestName: '' } },
                                { registration: { guestName: { contains: user.name } } }
                            ]
                        }
                    ]
                },
                {
                    AND: [
                        { registration: { guestName: { contains: user.name } } },
                        { registration: { teamId: { in: userTeamIds } } }
                    ]
                },
                {
                    AND: [
                        { registration: { guestName: { contains: user.name } } },
                        { registration: { guestTeamName: { in: currentTeamNames } } }
                    ]
                }
            ],
            round: {
                date: {
                    gte: startOfYear,
                    lte: endOfYear
                }
            }
        },
        include: {
            registration: {
                include: {
                    tournament: { select: { name: true, type: true } },
                    team: { select: { name: true } }
                }
            },
            round: true
        }
    });

    // Preserve the web's stored scores and handicaps, including values above 300.
    const personalRecords: IntegratedRecord[] = myYearlyScores
        .filter(s => s.gameType !== "벙개")
        .map(s => ({
            id: `PERSONAL:${s.id}`, source: "PERSONAL", score: s.score,
            gameDate: s.gameDate, gameType: s.gameType, memo: s.memo, team: s.Team,
        }));
    const officialRecords: IntegratedRecord[] = [
        ...leagueScores.flatMap(ls =>
            [ls.score1, ls.score2, ls.score3].flatMap((score, index): IntegratedRecord[] =>
                score > 0 ? [{
                    id: `LEAGUE:${ls.id}:${index + 1}`, source: "LEAGUE",
                    score: score + (ls.handicap || 0),
                    gameDate: ls.LeagueMatchup.round.date || ls.createdAt,
                    gameType: "상주리그", memo: null,
                    team: { id: ls.teamId, name: ls.Team.name },
                }] : [],
            ),
        ),
        ...tournamentScores.map((ts): IntegratedRecord => ({
            id: `TOURNAMENT:${ts.id}`, source: "TOURNAMENT",
            score: ts.score + (ts.registration.handicap || 0),
            gameDate: ts.round?.date || ts.createdAt,
            gameType: ts.registration.tournament.type === "EVENT" ? "이벤트전" : "챔프전",
            memo: null,
            // Guest-only team names have no stable team ID.
            team: ts.registration.team && ts.registration.teamId
                ? { id: ts.registration.teamId, name: ts.registration.team.name } : null,
        })),
    ];
    return {
        myYearlyScores, leagueScores, tournamentScores,
        startOfYear, endOfYear, userTeamIds, officialRecords,
        integratedRecords: [...personalRecords, ...officialRecords],
    };
}

export type IntegratedRecord = {
    id: string;
    source: "PERSONAL" | "LEAGUE" | "TOURNAMENT";
    score: number;
    gameDate: Date;
    gameType: string | null;
    memo: string | null;
    team: { id: string; name: string } | null;
};

export function summarizeIntegratedRecords(records: IntegratedRecord[], year: number) {
    const total = records.reduce((sum, record) => sum + record.score, 0);
    const recentScores = [...records].sort((a, b) =>
        b.gameDate.getTime() - a.gameDate.getTime()
        || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    ).slice(0, 10);
    const recentTotal = recentScores.reduce((sum, record) => sum + record.score, 0);
    return {
        year,
        // Match StatsDisplayRow's JS toFixed rounding, not Math.round.
        average: records.length ? Number((total / records.length).toFixed(1)) : 0,
        highScore: records.length
            ? records.reduce((max, record) => Math.max(max, record.score), records[0].score) : 0,
        gameCount: records.length,
        recentScores,
        recentAverage: recentScores.length
            ? Number((recentTotal / recentScores.length).toFixed(1)) : 0,
    };
}
