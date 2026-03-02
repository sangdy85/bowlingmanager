'use client';

import { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { updateSideGameParticipation } from '@/app/actions/champ-side-actions';

interface IndividualScore {
    registrationId?: string | null;
    handicap: number;
    scores: number[]; // Index 0 is game 1
}

interface Matchup {
    id: string;
    teamA: { name: string } | null;
    teamB: { name: string } | null;
    individualScores: any[];
}

interface SideGameManagerProps {
    matchups?: Matchup[];
    participants?: any[];
    allIndividualScores?: any[];
    roundId?: string;
    isManager?: boolean;
    tournamentType?: string;
    gameCount?: number;
    tournamentRegistrations?: any[];
    maxParticipants?: number;
}

type SideCategory = 'STANDARD' | 'BALL' | 'EXTRA';

export default function SideGameManager({
    matchups,
    participants,
    allIndividualScores,
    roundId,
    isManager,
    tournamentType,
    gameCount = 3,
    tournamentRegistrations,
    maxParticipants = 0
}: SideGameManagerProps) {
    const isChamp = tournamentType === 'CHAMP';

    // Internal state for participation
    const [participation, setParticipation] = useState<{ [regId: string]: Set<SideCategory> }>({});
    const [saving, setSaving] = useState(false);
    const [hasBeenSaved, setHasBeenSaved] = useState(false);

    // Dynamic Tabs Generation
    const tabs = useMemo(() => {
        const t: { id: string; label: string; gameIdx: number; category: SideCategory }[] = [];
        // Basic Side (Standard) for all games
        for (let i = 1; i <= gameCount; i++) {
            t.push({ id: `G${i}_STD`, label: `${i}G 기본`, gameIdx: i, category: 'STANDARD' });
        }
        // Ball Side (usually G2)
        if (gameCount >= 2) {
            t.push({ id: `G2_BALL`, label: `2G 볼사이드`, gameIdx: 2, category: 'BALL' });
        }
        // Extra Side (Last Game)
        t.push({ id: `G${gameCount}_EXTRA`, label: `${gameCount}G 번외`, gameIdx: gameCount, category: 'EXTRA' });
        return t;
    }, [gameCount]);

    const [activeTabId, setActiveTabId] = useState(tabs[0]?.id || 'G1_STD');

    // Initialize participation from props
    useEffect(() => {
        const initialMap: { [id: string]: Set<SideCategory> } = {};
        let saved = false;

        const processParticipants = (plist: any[]) => {
            plist.forEach(p => {
                const s = new Set<SideCategory>();
                if (p.sideBasic) { s.add('STANDARD'); saved = true; }
                if (p.sideBall) { s.add('BALL'); saved = true; }
                if (p.sideExtra) { s.add('EXTRA'); saved = true; }
                initialMap[p.registrationId] = s;
            });
        };

        if (participants) {
            processParticipants(participants);
        }
        setParticipation(initialMap);
        setHasBeenSaved(saved);
    }, [participants]);

    // Extract all players from data sources
    const allPlayers = useMemo(() => {
        const players: { name: string; score: IndividualScore; regId: string }[] = [];
        const seenRegIds = new Set<string>();

        if (tournamentType === 'LEAGUE' && matchups) {
            matchups.forEach(m => {
                m.individualScores?.forEach(s => {
                    // Find registration for mapping
                    const reg = tournamentRegistrations?.find(r =>
                        (s.userId && r.userId === s.userId) ||
                        (!s.userId && r.guestName === s.playerName)
                    );

                    // Use fallback ID if not yet registered in TournamentRegistration
                    const finalRegId = reg ? reg.id : `LEAGUE_PLAYER|${s.userId || ''}|${s.playerName || ''}|${s.teamId || ''}`;

                    if (!seenRegIds.has(finalRegId)) {
                        players.push({
                            name: s.playerName || reg?.user?.name || reg?.guestName || 'Unknown',
                            regId: finalRegId,
                            score: {
                                scores: [s.score1 || 0, s.score2 || 0, s.score3 || 0, ...new Array(Math.max(0, gameCount - 3)).fill(0)],
                                handicap: s.handicap || 0,
                                registrationId: finalRegId
                            }
                        });
                        seenRegIds.add(finalRegId);
                    }
                });
            });
        } else if (participants && allIndividualScores) {
            // Group flat scores by registrationId
            const scoreGroups: { [regId: string]: number[] } = {};
            allIndividualScores.forEach(s => {
                if (!scoreGroups[s.registrationId]) scoreGroups[s.registrationId] = new Array(gameCount).fill(0);
                if (s.gameNumber <= gameCount) {
                    scoreGroups[s.registrationId][s.gameNumber - 1] = s.score;
                }
            });

            participants.forEach(p => {
                if (!seenRegIds.has(p.registrationId)) {
                    players.push({
                        name: p.registration?.user?.name || p.registration?.playerName || p.registration?.guestName || 'Unknown',
                        regId: p.registrationId,
                        score: {
                            scores: scoreGroups[p.registrationId] || new Array(gameCount).fill(0),
                            handicap: p.registration?.handicap || 0,
                            registrationId: p.registrationId
                        }
                    });
                    seenRegIds.add(p.registrationId);
                }
            });
        }
        return players;
    }, [tournamentType, matchups, participants, allIndividualScores, tournamentRegistrations, gameCount]);

    // Participation Counts
    const participationCounts = useMemo(() => {
        const counts = { STANDARD: 0, BALL: 0, EXTRA: 0 };
        Object.values(participation).forEach(s => {
            if (s.has('STANDARD')) counts.STANDARD++;
            if (s.has('BALL')) counts.BALL++;
            if (s.has('EXTRA')) counts.EXTRA++;
        });
        return counts;
    }, [participation]);

    // Players list to display based on view permissions
    const visiblePlayers = useMemo(() => {
        if (isManager) return allPlayers;
        if (!hasBeenSaved) return [];
        // For members after save: Only show those who are participating in at least one category
        return allPlayers.filter(p => participation[p.regId]?.size > 0);
    }, [allPlayers, isManager, hasBeenSaved, participation]);

    const checkModificationWarning = () => {
        if (hasBeenSaved) {
            return confirm("이미 명단이 저장되어 있습니다. 수정하시겠습니까?");
        }
        return true;
    };

    const toggleParticipation = (regId: string, category: SideCategory) => {
        if (!checkModificationWarning()) return;

        setParticipation(prev => {
            const current = new Set(prev[regId] || []);
            if (current.has(category)) {
                current.delete(category);
            } else {
                current.add(category);
            }
            return { ...prev, [regId]: current };
        });
    };

    const handleSave = async () => {
        if (!roundId) return;
        setSaving(true);
        try {
            const data = Object.entries(participation).map(([regId, categories]) => ({
                regId,
                basic: categories.has('STANDARD'),
                ball: categories.has('BALL'),
                extra: categories.has('EXTRA')
            }));
            const res = await updateSideGameParticipation(roundId, data);
            if (res.success) {
                setHasBeenSaved(true);
                alert('명단이 성공적으로 저장되었습니다.');
            }
        } catch (e: any) {
            alert(e.message);
        } finally {
            setSaving(false);
        }
    };

    const downloadTemplate = () => {
        const header = ['이름', '기본사이드', '볼사이드', '번외사이드', '(참여시 O 표시)'];
        const data = [
            header,
            ...allPlayers.map(p => [p.name, '', '', '', ''])
        ];
        const ws = XLSX.utils.aoa_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "SideGame_Template");
        ws['!cols'] = [{ wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 18 }];
        XLSX.writeFile(wb, "side_game_template.xlsx");
    };

    const handleBulkExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!checkModificationWarning()) {
            e.target.value = '';
            return;
        }
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

            setParticipation(prev => {
                const next = { ...prev };
                let matchCount = 0;
                data.forEach((row, idx) => {
                    if (idx === 0) return;
                    const name = String(row[0] || '').trim();
                    if (!name) return;

                    const isStandard = String(row[1] || '').trim().toUpperCase() === 'O';
                    const isBall = String(row[2] || '').trim().toUpperCase() === 'O';
                    const isExtra = String(row[3] || '').trim().toUpperCase() === 'O';

                    const player = allPlayers.find(p => p.name === name);
                    if (player) {
                        const s = new Set<SideCategory>();
                        if (isStandard) s.add('STANDARD');
                        if (isBall) s.add('BALL');
                        if (isExtra) s.add('EXTRA');
                        next[player.regId] = s;
                        matchCount++;
                    }
                });
                alert(`총 ${matchCount}명의 참가 정보를 일괄 업데이트했습니다.`);
                return next;
            });
            e.target.value = '';
        };
        reader.readAsBinaryString(file);
    };

    const getRankings = (gameIdx: number, category: SideCategory) => {
        return allPlayers
            .filter(p => participation[p.regId]?.has(category))
            .map(p => {
                const gScore = p.score.scores[gameIdx - 1] || 0;
                return {
                    ...p,
                    gameScore: gScore,
                    total: gScore > 0 ? Math.min(gScore + p.score.handicap, 300) : 0
                };
            })
            .sort((a, b) => {
                if (b.total !== a.total) return b.total - a.total;
                return a.score.handicap - b.score.handicap;
            })
            .slice(0, 10);
    };

    const currentTab = tabs.find(t => t.id === activeTabId) || tabs[0];
    const currentRankings = useMemo(() => {
        return getRankings(currentTab.gameIdx, currentTab.category);
    }, [allPlayers, participation, currentTab]);

    const baseCell: React.CSSProperties = { border: '1px solid #000000', padding: '10px 15px', textAlign: 'center' };

    let lastTotal = -1;
    let lastHandicap = -1;
    let lastRank = 0;

    return (
        <div className="space-y-8">
            <div className="bg-white p-6 rounded-2xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8 border-b-2 border-black/5 pb-6">
                    <div>
                        <h2 className="text-2xl font-black italic uppercase">
                            {isManager ? '사이드 게임 참가자 관리' : '사이드 게임 참여 현황'}
                        </h2>
                        <p className="text-slate-500 text-sm font-bold">
                            {isManager
                                ? `진행 중인 ${gameCount}개 게임의 사이드 참가자를 확정하세요.`
                                : `현재 ${gameCount}개 게임의 사이드 게임 참여자 명단입니다.`}
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        {isManager && (
                            <>
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="btn btn-sm btn-success border-2 border-black font-black text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-0.5 active:translate-y-0.5"
                                >
                                    {saving ? '저장 중...' : '💾 현재 명단 저장'}
                                </button>
                                <button onClick={downloadTemplate} className="btn btn-sm bg-yellow-400 hover:bg-yellow-500 text-black border-2 border-black font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all">
                                    📊 양식 다운로드
                                </button>
                                <label className="btn btn-sm btn-primary border-2 border-black font-black cursor-pointer shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all">
                                    📝 명단 업로드 ↑
                                    <input type="file" className="hidden" onChange={handleBulkExcelUpload} accept=".xlsx, .xls" />
                                </label>
                            </>
                        )}
                    </div>
                </div>

                {/* Participation Summary Board */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <div className="bg-blue-50 border-2 border-blue-600 p-4 rounded-xl shadow-[4px_4px_0px_0px_rgba(37,99,235,1)] flex items-center justify-between">
                        <div>
                            <span className="text-xs font-black text-blue-600 uppercase tracking-widest block mb-1">기본 사이드</span>
                            <span className="text-3xl font-black text-blue-900">{participationCounts.STANDARD} <span className="text-sm font-bold text-blue-400">명</span></span>
                        </div>
                        <div className="text-3xl opacity-40">🎯</div>
                    </div>
                    <div className="bg-orange-50 border-2 border-orange-500 p-4 rounded-xl shadow-[4px_4px_0px_0px_rgba(249,115,22,1)] flex items-center justify-between">
                        <div>
                            <span className="text-xs font-black text-orange-500 uppercase tracking-widest block mb-1">볼사이드 (2G)</span>
                            <span className="text-3xl font-black text-orange-900">{participationCounts.BALL} <span className="text-sm font-bold text-orange-400">명</span></span>
                        </div>
                        <div className="text-3xl opacity-40">🔮</div>
                    </div>
                    <div className="bg-purple-50 border-2 border-purple-600 p-4 rounded-xl shadow-[4px_4px_0px_0px_rgba(147,51,234,1)] flex items-center justify-between">
                        <div>
                            <span className="text-xs font-black text-purple-600 uppercase tracking-widest block mb-1">번외 ({gameCount}G)</span>
                            <span className="text-3xl font-black text-purple-900">{participationCounts.EXTRA} <span className="text-sm font-bold text-purple-400">명</span></span>
                        </div>
                        <div className="text-3xl opacity-40">🎲</div>
                    </div>
                </div>

                {!isManager && !hasBeenSaved ? (
                    <div className="py-20 text-center bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                        <div className="text-4xl mb-4">⏳</div>
                        <h3 className="text-xl font-black text-slate-800">사이드 게임 참여 명단 준비 중</h3>
                        <p className="text-slate-500 font-bold mt-2">관리자가 참여 명단을 확인하고 있습니다. 잠시만 기다려주세요.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-slate-50 text-[10px] uppercase font-black text-slate-400">
                                    <th className="p-3 text-left border-b-2 border-black">선수명</th>
                                    {isManager && (
                                        <>
                                            <th className="p-3 text-center border-b-2 border-black bg-blue-50/50 text-blue-600">기본 (1-{gameCount}G)</th>
                                            <th className="p-3 text-center border-b-2 border-black bg-orange-50/50 text-orange-600">볼사이드 (2G)</th>
                                            <th className="p-3 text-center border-b-2 border-black bg-purple-50/50 text-purple-600">번외 ({gameCount}G)</th>
                                        </>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-black/5">
                                {visiblePlayers.map((p, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-3 font-bold text-lg">{p.name}</td>
                                        {isManager && (['STANDARD', 'BALL', 'EXTRA'] as SideCategory[]).map(cat => (
                                            <td key={cat} className="p-3 text-center">
                                                <button
                                                    onClick={() => toggleParticipation(p.regId, cat)}
                                                    className={`w-10 h-10 rounded-lg border-2 font-black transition-all ${participation[p.regId]?.has(cat)
                                                        ? 'bg-black text-white border-black rotate-3 scale-110'
                                                        : 'bg-white text-slate-200 border-slate-100 hover:border-black hover:text-black'
                                                        }`}
                                                >
                                                    {participation[p.regId]?.has(cat) ? 'V' : '-'}
                                                </button>
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                                {visiblePlayers.length === 0 && (
                                    <tr>
                                        <td colSpan={isManager ? 4 : 1} className="p-10 text-center text-slate-400 font-bold italic">참여 인원이 없습니다.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="bg-white p-8 rounded-2xl border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 mb-8">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-yellow-400 border-2 border-black rounded-full flex items-center justify-center text-2xl rotate-12 shadow-md">🏆</div>
                        <h3 className="text-3xl font-black italic uppercase tracking-tighter text-black">Side Game Leaderboard</h3>
                    </div>
                    <div className="flex flex-wrap gap-1 bg-slate-100 p-1.5 rounded-2xl border-2 border-black/5 overflow-x-auto max-w-full">
                        {tabs.map(tab => (
                            <button key={tab.id} onClick={() => setActiveTabId(tab.id)} className={`px-4 py-2 rounded-xl font-black transition-all text-xs whitespace-nowrap ${activeTabId === tab.id ? 'bg-black text-white shadow-lg -translate-y-0.5' : 'text-slate-500 hover:bg-white hover:text-black'}`}>
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="overflow-x-auto min-h-[400px]">
                    <div className="mb-4 bg-slate-50 p-4 border-2 border-dashed border-slate-200 rounded-xl">
                        <span className="text-xs font-black uppercase text-slate-400 tracking-widest block mb-1">Current Ranking View</span>
                        <span className="text-xl font-black text-black">{currentTab.label} <span className="text-slate-300 mx-2">|</span> TOP 10</span>
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse', border: '3px solid #000000', backgroundColor: '#ffffff', color: '#000000' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#000000', color: '#ffffff' }}>
                                <th style={{ ...baseCell, border: '1px solid #ffffff33', width: '80px' }}>Rank</th>
                                <th style={{ ...baseCell, border: '1px solid #ffffff33', textAlign: 'left' }}>선수명</th>
                                <th style={{ ...baseCell, border: '1px solid #ffffff33', width: '100px' }}>점수</th>
                                <th style={{ ...baseCell, border: '1px solid #ffffff33', width: '100px' }}>핸디</th>
                                <th style={{ ...baseCell, border: '1px solid #ffffff33', width: '150px', fontWeight: 900, backgroundColor: '#dc2626' }}>최종 점수</th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentRankings.length > 0 ? (
                                currentRankings.map((r, idx) => {
                                    const isSameAsPrevious = r.total === lastTotal && r.score.handicap === lastHandicap;
                                    if (!isSameAsPrevious) lastRank = idx + 1;
                                    lastTotal = r.total;
                                    lastHandicap = r.score.handicap;
                                    const displayRank = lastRank;
                                    const medal = displayRank === 1 ? '🥇' : displayRank === 2 ? '🥈' : displayRank === 3 ? '🥉' : `${displayRank}`;
                                    const bg = displayRank <= 3 ? (displayRank === 1 ? '#fff9c4' : displayRank === 2 ? '#f8fafc' : '#fff7ed') : 'transparent';
                                    return (
                                        <tr key={idx} style={{ backgroundColor: bg, borderBottom: '1px solid #000000' }}>
                                            <td style={{ ...baseCell, fontSize: displayRank <= 3 ? '1.5rem' : '1.125rem', fontWeight: 900 }}>{medal}</td>
                                            <td style={{ ...baseCell, textAlign: 'left', fontSize: '1.25rem', fontWeight: 900 }}>{r.name}</td>
                                            <td style={baseCell}>{r.gameScore}</td>
                                            <td style={baseCell}>{r.score.handicap}</td>
                                            <td style={{ ...baseCell, fontSize: '1.5rem', fontWeight: 900, color: displayRank <= 3 ? '#dc2626' : '#000000', backgroundColor: displayRank <= 3 ? '#fff59d' : '#f1f5f9' }}>{r.total}</td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={5} className="p-20 text-center text-slate-300 font-black italic text-2xl uppercase tracking-tighter">
                                        {!isManager && (!hasBeenSaved || !currentRankings.some(r => r.total > 0))
                                            ? "경기가 진행 중입니다. 결과 집계 대기 중..."
                                            : "No participants in this category"}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
