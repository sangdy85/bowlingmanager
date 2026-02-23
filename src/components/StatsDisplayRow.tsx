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
        <tr className={`hover:bg-slate-50 transition-colors border-b border-slate-200 group ${className}`}>
            <td className="p-3 border-x border-slate-200 bg-[#f8fafc] font-bold text-slate-700 text-sm">
                {title}
            </td>
            <td className="p-3 border-x border-slate-200 text-center font-bold text-slate-800">
                {totalGames}
            </td>
            <td className="p-3 border-x border-slate-200 text-center font-bold text-slate-800">
                {totalScore.toLocaleString()}
            </td>
            <td className="p-3 border-x border-slate-200 text-center font-black text-blue-600 italic">
                Avg {maxDailyAvg.toFixed(1)}
            </td>
            <td className="p-3 border-x border-slate-200 text-center font-black text-blue-600">
                {highScore}
            </td>
            <td className="p-3 border-x border-slate-300 text-center font-black text-blue-700 bg-[#f1f5f9] group-hover:bg-[#e2e8f0]">
                {avgScore}
            </td>
        </tr>
    );
}
