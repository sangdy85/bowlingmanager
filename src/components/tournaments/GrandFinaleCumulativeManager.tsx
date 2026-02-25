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

        const cumulativeList = useMemo(() => {
            const settings = tournament.settings ? JSON.parse(tournament.settings) : {};
            const femaleBonus = pointConfig['female'] || 20;
            const gameCount = settings.gameCount || 3;

            // Sort by roundNumber for sequential calculation of penalties
            const sortedRounds = [...finishedRounds].sort((a, b) => a.roundNumber - b.roundNumber);

            let prevWinners: any = {};
            const roundResults = [];

            for (const round of sortedRounds) {
                const roundHandicaps = settings.roundMinusHandicaps?.[round.roundNumber] || {
                    rank1: settings.minusHandicapRank1 || 0,
                    rank2: settings.minusHandicapRank2 || 0,
                    rank3: settings.minusHandicapRank3 || 0,
                    female: settings.minusHandicapFemale || 0
                };

                const rankings = (round.participants || []).map((p: any) => {
                    const regId = p.registrationId;
                    const scores = (round.individualScores || []).filter(s => s.registrationId === regId);

                    const scoreList: number[] = [];
                    let totalRaw = 0;
                    let gamesPlayed = 0;
                    for (let g = 1; g <= gameCount; g++) {
                        const s = scores.find(sc => sc.gameNumber === g)?.score || 0;
                        scoreList.push(s);
                        totalRaw += s;
                        if (s > 0) gamesPlayed++;
                    }

                    const handicap = p.registration?.handicap || 0;
                    const pName = p.registration?.user?.name || p.registration?.guestName || 'GUEST';
                    const pTeam = p.registration?.guestTeamName || p.registration?.team?.name || '개인';

                    let minusApplied = 0;
                    let rankCap = 0;
                    if (gamesPlayed === gameCount) {
                        const matchWinner = (winner: any) => winner && winner.name === pName && winner.team === pTeam;
                        if (matchWinner(prevWinners.rank1)) {
                            minusApplied += Math.abs(roundHandicaps.rank1);
                            rankCap = Math.abs(roundHandicaps.rank1);
                        } else if (matchWinner(prevWinners.rank2)) {
                            minusApplied += Math.abs(roundHandicaps.rank2);
                            rankCap = Math.abs(roundHandicaps.rank2);
                        } else if (matchWinner(prevWinners.rank3)) {
                            minusApplied += Math.abs(roundHandicaps.rank3);
                            rankCap = Math.abs(roundHandicaps.rank3);
                        }
                        if (matchWinner(prevWinners.femaleChamp)) {
                            minusApplied += Math.abs(roundHandicaps.female);
                            if (rankCap === 0) rankCap = Math.abs(roundHandicaps.female);
                        }
                        if (minusApplied > rankCap && rankCap > 0) minusApplied = rankCap;
                    }

                    const manualPenaltyTotal = handicap < 0 ? Math.abs(handicap) : 0;
                    const finalPenaltyTotal = Math.max(manualPenaltyTotal, minusApplied);
                    const positiveHandicapTotal = (handicap > 0 ? handicap : 0) * gamesPlayed;
                    const finalHandicapValue = positiveHandicapTotal - finalPenaltyTotal;
                    const totalWithHandicap = totalRaw + finalHandicapValue;

                    const validScores = scoreList.filter(s => s > 0);
                    const hiLow = validScores.length > 1 ? (Math.max(...validScores) - Math.min(...validScores)) : 0;

                    return {
                        id: regId,
                        userName: pName,
                        teamName: pTeam,
                        totalWithHandicap,
                        handicapEach: handicap,
                        hiLow,
                        isFemaleChamp: p.isFemaleChamp || false,
                        hasScore: totalRaw > 0
                    };
                })
                    .filter(entry => entry.hasScore)
                    .sort((a, b) => {
                        if (b.totalWithHandicap !== a.totalWithHandicap) return b.totalWithHandicap - a.totalWithHandicap;
                        const handicapA = a.handicapEach || 0;
                        const handicapB = b.handicapEach || 0;
                        if (handicapA !== handicapB) return handicapA - handicapB;
                        return a.hiLow - b.hiLow;
                    });

                roundResults.push(rankings);

                // Extract winners for the next round's penalty calculation
                prevWinners = {};
                if (rankings.length > 0) prevWinners.rank1 = { name: rankings[0].userName, team: rankings[0].teamName };
                if (rankings.length > 1) prevWinners.rank2 = { name: rankings[1].userName, team: rankings[1].teamName };
                if (rankings.length > 2) prevWinners.rank3 = { name: rankings[2].userName, team: rankings[2].teamName };
                const femaleWinner = rankings.find(r => r.isFemaleChamp);
                if (femaleWinner) prevWinners.femaleChamp = { name: femaleWinner.userName, team: femaleWinner.teamName };
            }

            // 2. Global Aggregation across all rounds (Strict String Match)
            const globalAggregatedMap = new Map<string, any>();

            roundResults.forEach(roundRankings => {
                roundRankings.forEach((entry, index) => {
                    const key = `${entry.teamName}|${entry.userName}`;
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

                    const rankPoints = entry.isFemaleChamp ? 0 : (pointConfig[rank.toString()] || 0);
                    const bonusPoints = entry.isFemaleChamp ? femaleBonus : 0;
                    global.totalPoints += (rankPoints + bonusPoints);

                    if (rank <= 3 || entry.isFemaleChamp) {
                        global.awardCount += 1;
                    }
                });
            });

            const aggregatedList = Array.from(globalAggregatedMap.values());

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
                <div style={{ display: 'flex', alignItems: 'center', gap: '2px', justifyContent: 'center' }}>
                    {Array.from({ length: bigStars }).map((_, i) => (
                        <span key={`big-${i}`} style={{ color: '#000000', fontSize: '20px' }}>★</span>
                    ))}
                    {Array.from({ length: smallStars }).map((_, i) => (
                        <span key={`small-${i}`} style={{ color: '#000000', fontSize: '18px', opacity: 0.6 }}>☆</span>
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
                style={{ display: 'flex', flexDirection: 'column', gap: '24px', backgroundColor: '#ffffff', padding: '16px', color: '#000000' }}
            >
                <style dangerouslySetInnerHTML={{
                    __html: `
                    .excel-table { border-collapse: collapse !important; width: 100% !important; background-color: white !important; color: black !important; table-layout: fixed !important; }
                    .excel-table th, .excel-table td { border: 2px solid black !important; padding: 14px 8px !important; text-align: center !important; color: black !important; overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important; font-size: 18px !important; font-weight: 900 !important; }
                    .excel-table th { background-color: #d9ead3 !important; }
                    .excel-table td { background-color: white !important; }
                    .excel-table .rank-cell { background-color: #f0f0f0 !important; }
                    .excel-table .points-cell { color: #dc2626 !important; }
                `}} />
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
                                <span style={{ fontSize: '20px', color: '#000000' }}>★</span>
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
