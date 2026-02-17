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
            <div className="overflow-x-auto mb-10">
                <table className="w-full text-center text-sm border-collapse bg-white" style={{ border: '1px solid #ddd', color: 'black', fontFamily: 'sans-serif' }}>
                    <thead>
                        {/* Title & Actions Row */}
                        <tr style={{ backgroundColor: '#ffffff' }}>
                            <th colSpan={4 + displayGameCount} style={{ padding: '12px 16px', borderBottom: '1px solid #ddd' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '18px', fontWeight: 'bold' }}>
                                        <span>📋</span>
                                        <span>{date} ({getDayName(date)}) - {gameType || '기록'}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                        {memo && (
                                            <span style={{ fontSize: '13px', color: '#666', fontStyle: 'italic' }}>"{memo}"</span>
                                        )}
                                        <div style={{ display: 'flex', gap: '4px' }}>
                                            {(isOwner || isManager) && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setIsGroupEditing(true); }}
                                                    style={{ padding: '6px', border: '1px solid #ddd', backgroundColor: 'white', cursor: 'pointer' }}
                                                    title="수정"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                                </button>
                                            )}
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDownloadExcel(); }}
                                                style={{ padding: '6px', border: '1px solid #ddd', backgroundColor: 'white', cursor: 'pointer' }}
                                                title="다운로드"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </th>
                        </tr>
                        {/* Column Headers */}
                        <tr style={{ backgroundColor: '#f8fafc', fontWeight: 'bold' }}>
                            <th style={{ padding: '10px 4px', border: '1px solid #ddd', width: '60px' }}>순위</th>
                            <th style={{ padding: '10px 12px', border: '1px solid #ddd', textAlign: 'center' }}>성함</th>
                            {[...Array(displayGameCount)].map((_, i) => (
                                <th key={i} style={{ padding: '10px 4px', border: '1px solid #ddd' }}>{i + 1}G</th>
                            ))}
                            <th style={{ padding: '10px 4px', border: '1px solid #ddd', width: '100px' }}>총점</th>
                            <th style={{ padding: '10px 4px', border: '1px solid #ddd', width: '110px' }}>평균</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, index) => {
                            return (
                                <tr
                                    key={index}
                                    onClick={() => handleRowClick(row)}
                                    style={{
                                        backgroundColor: '#ffffff',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <td style={{ padding: '10px 4px', border: '1px solid #ddd', fontWeight: 'bold', fontSize: '15px' }}>{index + 1}</td>
                                    <td style={{ padding: '10px 12px', border: '1px solid #ddd', fontWeight: 'bold', textAlign: 'center', whiteSpace: 'nowrap', fontSize: '15px' }}>
                                        {row.name}
                                    </td>
                                    {[...Array(displayGameCount)].map((_, i) => {
                                        const score = row.scores[i];
                                        const isHigh = score !== undefined && score >= 200;
                                        const isPerfect = score === 300;
                                        return (
                                            <td
                                                key={i}
                                                style={{
                                                    padding: '10px 4px',
                                                    border: '1px solid #ddd',
                                                    fontSize: '15px',
                                                    color: isHigh ? 'red' : 'black',
                                                    fontWeight: isPerfect ? 'bold' : 'normal',
                                                    backgroundColor: isPerfect ? '#ffff00' : 'transparent'
                                                }}
                                            >
                                                {score !== undefined ? score : '-'}
                                            </td>
                                        );
                                    })}
                                    <td style={{ padding: '10px 4px', border: '1px solid #ddd', fontWeight: 'bold', fontSize: '17px' }}>
                                        {row.total}
                                    </td>
                                    <td
                                        style={{
                                            padding: '10px 4px',
                                            border: '1px solid #ddd',
                                            fontSize: '14px',
                                            color: row.avg >= 200 ? 'red' : 'black'
                                        }}
                                    >
                                        {row.avg}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot>
                        <tr style={{ backgroundColor: '#ffffff', height: '34px', fontSize: '14px', fontWeight: 'bold' }}>
                            <td colSpan={2} style={{ padding: '4px 16px', border: '1px solid #ddd', textAlign: 'left' }}>
                                Players={rows.length}
                            </td>
                            <td colSpan={displayGameCount + 2} style={{ padding: '4px 16px', border: '1px solid #ddd', textAlign: 'right' }}>
                                Daily Avg: {dailyAvg || '0'}
                            </td>
                        </tr>
                    </tfoot>
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


