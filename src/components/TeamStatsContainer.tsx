'use client';

import { useState, useMemo } from 'react';
import TeamYearlyStats, { GAME_TYPES } from './TeamYearlyStats';
import DailyScoreTable from './DailyScoreTable';

interface ScoreWithUser {
    id: string;
    score: number;
    gameDate: Date;
    userId: string | null;
    user: {
        name: string | null;
    } | null;
    gameType?: string | null;
    guestName?: string | null;
    memo?: string | null;
}

interface TeamStatsContainerProps {
    scores: ScoreWithUser[];
    currentYear: number;
    teamName: string;
    isOwner: boolean;
    isManager: boolean;
    teamId: string;
    ownerId?: string | null;
    managerIds?: string[];
    members?: { id: string; name: string }[];
}

export default function TeamStatsContainer({ scores, currentYear, teamName, isOwner, isManager, teamId, ownerId, managerIds, members = [] }: TeamStatsContainerProps) {
    const [selectedTypes, setSelectedTypes] = useState<string[]>(["정기전"]);

    const toggleType = (type: string) => {
        setSelectedTypes(prev =>
            prev.includes(type)
                ? prev.filter(t => t !== type)
                : [...prev, type]
        );
    };

    // Filter scores based on selected game types
    const filteredScores = useMemo(() => {
        return scores.filter(s => {
            const gType = s.gameType || '기타';
            return selectedTypes.includes(gType);
        });
    }, [scores, selectedTypes]);

    // Grouping Logic for Activity Log
    const kstOffset = 9 * 60 * 60 * 1000;

    interface DailyScoreGroup {
        scores: ScoreWithUser[];
        total: number;
        count: number;
    }
    const groupedScores: { [date: string]: DailyScoreGroup } = {};

    filteredScores.forEach(score => {
        // Handle date string conversion safely
        const d = new Date(score.gameDate);
        const scoreDate = new Date(d.getTime() + kstOffset);
        const dateStr = scoreDate.toISOString().split('T')[0];

        if (!groupedScores[dateStr]) {
            groupedScores[dateStr] = { scores: [], total: 0, count: 0 };
        }

        groupedScores[dateStr].scores.push(score);
        groupedScores[dateStr].total += score.score;
        groupedScores[dateStr].count++;
    });

    const sortedDates = Object.keys(groupedScores).sort((a, b) => b.localeCompare(a));

    // Ace Calculation
    const aceUserId = useMemo(() => {
        // 1. Filter Regular Games
        const regularScores = scores.filter(s => s.gameType === '정기전');
        if (regularScores.length === 0) return null;

        // 2. Identify Total Regular Game Dates
        const regularGameDates = new Set(
            regularScores.map(s => new Date(s.gameDate).toISOString().split('T')[0])
        );
        const totalRegularDays = regularGameDates.size;
        if (totalRegularDays === 0) return null;

        // 3. Group by User
        const userStats: { [userId: string]: { totalScore: number; attendedDates: Set<string> } } = {};

        regularScores.forEach(s => {
            if (!s.userId) return; // Skip guests for Ace badge

            if (!userStats[s.userId]) {
                userStats[s.userId] = { totalScore: 0, attendedDates: new Set() };
            }

            userStats[s.userId].totalScore += s.score;
            userStats[s.userId].attendedDates.add(new Date(s.gameDate).toISOString().split('T')[0]);
        });

        // 4. Calculate Stats and Find Ace
        let currentAceId: string | null = null;
        let maxAvg = -1;

        Object.entries(userStats).forEach(([userId, stat]) => {
            const attendanceRate = stat.attendedDates.size / totalRegularDays;

            // Criteria: Attendance >= 75%
            if (attendanceRate >= 0.75) {
                // Calculate Average based on total score / count of scores (not days, unless intended otherwise)
                // Need total count of games played by user.
                // Re-calculating game count for this user
                const userGameCount = regularScores.filter(s => s.userId === userId).length;
                const avg = stat.totalScore / userGameCount;

                if (avg > maxAvg) {
                    maxAvg = avg;
                    currentAceId = userId;
                }
            }
        });

        return currentAceId;
    }, [scores]);

    // Recent Game Rankings Calculation
    const recentRankings = useMemo(() => {
        // 1. Filter for Ranking Candidates (Regular or Inter-league)
        const rankingScores = scores.filter(s => s.gameType === '정기전' || s.gameType === '교류전');
        if (rankingScores.length === 0) return {};

        // 2. Find Most Recent Date
        const sortedDates = Array.from(new Set(rankingScores.map(s => s.gameDate.getTime()))).sort((a, b) => b - a);
        if (sortedDates.length === 0) return {};
        const mostRecentDateStr = new Date(sortedDates[0]).toISOString().split('T')[0];

        // 3. Filter Scores for Recent Date
        const targetScores = rankingScores.filter(s => new Date(s.gameDate).toISOString().split('T')[0] === mostRecentDateStr);

        // 4. Calculate Averages
        const userAverages: { userId: string; avg: number }[] = [];
        const userGroups: { [userId: string]: { total: number; count: number } } = {};

        targetScores.forEach(s => {
            if (!s.userId) return; // Skip guests
            if (!userGroups[s.userId]) userGroups[s.userId] = { total: 0, count: 0 };
            userGroups[s.userId].total += s.score;
            userGroups[s.userId].count++;
        });

        Object.entries(userGroups).forEach(([userId, data]) => {
            userAverages.push({ userId, avg: data.total / data.count });
        });

        // 5. Sort Descending
        userAverages.sort((a, b) => b.avg - a.avg);

        // 6. Assign Ranks
        const rankings: { [rank: number]: string } = {};
        if (userAverages.length > 0) rankings[1] = userAverages[0].userId;
        if (userAverages.length > 1) rankings[2] = userAverages[1].userId;
        if (userAverages.length > 2) rankings[3] = userAverages[2].userId;

        return rankings;
    }, [scores]);

    return (
        <>
            <div className="mb-12">
                <TeamYearlyStats
                    scores={filteredScores}
                    currentYear={currentYear}
                    teamName={teamName}
                    selectedTypes={selectedTypes}
                    onToggleType={toggleType}
                    ownerId={ownerId}
                    managerIds={managerIds}
                    aceUserId={aceUserId}
                    recentRankings={recentRankings}
                    members={members}
                />
            </div>

            <div className="mt-32">
                <h2 className="text-xl font-bold border-b pb-2 mb-10">팀 활동 일지</h2>
                {sortedDates.length === 0 ? (
                    <div className="text-center py-12 card text-secondary-foreground">
                        선택된 게임 분류에 해당하는 기록이 없습니다.
                    </div>
                ) : (
                    sortedDates.map(date => {
                        const dailyInfo = groupedScores[date];
                        const dailyAvg = dailyInfo.count > 0 ? (dailyInfo.total / dailyInfo.count).toFixed(1) : "0";
                        const memo = dailyInfo.scores.find(s => s.memo)?.memo || undefined;
                        const gameType = dailyInfo.scores.find(s => s.gameType)?.gameType || undefined;

                        return (
                            <div key={date} className="w-full" style={{ marginBottom: '50px' }}>
                                <DailyScoreTable
                                    scores={dailyInfo.scores}
                                    date={date}
                                    dailyAvg={dailyAvg}
                                    memo={memo}
                                    gameType={gameType}
                                    isOwner={isOwner}
                                    isManager={isManager}
                                    teamId={teamId}
                                    members={members}
                                />
                            </div>
                        );
                    })
                )}
            </div>
        </>
    );
}
