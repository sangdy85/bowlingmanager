import React from 'react';

interface ScoreItem {
    score: number;
    gameDate: Date;
}

interface StatsDisplayRowProps {
    title: string;
    scores: ScoreItem[];
    className?: string;
}

export default function StatsDisplayRow({ title, scores, className = "" }: StatsDisplayRowProps) {
    const totalGames = scores.length;
    const totalScore = scores.reduce((acc, curr) => acc + curr.score, 0);
    const avgScore = totalGames > 0 ? (totalScore / totalGames).toFixed(1) : "0.0";
    const highScore = totalGames > 0 ? Math.max(...scores.map(s => s.score)) : 0;

    // 일일 최고 에버리지 (하이 시리즈) 계산
    const kstOffset = 9 * 60 * 60 * 1000;
    const dailyMap = new Map<string, { sum: number; count: number }>();

    scores.forEach((s) => {
        // Ensure gameDate is a Date object
        const d = new Date(s.gameDate);
        const dateStr = new Date(d.getTime() + kstOffset).toISOString().split('T')[0];
        const current = dailyMap.get(dateStr) || { sum: 0, count: 0 };
        dailyMap.set(dateStr, { sum: current.sum + s.score, count: current.count + 1 });
    });

    let maxDailyAvg = 0;
    dailyMap.forEach((val) => {
        const dailyAvg = val.sum / val.count;
        if (dailyAvg > maxDailyAvg) maxDailyAvg = dailyAvg;
    });

    // If no games, we might want to hide the row? 
    // Or users might want to see "0"s. The user asked for specific rows, so I'll show them even if empty, 
    // or maybe show them but empty. Usually showing 0 is better.

    return (
        <div className={`w-full ${className}`}>
            <h3 className="text-md font-semibold text-muted-foreground ml-1" style={{ marginBottom: '2px' }}>
                {title} <span className="text-xs font-normal opacity-70">({totalGames} 게임)</span>
            </h3>
            <div className="flex w-full justify-between items-center text-center gap-2 overflow-x-auto pb-2">
                <div className="flex-1 min-w-[100px] p-3 bg-card border rounded-lg shadow-sm">
                    <div className="text-muted-foreground text-xs mb-1">총 게임</div>
                    <div className="text-xl font-bold">{totalGames}</div>
                </div>
                <div className="flex-1 min-w-[100px] p-3 bg-card border rounded-lg shadow-sm">
                    <div className="text-muted-foreground text-xs mb-1">총점</div>
                    <div className="text-xl font-bold">{totalScore.toLocaleString()}</div>
                </div>
                <div className="flex-1 min-w-[100px] p-3 bg-card border rounded-lg shadow-sm">
                    <div className="text-muted-foreground text-xs mb-1">하이 (시리즈)</div>
                    <div className="text-lg font-bold text-primary">Avg {maxDailyAvg.toFixed(1)}</div>
                </div>
                <div className="flex-1 min-w-[100px] p-3 bg-card border rounded-lg shadow-sm">
                    <div className="text-muted-foreground text-xs mb-1">하이 (단게임)</div>
                    <div className="text-xl font-bold text-primary">{highScore}</div>
                </div>
                <div className="flex-1 min-w-[100px] p-3 bg-card border rounded-lg shadow-sm">
                    <div className="text-muted-foreground text-xs mb-1">평균 (G.Avg)</div>
                    <div className="text-xl font-bold text-accent">{avgScore}</div>
                </div>
            </div>
        </div>
    );
}
