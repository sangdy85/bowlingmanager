'use client';

import { useState } from "react";
import * as XLSX from 'xlsx';
import ScoreEditModal from "./ScoreEditModal";
import ScoreGroupEditModal from "./ScoreGroupEditModal";

interface DailyScoreTableProps {
    date: string;
    dailyAvg?: string;
    memo?: string;
    gameType?: string;
    isOwner?: boolean;
    isManager?: boolean;
    teamId?: string;
    members?: { id: string; name: string }[];
    scores: {
        id: string;
        score: number;
        user?: { name: string | null } | null;
        userId?: string | null;
        guestName?: string | null;
    }[];
}

export default function DailyScoreTable({ scores, date, dailyAvg, memo, gameType, isOwner, isManager, teamId, members = [] }: DailyScoreTableProps) {
    const [editingUser, setEditingUser] = useState<{ id: string, name: string, scores: any[], isGuest: boolean } | null>(null);
    const [isGroupEditing, setIsGroupEditing] = useState(false);

    // 데이터 가공
    const userScores: { [key: string]: { name: string, scores: { id: string, score: number }[], isGuest: boolean } } = {};

    scores.forEach(score => {
        // Unique key: Use userId for members, or 'guest_' + guestName for guests
        const isGuest = !score.userId;
        const key = isGuest ? `guest_${score.guestName}` : score.userId!;

        let name = '알 수 없음';
        if (isGuest) {
            name = `${score.guestName}(비)`;
        } else {
            // Find alias/name from members list if available, or fallback to user.name
            const member = members.find(m => m.id === score.userId);
            name = member ? member.name : (score.user?.name || '알 수 없음');
        }

        if (!userScores[key]) {
            userScores[key] = {
                name: name,
                scores: [],
                isGuest: isGuest
            };
        }
        userScores[key].scores.push({ id: score.id, score: score.score });
    });

    // 배열로 변환 및 통계 계산
    const rows = Object.entries(userScores).map(([key, user]) => {
        const scoreValues = user.scores.map(s => s.score);
        const total = scoreValues.reduce((a, b) => a + b, 0);
        const avg = total / scoreValues.length;
        return {
            userId: user.isGuest ? 'guest' : key, // 'guest' ID prevents modal opening logic if needed, or handle differently
            name: user.name,
            scoreItems: user.scores,
            scores: scoreValues, // display purpose
            gameCount: scoreValues.length,
            total,
            avg: Number.isInteger(avg) ? avg : parseFloat(avg.toFixed(2)),
            isGuest: user.isGuest,
            guestName: user.isGuest ? user.name.replace('(비)', '') : undefined // Extract guest name
        };
    });

    // 총점 기준 내림차순 정렬
    rows.sort((a, b) => b.total - a.total);

    // 최대 게임 수 계산
    const maxGames = Math.max(...rows.map(r => r.gameCount), 0);
    const displayGameCount = maxGames > 0 ? maxGames : 1;

    if (rows.length === 0) {
        return (
            <div className="text-center py-8 text-secondary-foreground">
                해당 날짜에 기록된 점수가 없습니다.
            </div>
        );
    }

    const handleRowClick = (row: typeof rows[0]) => {
        // Owner or Manager can edit
        if (!isOwner && !isManager) return;

        setEditingUser({
            id: row.userId,
            name: row.name,
            scores: row.scoreItems,
            isGuest: row.isGuest
        });
    };

    const getDayName = (dateStr: string) => {
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        const d = new Date(dateStr);
        return days[d.getDay()];
    };

    const handleDownloadExcel = () => {
        const wb = XLSX.utils.book_new();
        const wsData = [];

        // Title Row
        wsData.push([`${date} (${getDayName(date)})`, gameType || '', memo || '', `평균: ${dailyAvg || 0}`]);
        wsData.push([]); // Empty row

        // Headers
        const headers = ['순위', '이름'];
        for (let i = 1; i <= displayGameCount; i++) headers.push(`${i}G`);
        headers.push('총점', '평균');
        wsData.push(headers);

        // Data
        rows.forEach((row, index) => {
            const rowData = [
                index + 1,
                row.name
            ];
            // Scores
            for (let i = 0; i < displayGameCount; i++) {
                rowData.push(row.scores[i] || '');
            }
            rowData.push(row.total);
            rowData.push(row.avg);
            wsData.push(rowData);
        });

        const ws = XLSX.utils.aoa_to_sheet(wsData);

        // Column Widths
        ws['!cols'] = [
            { wch: 6 },  // Rank
            { wch: 12 }, // Name
            ...Array(displayGameCount).fill({ wch: 6 }), // Games
            { wch: 8 },  // Total
            { wch: 8 }   // Avg
        ];

        XLSX.utils.book_append_sheet(wb, ws, "Scores");
        XLSX.writeFile(wb, `BowlingScore_${date}.xlsx`);
    };

    return (
        <>
            <div className="overflow-x-auto rounded-lg shadow-sm" style={{ border: '1px solid rgba(255,255,255,0.2)' }}>
                <table className="w-full text-center text-sm table-fixed" style={{ borderCollapse: 'collapse' }}>
                    <thead className="bg-muted text-muted-foreground font-semibold">
                        {/* Merged Header Row */}
                        <tr>
                            <th
                                colSpan={4 + displayGameCount}
                                className="p-0 bg-card text-foreground border-b"
                                style={{ border: '1px solid rgba(255,255,255,0.2)' }}
                            >
                                <div className="flex flex-col sm:flex-row w-full items-center justify-center gap-2 py-3 relative px-10 sm:px-0">
                                    <div className="flex items-center justify-center gap-2 flex-wrap justify-center">
                                        <div className="px-2 flex items-center justify-center">
                                            <span className="font-bold whitespace-nowrap text-base sm:text-lg">
                                                {date} ({getDayName(date)})
                                            </span>
                                        </div>
                                        <span className="hide-mobile text-muted-foreground/40 text-lg font-light">|</span>
                                        <div className="px-2 flex items-center justify-center">
                                            <span className="font-bold text-primary whitespace-nowrap text-base sm:text-lg">
                                                {gameType || '-'}
                                            </span>
                                        </div>
                                        <span className="hide-mobile text-muted-foreground/40 text-lg font-light">|</span>
                                        <div className="px-2 flex items-center justify-center max-w-[150px] sm:max-w-[200px]">
                                            <span className="font-normal text-xs sm:text-sm truncate w-full text-center" title={memo}>
                                                {memo || '-'}
                                            </span>
                                        </div>
                                        <span className="hide-mobile text-muted-foreground/40 text-lg font-light">|</span>
                                        <div className="px-2 flex items-center justify-center">
                                            <span className="font-bold text-accent whitespace-nowrap text-base sm:text-lg">
                                                {dailyAvg || '0'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="absolute right-4 flex gap-2">
                                        {(isOwner || isManager) && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setIsGroupEditing(true);
                                                }}
                                                className="p-2 rounded-full hover:bg-white/10 text-muted-foreground hover:text-blue-500 transition-colors"
                                                title="그룹 정보 수정"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                </svg>
                                            </button>
                                        )}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDownloadExcel();
                                            }}
                                            className="p-2 rounded-full hover:bg-white/10 text-muted-foreground hover:text-green-500 transition-colors"
                                            title="엑셀 다운로드"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                                <polyline points="14 2 14 8 20 8"></polyline>
                                                <line x1="16" y1="13" x2="8" y2="13"></line>
                                                <line x1="16" y1="17" x2="8" y2="17"></line>
                                                <polyline points="10 9 9 9 8 9"></polyline>
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            </th>
                        </tr>
                        <tr>
                            <th className="p-3" style={{ border: '1px solid rgba(255,255,255,0.2)', width: '60px' }}>순위</th>
                            <th className="p-3" style={{ border: '1px solid rgba(255,255,255,0.2)', width: '150px' }}>성명</th>
                            {[...Array(displayGameCount)].map((_, i) => (
                                <th key={i} className="p-3" style={{
                                    border: '1px solid rgba(255,255,255,0.2)',
                                    width: `calc((100% - 450px) / ${displayGameCount})`
                                }}>{i + 1}</th>
                            ))}
                            <th className="p-3 bg-accent/5 text-accent-foreground font-bold" style={{ border: '1px solid rgba(255,255,255,0.2)', width: '120px' }}>총점</th>
                            <th className="p-3" style={{ border: '1px solid rgba(255,255,255,0.2)', width: '120px' }}>평균</th>
                        </tr>
                    </thead>
                    <tbody className="bg-card text-card-foreground">
                        {rows.map((row, index) => (
                            <tr
                                key={index}
                                className="hover:bg-muted/30 transition-colors cursor-pointer"
                                onClick={() => handleRowClick(row)}
                                title="클릭하여 점수 수정"
                            >
                                <td className="p-3" style={{ border: '1px solid rgba(255,255,255,0.2)' }}>{index + 1}</td>
                                <td className="p-3 font-medium" style={{ border: '1px solid rgba(255,255,255,0.2)' }}>{row.name}</td>
                                {[...Array(displayGameCount)].map((_, i) => (
                                    <td key={i} className="p-3 text-muted-foreground" style={{ border: '1px solid rgba(255,255,255,0.2)' }}>
                                        {row.scores[i] !== undefined ? (
                                            <span
                                                className={row.scores[i] >= 200 ? "inline-block px-1 rounded" : "text-foreground"}
                                                style={{
                                                    color: row.scores[i] >= 200 ? '#ef4444' : undefined,
                                                    backgroundColor: row.scores[i] === 300 ? '#fde047' : undefined,
                                                    fontWeight: row.scores[i] === 300 ? 900 : (row.scores[i] >= 200 ? 'bold' : 'normal')
                                                }}
                                            >
                                                {row.scores[i]}
                                            </span>
                                        ) : '-'}
                                    </td>
                                ))}
                                <td className="p-3 font-bold text-accent bg-accent/5" style={{ border: '1px solid rgba(255,255,255,0.2)' }}>
                                    {row.total}
                                </td>
                                <td className="p-3 font-medium" style={{ border: '1px solid rgba(255,255,255,0.2)' }}>
                                    <span
                                        className={Number(row.avg) >= 200 ? "font-bold" : "text-foreground"}
                                        style={Number(row.avg) >= 200 ? { color: '#ef4444' } : undefined}
                                    >
                                        {row.avg}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {editingUser && (
                <ScoreEditModal
                    isOpen={!!editingUser}
                    onClose={() => setEditingUser(null)}
                    userId={editingUser.id}
                    userName={editingUser.name}
                    dateStr={date}
                    initialScores={editingUser.scores}
                    teamId={teamId || ""}
                    guestName={editingUser.isGuest ? editingUser.name.replace('(비)', '') : undefined}
                />
            )}

            {isGroupEditing && (
                <ScoreGroupEditModal
                    isOpen={isGroupEditing}
                    onClose={() => setIsGroupEditing(false)}
                    teamId={teamId || ""}
                    dateStr={date}
                    initialGameType={gameType}
                    initialMemo={memo}
                />
            )}
        </>
    );
}


