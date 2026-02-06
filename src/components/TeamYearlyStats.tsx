'use client';

import { useState, useMemo } from 'react';

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
}

interface TeamYearlyStatsProps {
    scores: ScoreWithUser[];
    currentYear: number;
    teamName: string;
    selectedTypes: string[];
    onToggleType: (type: string) => void;
    ownerId?: string | null;
    managerIds?: string[];
    aceUserId?: string | null;
    recentRankings?: { [rank: number]: string };
    members?: { id: string; name: string }[]; // members with aliases
}

export const GAME_TYPES = ["정기전", "벙개", "상주", "교류전", "기타"];

export default function TeamYearlyStats({ scores, currentYear, teamName, selectedTypes, onToggleType, ownerId, managerIds, aceUserId, recentRankings, members = [] }: TeamYearlyStatsProps) {
    // scores is already filtered by parent container
    const filteredScores = scores;

    // Create a map for quick member name lookup
    const memberNameMap = useMemo(() => {
        const map = new Map<string, string>();
        members.forEach(m => map.set(m.id, m.name));
        return map;
    }, [members]);


    // 1. Data Processing with filteredScores
    // Group by Date to calculate "Standard Total Games" (Max games played by anyone on that day)
    const gamesByDate: { [dateStr: string]: { [userId: string]: number } } = {};
    const userStats: {
        [userId: string]: {
            name: string;
            totalGames: number;
            totalScore: number;
            monthlyScores: { [month: number]: { total: number; count: number } };
        }
    } = {};

    filteredScores.forEach(score => {
        const dateStr = new Date(score.gameDate).toISOString().split('T')[0];
        const month = new Date(score.gameDate).getMonth(); // 0-11

        // Track games per day for participation denominator
        // IMPORTANT: Participation denominator should probably be based on filtered games too?
        // Yes, if I only want to see "Regular" stats, participation should be relative to Regular games.
        if (!gamesByDate[dateStr]) gamesByDate[dateStr] = {};

        if (!score.userId) return; // Guest Exclusion: Skip scores without userId

        const key = score.userId;
        // For participation calc, we treat guests individually if needed, or exclude?
        // Usually stats are for members. But let's show guests too if they have enough data.
        // Participation denominator might be tricky for guests (they aren't expected to attend).

        gamesByDate[dateStr][key] = (gamesByDate[dateStr][key] || 0) + 1;

        // User Aggregation
        if (!userStats[key]) {
            // Use alias from member map if available, fallback to user.name
            const name = memberNameMap.get(score.userId) || score.user?.name || '알 수 없음';

            userStats[key] = {
                name: name,
                totalGames: 0,
                totalScore: 0,
                monthlyScores: {}
            };
        }

        const stats = userStats[key];
        stats.totalGames++;
        stats.totalScore += score.score;

        if (!stats.monthlyScores[month]) {
            stats.monthlyScores[month] = { total: 0, count: 0 };
        }
        stats.monthlyScores[month].total += score.score;
        stats.monthlyScores[month].count++;
    });

    // 2. Count Total Active Days (Global filtered days)
    const activeDates = Object.keys(gamesByDate);
    const totalActiveDays = activeDates.length;

    // Prepare Rows with Raw Data for Sorting
    const rows = Object.entries(userStats).map(([userId, stat]) => {
        const avgRaw = stat.totalGames > 0 ? (stat.totalScore / stat.totalGames) : 0;

        // Calculate user's attended days
        // Efficient way: filter filteredScores for this userId and count distinct dates
        // Or better: accumulate this during the initial loop?
        // Let's recount for simplicity code-wise, optimization later if needed.
        const userUniqueDates = new Set(
            filteredScores
                .filter(s => s.userId === userId)
                .map(s => new Date(s.gameDate).toISOString().split('T')[0])
        );
        const userAttendedDays = userUniqueDates.size;

        const participationRaw = totalActiveDays > 0 ? (userAttendedDays / totalActiveDays) : 0;
        const participationDisplay = (participationRaw * 100).toFixed(1) + "%";
        const participationDetail = `(${userAttendedDays}/${totalActiveDays})`;

        return {
            userId, // Pass userId for rendering check
            name: stat.name,
            participationRaw,
            participationDisplay,
            participationDetail,
            games: stat.totalGames,
            total: stat.totalScore,
            avgRaw,
            avg: avgRaw.toFixed(1),
            monthlyAvgs: Array.from({ length: 12 }, (_, i) => {
                const m = stat.monthlyScores[i];
                return m ? Math.round(m.total / m.count) : null;
            })
        };
    });

    // Sorting State
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
        key: 'participation',
        direction: 'desc'
    });

    const handleSort = (key: string) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    // Sort Rows
    rows.sort((a, b) => {
        const { key, direction } = sortConfig;
        const multiplier = direction === 'asc' ? 1 : -1;

        switch (key) {
            case 'name':
                return a.name.localeCompare(b.name) * multiplier;
            case 'participation':
                if (Math.abs(b.participationRaw - a.participationRaw) > 0.001) {
                    return (a.participationRaw - b.participationRaw) * multiplier;
                }
                return (a.avgRaw - b.avgRaw) * multiplier; // Secondary sort by Avg
            case 'games':
                return (a.games - b.games) * multiplier;
            case 'total':
                return (a.total - b.total) * multiplier;
            case 'avg':
                return (a.avgRaw - b.avgRaw) * multiplier;
            default:
                return 0;
        }
    });

    // Helper to render sort arrow
    const renderSortArrow = (key: string) => {
        if (sortConfig.key !== key) return <span className="text-muted-foreground/30 ml-1">⇅</span>;
        return <span className="text-primary ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
    };

    // Team Summary Calculation
    const teamTotalGames = rows.reduce((sum, r) => sum + r.games, 0);
    const teamTotalScore = rows.reduce((sum, r) => sum + r.total, 0);
    const teamAvg = teamTotalGames > 0 ? (teamTotalScore / teamTotalGames).toFixed(1) : "0.0";

    // Team Participation: Average of member participations
    const teamParticipationRaw = rows.length > 0
        ? rows.reduce((sum, r) => sum + r.participationRaw, 0) / rows.length
        : 0;
    const teamParticipationDisplay = (teamParticipationRaw * 100).toFixed(1) + "%";

    // Team Monthly Averages (Average of averages or Total/Count?)
    // "Team Monthly Average" usually means "Total Team Score in Month / Total Team Games in Month"
    const teamMonthlyStats = Array.from({ length: 12 }, (_, i) => {
        let mTotal = 0;
        let mCount = 0;
        Object.values(userStats).forEach(stat => {
            const m = stat.monthlyScores[i];
            if (m) {
                mTotal += m.total;
                mCount += m.count;
            }
        });
        return mCount > 0 ? Math.round(mTotal / mCount) : "-";
    });

    return (
        <div className="card w-full overflow-hidden bg-background">
            <div className="mb-4 flex flex-wrap gap-2 p-4 bg-muted/20 rounded-lg">
                <span className="text-sm font-semibold mr-2 flex items-center">게임 분류:</span>
                {GAME_TYPES.map(type => (
                    <label key={type} className="flex items-center gap-1.5 text-sm cursor-pointer select-none bg-card px-3 py-1.5 rounded-full border hover:border-primary transition-colors">
                        <input
                            type="checkbox"
                            checked={selectedTypes.includes(type)}
                            onChange={() => onToggleType(type)}
                            className="w-4 h-4 accent-primary"
                        />
                        {type}
                    </label>
                ))}
            </div>

            <h3 className="text-xl font-bold mb-4">{currentYear}년 팀원별 정보</h3>

            <div className="overflow-x-auto pb-4">
                <table className="w-full text-center text-xs border-collapse" style={{ minWidth: '800px' }}>
                    <thead>
                        <tr className="bg-muted/50 text-muted-foreground border-b border-border">
                            <th className="p-1 whitespace-nowrap sticky left-0 z-10 w-[80px] min-w-[80px] bg-muted/50 text-muted-foreground border-r">
                            </th>
                            <th
                                className={`p-1 whitespace-nowrap sticky left-[80px] z-10 w-[160px] min-w-[160px] cursor-pointer transition-colors border-r ${sortConfig.key === 'name' ? 'font-bold' : 'bg-muted/50 hover:bg-muted'}`}
                                onClick={() => handleSort('name')}
                                style={sortConfig.key === 'name' ? { backgroundColor: '#2563eb', color: '#ffffff' } : undefined}
                            >
                                이름 {renderSortArrow('name')}
                            </th>
                            <th
                                className={`p-1 whitespace-nowrap w-[100px] cursor-pointer transition-colors ${sortConfig.key === 'participation' ? 'font-bold' : 'hover:bg-muted'}`}
                                onClick={() => handleSort('participation')}
                                style={sortConfig.key === 'participation' ? { backgroundColor: '#2563eb', color: '#ffffff' } : undefined}
                            >
                                참석율 {renderSortArrow('participation')}
                            </th>
                            <th
                                className={`p-1 whitespace-nowrap w-[50px] cursor-pointer transition-colors ${sortConfig.key === 'games' ? 'font-bold' : 'hover:bg-muted'}`}
                                onClick={() => handleSort('games')}
                                style={sortConfig.key === 'games' ? { backgroundColor: '#2563eb', color: '#ffffff' } : undefined}
                            >
                                게임 {renderSortArrow('games')}
                            </th>
                            {/* Monthly Headers */}
                            {Array.from({ length: 12 }, (_, i) => (
                                <th key={i} className="p-1 w-[40px]">{i + 1}월</th>
                            ))}
                            <th
                                className={`p-1 whitespace-nowrap w-[60px] cursor-pointer transition-colors ${sortConfig.key === 'total' ? 'font-bold' : 'hover:bg-muted'}`}
                                onClick={() => handleSort('total')}
                                style={sortConfig.key === 'total' ? { backgroundColor: '#2563eb', color: '#ffffff' } : undefined}
                            >
                                총점 {renderSortArrow('total')}
                            </th>
                            <th
                                className={`p-1 whitespace-nowrap w-[60px] cursor-pointer transition-colors ${sortConfig.key === 'avg' ? 'font-bold' : 'text-foreground font-bold hover:bg-muted'}`}
                                onClick={() => handleSort('avg')}
                                style={sortConfig.key === 'avg' ? { backgroundColor: '#2563eb', color: '#ffffff' } : undefined}
                            >
                                평균 {renderSortArrow('avg')}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, idx) => (
                            <tr key={idx} className="border-b border-border hover:bg-muted/30 transition-colors">
                                <td className="p-1 font-medium sticky left-0 bg-background z-10 border-r w-[80px] min-w-[80px] max-w-[80px]">
                                    <div className="flex items-center justify-center gap-0.5 w-full h-full">
                                        {/* Show Leader, Manager, and Rankings only for the current year (2026) */}
                                        {currentYear === 2026 && (
                                            <>
                                                {row.userId === ownerId && (
                                                    <img
                                                        src="/images/leader-badge.png"
                                                        alt="리더"
                                                        className="flex-shrink-0"
                                                        style={{ height: '16px', width: 'auto', objectFit: 'contain' }}
                                                        title="리더"
                                                    />
                                                )}
                                                {managerIds?.includes(row.userId) && row.userId !== ownerId && (
                                                    <img
                                                        src="/images/manager-badge.png"
                                                        alt="매니저"
                                                        className="flex-shrink-0"
                                                        style={{ height: '16px', width: 'auto', objectFit: 'contain' }}
                                                        title="매니저"
                                                    />
                                                )}
                                            </>
                                        )}

                                        {/* Ace badge is always shown if earned in that year */}
                                        {row.userId === aceUserId && (
                                            <img
                                                src="/images/ace-badge.png"
                                                alt="에이스"
                                                className="flex-shrink-0"
                                                style={{ height: '16px', width: 'auto', objectFit: 'contain' }}
                                                title="에이스"
                                            />
                                        )}

                                        {currentYear === 2026 && (
                                            <>
                                                {recentRankings?.[1] === row.userId && (
                                                    <img
                                                        src="/images/1.png"
                                                        alt="1위"
                                                        className="flex-shrink-0"
                                                        style={{ height: '16px', width: 'auto', objectFit: 'contain' }}
                                                        title="최근 정기전/교류전 1위"
                                                    />
                                                )}
                                                {recentRankings?.[2] === row.userId && (
                                                    <img
                                                        src="/images/2.png"
                                                        alt="2위"
                                                        className="flex-shrink-0"
                                                        style={{ height: '16px', width: 'auto', objectFit: 'contain' }}
                                                        title="최근 정기전/교류전 2위"
                                                    />
                                                )}
                                                {recentRankings?.[3] === row.userId && (
                                                    <img
                                                        src="/images/3.png"
                                                        alt="3위"
                                                        className="flex-shrink-0"
                                                        style={{ height: '16px', width: 'auto', objectFit: 'contain' }}
                                                        title="최근 정기전/교류전 3위"
                                                    />
                                                )}
                                            </>
                                        )}
                                    </div>
                                </td>
                                <td className="p-1 font-medium sticky left-[80px] bg-background z-10 border-r w-[160px] min-w-[160px] max-w-[160px]">
                                    <span className="truncate font-semibold text-foreground/90 whitespace-nowrap block text-center">
                                        {row.name}
                                    </span>
                                </td>
                                <td className="p-1 text-muted-foreground">
                                    <span className="font-semibold text-foreground">{row.participationDisplay}</span>
                                    <span className="text-[10px] ml-1 opacity-70">{row.participationDetail}</span>
                                </td>
                                <td className="p-1">{row.games}</td>
                                {row.monthlyAvgs.map((avg, mIdx) => (
                                    <td key={mIdx} className={`p-1 ${avg === null ? 'text-muted-foreground/20' : ''}`}>
                                        {avg ?? '-'}
                                    </td>
                                ))}
                                <td className="p-1">{row.total}</td>
                                <td className="p-1 font-bold text-accent">{row.avg}</td>
                            </tr>
                        ))}
                    </tbody>
                    {rows.length > 0 && (
                        <tfoot className="bg-muted/80 font-bold border-t-2 border-border">
                            <tr>
                                <td className="p-2 sticky left-0 bg-muted z-10 border-r text-primary text-xs text-center" colSpan={2}>{teamName}</td>
                                <td className="p-2 text-xs">{teamParticipationDisplay}</td>
                                <td className="p-2 text-xs">{teamTotalGames}</td>
                                {teamMonthlyStats.map((avg, i) => (
                                    <td key={i} className="p-1 text-xs">{avg}</td>
                                ))}
                                <td className="p-2 text-xs">{teamTotalScore}</td>
                                <td className="p-2 text-accent text-xs">{teamAvg}</td>
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>
        </div>
    );
}
