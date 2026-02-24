'use client';

import { useMemo, forwardRef, useImperativeHandle, useRef } from 'react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { toPng } from 'html-to-image';

interface Score {
    registrationId: string;
    gameNumber: number;
    score: number;
    registration: {
        handicap: number;
    };
}

interface Participant {
    registrationId: string;
    isFemaleChamp?: boolean;
    registration: {
        id: string;
        handicap: number;
        user?: { name: string };
        guestName?: string;
        team?: { name: string };
        guestTeamName?: string;
    };
}

interface Round {
    id: string;
    roundNumber: number;
    participants: Participant[];
    individualScores: Score[];
}

interface GrandFinaleCumulativeManagerProps {
    tournament: {
        registrations: any[];
        leagueRounds: Round[];
        settings?: string;
    };
    centerId: string;
    isManager: boolean;
}

export interface GrandFinaleCumulativeRef {
    downloadExcel: () => void;
    downloadImage: () => void;
}

const GrandFinaleCumulativeManager = forwardRef<GrandFinaleCumulativeRef, GrandFinaleCumulativeManagerProps>(
    ({ tournament, centerId, isManager }, ref) => {
        const mainRef = useRef<HTMLDivElement>(null);

        const pointConfig = useMemo(() => {
            if (!tournament || !tournament.settings) return {};
            try {
                const s = JSON.parse(tournament.settings);
                return s.grandFinalePoints || {};
            } catch {
                return {};
            }
        }, [tournament.settings]);

        const finishedRounds = useMemo(() => {
            if (!tournament) return [];
            return (tournament.leagueRounds || []).filter(r => r.individualScores && r.individualScores.length > 0);
        }, [tournament?.leagueRounds]);

        const participants = tournament?.registrations || [];

        // Generate the cumulative list
        const cumulativeList = useMemo(() => {
            const normalize = (str: string) => (str || '').trim().replace(/\s+/g, ' ');

            // 1. Calculate results for each round independently (Round-First)
            const roundResults = finishedRounds.map(round => {
                const roundAggregatedMap = new Map<string, {
                    totalRaw: number,
                    handicap: number,
                    isFemaleChamp: boolean,
                    userName: string,
                    teamName: string,
                    registrationIds: Set<string>
                }>();

                // Build mapping of registrationId to metadata for this round
                const regMeta = new Map<string, { handicap: number, isFemaleChamp: boolean }>();
                round.participants?.forEach((p: any) => {
                    regMeta.set(p.registrationId, {
                        handicap: p.registration?.handicap || 0,
                        isFemaleChamp: p.isFemaleChamp || false
                    });
                });

                // Group score entries by (Normalized Team | Name)
                round.individualScores.forEach((s: any) => {
                    const reg = s.registration;
                    const teamName = normalize(reg?.guestTeamName || reg?.team?.name || '-');
                    const userName = normalize(reg?.user?.name || reg?.guestName);
                    const key = `${teamName}|${userName}`;

                    const meta = regMeta.get(s.registrationId) || { handicap: reg?.handicap || 0, isFemaleChamp: false };

                    if (!roundAggregatedMap.has(key)) {
                        roundAggregatedMap.set(key, {
                            totalRaw: 0,
                            handicap: meta.handicap,
                            isFemaleChamp: meta.isFemaleChamp,
                            userName,
                            teamName,
                            registrationIds: new Set([s.registrationId])
                        });
                    }
                    roundAggregatedMap.get(key)!.totalRaw += (s.score || 0);
                    roundAggregatedMap.get(key)!.registrationIds.add(s.registrationId);
                });

                // Convert to ranking sorted list for this round
                const roundRankings = Array.from(roundAggregatedMap.entries()).map(([key, data]) => {
                    // Note: We use 3 games as standard for grand finale total
                    const totalWithHandicap = data.totalRaw + (data.handicap * 3);
                    return {
                        key,
                        totalWithHandicap,
                        ...data
                    };
                }).sort((a, b) => b.totalWithHandicap - a.totalWithHandicap);

                return roundRankings;
            });

            // 2. Global Aggregation across all rounds
            const globalAggregatedMap = new Map<string, any>();

            roundResults.forEach(roundRankings => {
                roundRankings.forEach((entry, index) => {
                    const key = entry.key;
                    const rank = index + 1;

                    if (!globalAggregatedMap.has(key)) {
                        globalAggregatedMap.set(key, {
                            userName: entry.userName,
                            teamName: entry.teamName,
                            totalPoints: 0,
                            participationCount: 0,
                            cumulativeScore: 0,
                            awardCount: 0
                        });
                    }

                    const global = globalAggregatedMap.get(key);
                    global.participationCount += 1;
                    global.cumulativeScore += entry.totalWithHandicap;

                    // Calculate Points for this round
                    let points = 0;
                    if (entry.isFemaleChamp) {
                        points = (pointConfig['female'] || 0);
                    } else {
                        points = pointConfig[rank.toString()] || 0;
                    }
                    global.totalPoints += points;

                    // Calculate Award for this round
                    if (rank >= 1 && rank <= 3 || entry.isFemaleChamp) {
                        global.awardCount += 1;
                    }
                });
            });

            const aggregatedList = Array.from(globalAggregatedMap.values()).filter(p => p.participationCount > 0);

            // Sorting: 1. Points, 2. Participation, 3. Cumulative
            return aggregatedList.sort((a, b) => {
                if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
                if (b.participationCount !== a.participationCount) return b.participationCount - a.participationCount;
                return b.cumulativeScore - a.cumulativeScore;
            });
        }, [finishedRounds, pointConfig]);

        const getAwardStars = (count: number) => {
            const bigStars = Math.floor(count / 5);
            const smallStars = count % 5;
            return (
                <div className="flex items-center gap-0.5 justify-center">
                    {Array.from({ length: bigStars }).map((_, i) => (
                        <span key={`big-${i}`} className="text-yellow-500 text-xl drop-shadow-sm">★</span>
                    ))}
                    {Array.from({ length: smallStars }).map((_, i) => (
                        <span key={`small-${i}`} className="text-yellow-400/60 text-lg">☆</span>
                    ))}
                </div>
            );
        };

        const handleDownloadExcel = () => {
            const data = cumulativeList.map((p, idx) => ({
                '순위': idx + 1,
                '팀명': p.teamName,
                '성함': p.userName,
                '종합 포인트': p.totalPoints,
                '참여횟수': p.participationCount,
                '누적 점수': p.cumulativeScore,
                '입상 횟수': p.awardCount
            }));

            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Grand Finale Leaderboard");

            const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            const finalData = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });
            saveAs(finalData, `leaderboard_${new Date().toISOString().split('T')[0]}.xlsx`);
        };

        const handleDownloadImage = async () => {
            if (mainRef.current === null) return;
            try {
                const dataUrl = await toPng(mainRef.current, { backgroundColor: '#ffffff', quality: 1 });
                saveAs(dataUrl, `leaderboard_${new Date().toISOString().split('T')[0]}.png`);
            } catch (err) {
                console.error('oops, something went wrong!', err);
            }
        };

        useImperativeHandle(ref, () => ({
            downloadExcel: handleDownloadExcel,
            downloadImage: handleDownloadImage,
        }));

        return (
            <div
                ref={mainRef}
                style={{ display: 'flex', flexDirection: 'column', gap: '24px', animation: 'fadeIn 0.5s ease-in-out', backgroundColor: '#ffffff', padding: '16px' }}
                className="animate-in fade-in duration-500"
            >
                {/* Legend / Info Bar */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '16px',
                    padding: '16px',
                    backgroundColor: '#ffffff',
                    border: '3px solid #000000',
                    color: '#000000',
                    fontWeight: 'bold'
                }} className="md:flex-row items-center">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '14px' }}>
                        <span style={{ backgroundColor: '#000000', color: '#ffffff', padding: '4px 12px', fontWeight: '900', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.1em' }}>Ranking Policy</span>
                        <div style={{ fontStyle: 'italic' }}>
                            1. 포인트 &rarr; 2. 참여횟수 &rarr; 3. 누적점수
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', fontSize: '14px', fontWeight: '900' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '20px' }}>☆</span>
                                <span style={{ textTransform: 'uppercase' }}>입상 1회</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '20px', color: '#ca8a04' }}>★</span>
                                <span style={{ textTransform: 'uppercase' }}>입상 5회</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{
                    backgroundColor: '#ffffff',
                    border: '3px solid #000000',
                    boxShadow: '12px 12px 0px 0px #000000',
                    overflow: 'hidden'
                }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table className="excel-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '80px' }}>순위</th>
                                    <th style={{ width: '15.33%' }}>팀명</th>
                                    <th style={{ width: '15.33%' }}>성함</th>
                                    <th style={{ width: '15.33%' }}>종합 포인트</th>
                                    <th style={{ width: '15.33%' }}>참여횟수</th>
                                    <th style={{ width: '15.33%' }}>누적 점수</th>
                                    <th style={{ width: '15.33%' }}>입상</th>
                                </tr>
                            </thead>
                            <tbody>
                                {cumulativeList.map((p, idx) => {
                                    const compositeKey = `${p.teamName}|${p.userName}|${idx}`;
                                    return (
                                        <tr key={compositeKey}>
                                            <td className="rank-cell">
                                                {idx + 1}
                                            </td>
                                            <td>
                                                {p.teamName}
                                            </td>
                                            <td>
                                                {p.userName}
                                            </td>
                                            <td className="points-cell">
                                                {p.totalPoints}
                                            </td>
                                            <td>
                                                {p.participationCount}
                                            </td>
                                            <td>
                                                {p.cumulativeScore.toLocaleString()}
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px', scale: '1.25' }}>
                                                    {getAwardStars(p.awardCount)}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {cumulativeList.length === 0 && (
                        <div style={{
                            padding: '80px 0',
                            textAlign: 'center',
                            backgroundColor: '#ffffff',
                            borderTop: '3px solid #000000',
                            fontWeight: '900',
                            color: '#d1d5db',
                            fontSize: '24px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.2em',
                            fontStyle: 'italic'
                        }}>
                            No Data Available
                        </div>
                    )}
                </div>
            </div>
        );
    }
);

GrandFinaleCumulativeManager.displayName = 'GrandFinaleCumulativeManager';

export default GrandFinaleCumulativeManager;
