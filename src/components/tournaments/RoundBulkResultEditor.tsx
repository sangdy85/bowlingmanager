'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { updateLeagueRoundResults } from '@/app/actions/league-actions';
import * as XLSX from 'xlsx';
import { uploadRawLaneScores } from '@/app/actions/raw-score-actions';

interface User {
    id: string;
    name: string;
}

interface TeamMember {
    user: User;
}

interface Team {
    id: string;
    name: string;
    members: TeamMember[];
}

interface IndividualScore {
    id?: string;
    userId?: string | null;
    playerName?: string | null;
    teamId: string;
    teamSquad?: string | null;
    handicap: number;
    score1: number;
    score2: number;
    score3: number;
}

interface Matchup {
    id: string;
    teamA: Team | null;
    teamB: Team | null;
    teamASquad?: string | null;
    teamBSquad?: string | null;
    teamAId: string | null;
    teamBId: string | null;
    lanes: string | null;
    individualScores: IndividualScore[];
    pointsA: number | null;
    pointsB: number | null;
}

interface RoundBulkResultEditorProps {
    centerId: string;
    tournamentId: string;
    teamHandicapLimit?: number | null;
    round: {
        id: string;
        roundNumber: number;
        date: Date | null;
        matchups: Matchup[];
        moveLaneType?: string;
        moveLaneCount?: number;
        startLane?: number;
        endLane?: number;
    };
}

export default function RoundBulkResultEditor({
    centerId,
    tournamentId,
    round,
    teamHandicapLimit
}: RoundBulkResultEditorProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [rawResultData, setRawResultData] = useState<any[]>([]);
    const [useAI, setUseAI] = useState(true);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // results[matchupId] = { teamA: IndividualScore[], teamB: IndividualScore[] }
    const [results, setResults] = useState<{ [matchupId: string]: { teamA: IndividualScore[], teamB: IndividualScore[] } }>(() => {
        const initial: { [key: string]: { teamA: IndividualScore[], teamB: IndividualScore[] } } = {};
        round.matchups.forEach(m => {
            const teamAScores = m.individualScores.filter(s => s.teamId === m.teamAId && s.teamSquad === m.teamASquad);
            const teamBScores = m.individualScores.filter(s => s.teamId === m.teamBId && s.teamSquad === m.teamBSquad);

            const fillRows = (team: Team | null, teamId: string | null, squad: string | null, existing: IndividualScore[]) => {
                const rows: IndividualScore[] = [...existing.map(s => ({ ...s, teamSquad: squad }))];
                const members = team?.members || [];

                // If not enough existing scores, fill from members
                members.forEach(mem => {
                    if (rows.length < 3 && !rows.find(r => r.userId === mem.user.id)) {
                        rows.push({
                            teamId: teamId!,
                            teamSquad: squad,
                            userId: mem.user.id,
                            playerName: mem.user.name,
                            handicap: 0,
                            score1: 0,
                            score2: 0,
                            score3: 0,
                        });
                    }
                });

                // Still not 3? Fill with empty
                while (rows.length < 3 && teamId) {
                    rows.push({
                        teamId: teamId,
                        teamSquad: squad,
                        userId: null,
                        playerName: '',
                        handicap: 0,
                        score1: 0,
                        score2: 0,
                        score3: 0,
                    });
                }
                return rows.slice(0, 3);
            };

            initial[m.id] = {
                teamA: fillRows(m.teamA, m.teamAId, m.teamASquad || null, teamAScores),
                teamB: fillRows(m.teamB, m.teamBId, m.teamBSquad || null, teamBScores)
            };
        });
        return initial;
    });

    const handlePlayerChange = (matchupId: string, team: 'teamA' | 'teamB', index: number, field: keyof IndividualScore, value: any) => {
        setResults(prev => {
            const teamResults = [...prev[matchupId][team]];
            teamResults[index] = { ...teamResults[index], [field]: value };
            return {
                ...prev,
                [matchupId]: {
                    ...prev[matchupId],
                    [team]: teamResults
                }
            };
        });
    };

    const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            const bstr = evt.target?.result;
            if (!bstr) return;

            const wb = XLSX.read(bstr, { type: 'binary' });
            // Using a flat structure for parsing processing
            const tempAllMatchupsData: { [matchupId: string]: IndividualScore[] } = {};

            // Pre-fill with current data flattened for easier processing
            Object.entries(results).forEach(([mid, teams]) => {
                tempAllMatchupsData[mid] = [...teams.teamA, ...teams.teamB];
            });

            let totalPlayersImported = 0;

            const sheetName = wb.SheetNames[0];
            const ws = wb.Sheets[sheetName];
            const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][];

            if (useAI) {
                setIsProcessing(true);
                try {
                    const uploadResult = await uploadRawLaneScores(round.id, data);
                    if (!uploadResult.success || !uploadResult.data) {
                        alert(uploadResult.message || "AI 분석 실패");
                        return;
                    }

                    const rawScores = uploadResult.data;
                    round.matchups.forEach(m => {
                        const currentMatchupScores = tempAllMatchupsData[m.id];
                        const laneParts = m.lanes?.split('-').map(l => parseInt(l.trim())) || [];
                        const startLaneA = laneParts[0];
                        const startLaneB = laneParts[1] || laneParts[0];

                        const getStartInfo = (idx: number) => {
                            if (idx < 3) return { lane: startLaneA, slot: idx + 1 };
                            return { lane: startLaneB, slot: (idx - 3) + 1 };
                        };

                        const allLanesFromMatchups = round.matchups.flatMap(mu => mu.lanes?.split('-').map(l => parseInt(l.trim())) || []).filter(l => !isNaN(l));
                        const detectedFirstLane = allLanesFromMatchups.length > 0 ? Math.min(...allLanesFromMatchups) : 1;
                        const detectedLastLane = allLanesFromMatchups.length > 0 ? Math.max(...allLanesFromMatchups) : 20;

                        const firstLane = round.startLane || detectedFirstLane;
                        const lastLane = round.endLane || detectedLastLane;
                        const totalLanesInRound = (lastLane - firstLane) + 1;
                        const moveType = round.moveLaneType;
                        const moveCount = round.moveLaneCount || 0;
                        const offset = moveCount * 2;

                        currentMatchupScores.forEach((playerScore, pIdx) => {
                            const { lane: startLane, slot } = getStartInfo(pIdx);
                            if (!startLane) return;

                            const findScore = (targetLane: number, targetGame: 'game1' | 'game2' | 'game3') => {
                                const matched = rawScores.find(r => {
                                    let lNum = typeof r.lane === 'number' ? r.lane : parseInt(String(r.lane).replace(/[^0-9]/g, ''));
                                    return lNum === targetLane && r.slot === slot;
                                });
                                if (!matched) return 0;
                                return (targetGame === 'game1' ? matched.game1 : targetGame === 'game2' ? matched.game2 : matched.game3) || 0;
                            };

                            const calculateNextLane = (currLane: number) => {
                                if (moveType === 'RIGHT') return ((currLane - firstLane + offset) % totalLanesInRound) + firstLane;
                                if (moveType === 'LEFT') return (((currLane - firstLane - offset) % totalLanesInRound + totalLanesInRound) % totalLanesInRound) + firstLane;
                                if (moveType === 'CROSS') return currLane % 2 === 0 ? ((currLane - firstLane + offset) % totalLanesInRound) + firstLane : (((currLane - firstLane - offset) % totalLanesInRound + totalLanesInRound) % totalLanesInRound) + firstLane;
                                return currLane;
                            };

                            const s1 = findScore(startLane, 'game1');
                            const g2Lane = calculateNextLane(startLane);
                            const s2 = findScore(g2Lane, 'game2');
                            const g3Lane = calculateNextLane(g2Lane);
                            const s3 = findScore(g3Lane, 'game3');

                            if (s1 || s2 || s3) {
                                currentMatchupScores[pIdx] = { ...currentMatchupScores[pIdx], score1: s1, score2: s2, score3: s3 };
                                totalPlayersImported++;
                            }
                        });
                    });

                    // Update state formatted
                    const finalResults: { [matchupId: string]: { teamA: IndividualScore[], teamB: IndividualScore[] } } = {};
                    Object.entries(tempAllMatchupsData).forEach(([mid, scores]) => {
                        finalResults[mid] = { teamA: scores.slice(0, 3), teamB: scores.slice(3, 6) };
                    });
                    setResults(finalResults);
                    setRawResultData(rawScores);
                } catch (err: any) {
                    alert("업로드 중 오류: " + err.message);
                } finally {
                    setIsProcessing(false);
                }
            } else {
                // Traditional parsing logic
                const HD_KEYS = ['핸디', 'H/C', 'HDC', 'HANDI', 'HDCP'];
                const G1_KEYS = ['1G', '1게임', 'GAME1', 'GAME 1'];
                const G2_KEYS = ['2G', '2게임', 'GAME2', 'GAME 2'];
                const G3_KEYS = ['3G', '3게임', 'GAME3', 'GAME 3'];
                const EXCLUDE_KEYWORDS = ['합계', '합산', '소계', '팀', 'TOTAL', 'SUM', 'SUBTOTAL', 'AVG', '평균'];

                let currentLane: number | null = null;
                let playersFoundForLane = 0;
                let colMap: { [key: string]: number } = {};

                data.forEach((row) => {
                    for (let c = 0; c < row.length; c++) {
                        const cellStr = String(row[c] || '').trim();
                        const laneMatch = cellStr.match(/^(\d+)$/) || cellStr.match(/(\d+)\s*(?:레인|Lane|L)/i);
                        if (laneMatch) {
                            currentLane = parseInt(laneMatch[1]);
                            playersFoundForLane = 0;
                            colMap = {};
                            return;
                        }
                    }

                    if (currentLane === null) return;
                    const rowStr = row.map(c => String(c || '').toUpperCase());
                    if (rowStr.some(s => EXCLUDE_KEYWORDS.some(k => s.includes(k)))) return;

                    const foundG1 = rowStr.findIndex(s => G1_KEYS.some(k => s.includes(k)));
                    if (foundG1 !== -1) {
                        colMap.handicap = rowStr.findIndex(s => HD_KEYS.some(k => s.includes(k)));
                        colMap.score1 = foundG1;
                        colMap.score2 = rowStr.findIndex(s => G2_KEYS.some(k => s.includes(k)));
                        colMap.score3 = rowStr.findIndex(s => G3_KEYS.some(k => s.includes(k)));
                        return;
                    }

                    const numbersWithIdx = row
                        .map((c, idx) => ({ val: typeof c === 'number' ? c : parseInt(String(c || '').replace(/[^0-9]/g, '')), idx }))
                        .filter(n => !isNaN(n.val) && n.val >= 0 && n.val <= 300);

                    if (numbersWithIdx.length >= 3) {
                        const matchup = round.matchups.find(m => m.lanes?.split('-').map(l => parseInt(l.trim())).includes(currentLane!));
                        if (matchup && playersFoundForLane < 6) {
                            const laneParts = matchup.lanes?.split('-').map(l => parseInt(l.trim())) || [];
                            const isTeamBHeader = laneParts.length > 1 && laneParts[1] === currentLane;
                            let playerIdx = playersFoundForLane < 3 ? (isTeamBHeader ? 3 : 0) + playersFoundForLane : (isTeamBHeader ? 0 : 3) + (playersFoundForLane - 3);

                            let s1 = 0, s2 = 0, s3 = 0, hd = 0;
                            if (colMap.score1 !== undefined && colMap.score1 !== -1) {
                                s1 = parseInt(String(row[colMap.score1])) || 0;
                                s2 = parseInt(String(row[colMap.score2])) || 0;
                                s3 = parseInt(String(row[colMap.score3])) || 0;
                                if (colMap.handicap !== -1) hd = parseInt(String(row[colMap.handicap])) || 0;
                            } else {
                                const nums = numbersWithIdx.map(n => n.val);
                                s1 = nums[0] || 0; s2 = nums[1] || 0; s3 = nums[2] || 0;
                            }

                            if (tempAllMatchupsData[matchup.id]?.[playerIdx]) {
                                tempAllMatchupsData[matchup.id][playerIdx] = { ...tempAllMatchupsData[matchup.id][playerIdx], score1: s1, score2: s2, score3: s3, handicap: hd || tempAllMatchupsData[matchup.id][playerIdx].handicap };
                                playersFoundForLane++;
                                totalPlayersImported++;
                            }
                        }
                    }
                });

                const finalResults: { [matchupId: string]: { teamA: IndividualScore[], teamB: IndividualScore[] } } = {};
                Object.entries(tempAllMatchupsData).forEach(([mid, scores]) => {
                    finalResults[mid] = { teamA: scores.slice(0, 3), teamB: scores.slice(3, 6) };
                });
                setResults(finalResults);
                alert(`총 ${totalPlayersImported}명의 선수 데이터를 로드했습니다.`);
            }

            if (fileInputRef.current) fileInputRef.current.value = "";
        };
        reader.readAsBinaryString(file);
        const matchupStats = useMemo(() => {
            const stats: { [matchupId: string]: any } = {};
            round.matchups.forEach(m => {
                const matchupData = results[m.id];
                if (!matchupData) return;

                const calculateTeam = (teamScores: IndividualScore[]) => {
                    const g1 = teamScores.reduce((sum, s) => sum + Math.min((s.score1 || 0) + (s.handicap || 0), 300), 0);
                    const g2 = teamScores.reduce((sum, s) => sum + Math.min((s.score2 || 0) + (s.handicap || 0), 300), 0);
                    const g3 = teamScores.reduce((sum, s) => sum + Math.min((s.score3 || 0) + (s.handicap || 0), 300), 0);
                    const rawHSum = teamScores.reduce((sum, s) => sum + (s.handicap || 0), 0);
                    const hSum = (teamHandicapLimit !== undefined && teamHandicapLimit !== null && rawHSum > teamHandicapLimit) ? teamHandicapLimit : rawHSum;

                    const getHL = (gameIdx: 1 | 2 | 3) => {
                        const vals = teamScores.map(s => s[`score${gameIdx}` as keyof IndividualScore] as number || 0);
                        return vals.length === 0 ? 0 : Math.max(...vals) - Math.min(...vals);
                    };

                    return {
                        g1Total: g1, g2Total: g2, g3Total: g3, hSum, total: g1 + g2 + g3,
                        hiLow: [getHL(1), getHL(2), getHL(3)] as [number, number, number],
                        seriesHiLow: Math.max(g1, g2, g3) - Math.min(g1, g2, g3)
                    };
                };

                const a = calculateTeam(matchupData.teamA);
                const b = calculateTeam(matchupData.teamB);

                const calculateWin = (valA: number, valB: number, hA: number, hB: number, hlA: number, hlB: number): [number, number, string, string] => {
                    if (valA > valB) return [1, 0, 'O', 'X'];
                    if (valA < valB) return [0, 1, 'X', 'O'];
                    if (hA < hB) return [1, 0, 'O', 'X'];
                    if (hB < hA) return [0, 1, 'X', 'O'];
                    if (hlA < hlB) return [1, 0, 'O', 'X'];
                    if (hlB < hlA) return [0, 1, 'X', 'O'];
                    return [0.5, 0.5, '△', '△'];
                };

                const r1 = calculateWin(a.g1Total, b.g1Total, a.hSum, b.hSum, a.hiLow[0], b.hiLow[0]);
                const r2 = calculateWin(a.g2Total, b.g2Total, a.hSum, b.hSum, a.hiLow[1], b.hiLow[1]);
                const r3 = calculateWin(a.g3Total, b.g3Total, a.hSum, b.hSum, a.hiLow[2], b.hiLow[2]);
                const rt = calculateWin(a.total, b.total, a.hSum, b.hSum, a.seriesHiLow, b.seriesHiLow);

                stats[m.id] = {
                    teamA: a, teamB: b,
                    pointsA: Number(r1[0]) + Number(r2[0]) + Number(r3[0]) + Number(rt[0]),
                    pointsB: Number(r1[1]) + Number(r2[1]) + Number(r3[1]) + Number(rt[1]),
                    resultsA: [r1[2], r2[2], r3[2], rt[2]],
                    resultsB: [r1[3], r2[3], r3[3], rt[3]],
                };
            });
            return stats;
        }, [results, round.matchups, teamHandicapLimit]);

        const handleSave = async () => {
            setLoading(true);
            try {
                const dataToSave = Object.entries(results).map(([matchupId, teamData]) => ({
                    matchupId,
                    teamAScores: teamData.teamA.map(s => ({
                        userId: s.userId || undefined,
                        playerName: s.playerName || undefined,
                        teamId: s.teamId,
                        teamSquad: s.teamSquad,
                        handicap: s.handicap,
                        score1: s.score1, score2: s.score2, score3: s.score3,
                    })),
                    teamBScores: teamData.teamB.map(s => ({
                        userId: s.userId || undefined,
                        playerName: s.playerName || undefined,
                        teamId: s.teamId,
                        teamSquad: s.teamSquad,
                        handicap: s.handicap,
                        score1: s.score1, score2: s.score2, score3: s.score3,
                    }))
                }));
                await updateLeagueRoundResults(round.id, dataToSave);
                router.push(`/centers/${centerId}/tournaments/${tournamentId}`);
                router.refresh();
            } catch (error: any) {
                alert(error.message);
            } finally {
                setLoading(false);
            }
        };

        return (
            <div className="max-w-7xl mx-auto space-y-8 pb-20">
                <div className="flex items-center justify-between bg-white p-6 rounded-2xl shadow-sm border-2 border-black">
                    <div className="flex items-center gap-6">
                        <button
                            onClick={() => router.back()}
                            className="w-12 h-12 flex items-center justify-center rounded-xl border-2 border-black hover:bg-black hover:text-white transition-all shadow-md active:scale-95"
                        >
                            ←
                        </button>
                        <div>
                            <div className="flex items-center gap-3">
                                <span className="bg-black text-white px-3 py-1 rounded-lg font-black text-sm uppercase tracking-wider">WEEK {round.roundNumber}</span>
                                <h1 className="text-4xl font-black italic tracking-tighter uppercase leading-none">리그 결과 입력</h1>
                            </div>
                            <p className="text-slate-500 font-bold mt-1">
                                {round.date ? new Date(round.date).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' }) : '일정 미정'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="flex flex-col items-end gap-1">
                            <span className="text-[10px] font-black text-primary uppercase tracking-widest bg-primary/10 px-3 py-1 rounded-full mb-1">Manager Mode</span>
                            <div className="flex items-center gap-3 bg-slate-100 px-4 py-2 rounded-xl border-2 border-black/5 shadow-inner">
                                <span className={`text-[10px] font-black uppercase tracking-tighter ${useAI ? 'text-primary' : 'text-slate-400'}`}>✨ AI 스마트 모드</span>
                                <button
                                    onClick={() => setUseAI(!useAI)}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${useAI ? 'bg-primary' : 'bg-slate-300'}`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${useAI ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleExcelImport}
                                accept=".xlsx, .xls, .csv"
                                className="hidden"
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isProcessing}
                                className={`btn h-14 px-8 font-black border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-lg hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all ${useAI ? 'bg-yellow-400 text-black border-black' : 'btn-outline bg-white'}`}
                            >
                                {isProcessing ? (
                                    <span className="flex items-center gap-2">
                                        <span className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></span>
                                        AI 분석 중...
                                    </span>
                                ) : (
                                    useAI ? '✨ AI 스마트 엑셀 등록' : '📊 엑셀 점수 정규 등록'
                                )}
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={loading || isProcessing}
                                className="btn btn-primary h-14 px-12 font-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] border-2 border-black text-xl hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all"
                            >
                                {loading ? "저장 중..." : "결과 전체 저장"}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="space-y-20">
                    {[...round.matchups]
                        .sort((a, b) => {
                            const laneA = parseInt(a.lanes?.split('-')[0] || '0', 10);
                            const laneB = parseInt(b.lanes?.split('-')[0] || '0', 10);
                            return laneA - laneB;
                        })
                        .map((matchup) => {
                            const stat = matchupStats[matchup.id];
                            if (!stat) return null;

                            const renderTeamTable = (team: Team | null, isRight: boolean) => {
                                const teamKey: 'teamA' | 'teamB' = isRight ? 'teamB' : 'teamA';
                                const matchupData = results[matchup.id];
                                const teamRows = matchupData ? matchupData[teamKey] : [];
                                const s = isRight ? stat.teamB : stat.teamA;
                                const res = isRight ? stat.resultsB : stat.resultsA;
                                const pts = isRight ? stat.pointsB : stat.pointsA;

                                return (
                                    <div className="flex-1 flex flex-col bg-white border-4 border-black shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] overflow-hidden rounded-2xl">
                                        <div className={`p-4 ${isRight ? 'bg-slate-900 text-white' : 'bg-primary text-primary-foreground'} flex justify-between items-center border-b-4 border-black`}>
                                            <div className="space-y-0.5">
                                                <h3 className="text-2xl font-black tracking-tighter">
                                                    {team?.name || '부전승'}
                                                    {((isRight ? matchup.teamBSquad : matchup.teamASquad)) ? ` (${isRight ? matchup.teamBSquad : matchup.teamASquad})` : ''}
                                                </h3>
                                                <div className="text-[10px] font-bold opacity-60 uppercase tracking-widest">{isRight ? 'Away Team' : 'Home Team'}</div>
                                            </div>
                                            <div className="text-4xl font-black italic">{pts.toFixed(1)}<span className="text-sm not-italic opacity-50 ml-1 uppercase">pts</span></div>
                                        </div>

                                        <table className="w-full border-collapse">
                                            <thead className="bg-slate-50 border-b-2 border-black">
                                                <tr className="text-[11px] font-black uppercase text-slate-500">
                                                    <th className="p-3 border-r border-black/10 text-left w-28">선수 성명</th>
                                                    <th className="p-3 border-r border-black/10 w-16">핸디</th>
                                                    <th className="p-3 border-r border-black/10">1G</th>
                                                    <th className="p-3 border-r border-black/10">2G</th>
                                                    <th className="p-3 border-r border-black/10">3G</th>
                                                    <th className="p-3 bg-slate-100 text-black">총점</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-black/10 font-black">
                                                {teamRows.map((r, rowIdx) => (
                                                    <tr key={rowIdx}>
                                                        <td className="p-1 border-r border-black/10">
                                                            <input
                                                                type="text"
                                                                placeholder="이름 입력"
                                                                value={r.playerName ?? ''}
                                                                onChange={(e) => handlePlayerChange(matchup.id, teamKey, rowIdx, 'playerName', e.target.value)}
                                                                className="w-full h-10 px-3 text-center bg-transparent border-2 border-transparent focus:border-black rounded-lg outline-none transition-all text-sm"
                                                            />
                                                        </td>
                                                        <td className="p-1 border-r border-black/10">
                                                            <input
                                                                type="number"
                                                                value={r.handicap}
                                                                onChange={(e) => handlePlayerChange(matchup.id, teamKey, rowIdx, 'handicap', parseInt(e.target.value) || 0)}
                                                                className="w-full h-10 text-center bg-transparent border-2 border-transparent focus:border-black rounded-lg outline-none transition-all"
                                                            />
                                                        </td>
                                                        {[1, 2, 3].map(g => (
                                                            <td key={g} className="p-1 border-r border-black/10">
                                                                <input
                                                                    type="number"
                                                                    max={300}
                                                                    onInput={(e) => {
                                                                        const target = e.target as HTMLInputElement;
                                                                        if (parseInt(target.value) > 300) target.value = "300";
                                                                    }}
                                                                    value={r[`score${g}` as keyof IndividualScore] ?? 0}
                                                                    onChange={(e) => handlePlayerChange(matchup.id, teamKey, rowIdx, `score${g}` as any, parseInt(e.target.value) || 0)}
                                                                    className="w-full h-10 text-center font-black bg-primary/5 focus:bg-white border-2 border-transparent focus:border-black rounded-lg outline-none transition-all"
                                                                />
                                                            </td>
                                                        ))}
                                                        <td className="p-3 text-center bg-slate-50 text-base font-black">
                                                            {Math.min((r.score1 || 0) + (r.handicap || 0), 300) + Math.min((r.score2 || 0) + (r.handicap || 0), 300) + Math.min((r.score3 || 0) + (r.handicap || 0), 300)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot className="border-t-2 border-black font-black">
                                                <tr className="bg-slate-50 text-xs">
                                                    <td className="p-4 border-r border-black/10 uppercase tracking-tighter">팀 종합</td>
                                                    <td className="p-4 border-r border-black/10 text-center text-primary text-base">{s.hSum}</td>
                                                    <td className="p-4 border-r border-black/10 text-center text-base font-black">{s.g1Total}</td>
                                                    <td className="p-4 border-r border-black/10 text-center text-base font-black">{s.g2Total}</td>
                                                    <td className="p-4 border-r border-black/10 text-center text-base font-black">{s.g3Total}</td>
                                                    <td className="p-3 bg-slate-900 text-white text-center text-xl italic">
                                                        {s.total}
                                                    </td>
                                                </tr>
                                                <tr className="bg-white border-t border-black/10">
                                                    <td className="p-4 border-r border-black/10 uppercase text-[10px] tracking-widest text-slate-400" colSpan={2}>게임별 승패</td>
                                                    {[0, 1, 2].map(i => (
                                                        <td key={i} className="p-4 border-r border-black/10 text-center">
                                                            <span className={`text-3xl italic ${res[i] === 'O' ? 'text-green-600' : res[i] === 'X' ? 'text-red-500' : 'text-slate-300'}`}>
                                                                {res[i]}
                                                            </span>
                                                        </td>
                                                    ))}
                                                    <td className="p-4 text-center">
                                                        <span className={`text-3xl italic ${res[3] === 'O' ? 'text-green-600' : res[3] === 'X' ? 'text-red-500' : 'text-slate-300'}`}>
                                                            {res[3]}
                                                        </span>
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                );
                            };

                            return (
                                <div key={matchup.id} className="relative">
                                    <div className="absolute left-1/2 -top-10 -translate-x-1/2 z-10">
                                        <div className="bg-black text-white px-10 py-3 rounded-full font-black border-4 border-white shadow-2xl skew-x-[-15deg]">
                                            <span className="skew-x-[15deg] text-xl flex items-center gap-4 italic tracking-widest">
                                                <span className="opacity-40 uppercase text-xs">Lanes</span> {matchup.lanes}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col xl:flex-row gap-12 pt-4">
                                        {renderTeamTable(matchup.teamA, false)}
                                        <div className="hidden xl:flex items-center justify-center pointer-events-none select-none">
                                            <span className="text-8xl font-black italic opacity-5 tracking-tighter">VERSUS</span>
                                        </div>
                                        {renderTeamTable(matchup.teamB, true)}
                                    </div>
                                </div>
                            );
                        })}
                </div>

                <div className="bg-slate-900 p-12 rounded-[3rem] border-4 border-black text-center space-y-6">
                    <div className="flex justify-center gap-12 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
                        <div className="flex items-center gap-3"><span className="w-3 h-3 rounded-full bg-green-500"></span> Winner (1.0)</div>
                        <div className="flex items-center gap-3"><span className="w-3 h-3 rounded-full bg-slate-500"></span> Tie-break Rules Applied</div>
                        <div className="flex items-center gap-3"><span className="w-3 h-3 rounded-full bg-red-500"></span> Loser (0.0)</div>
                    </div>
                </div>
                {/* AI Raw Extraction Results for Verification */}
                {rawResultData.length > 0 && (
                    <div style={{ marginTop: '40px', padding: '20px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '16px', color: '#60A5FA' }}>
                            📊 AI 추출 데이터 대조표 (데이터 검증용)
                        </h3>
                        <p style={{ fontSize: '0.875rem', color: '#94A3B8', marginBottom: '12px' }}>
                            AI가 엑셀에서 인식한 원본 데이터입니다. 매칭 결과가 이상할 경우 아래 표와 엑셀을 비교해 보세요.
                        </p>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid rgba(255,255,255,0.1)', textAlign: 'left' }}>
                                        <th style={{ padding: '8px' }}>레인</th>
                                        <th style={{ padding: '8px' }}>슬롯</th>
                                        <th style={{ padding: '8px' }}>1G</th>
                                        <th style={{ padding: '8px' }}>2G</th>
                                        <th style={{ padding: '8px' }}>3G</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rawResultData.sort((a, b) => {
                                        const aNum = parseInt(String(a.lane).replace(/[^0-9]/g, '')) || 0;
                                        const bNum = parseInt(String(b.lane).replace(/[^0-9]/g, '')) || 0;
                                        return aNum - bNum || a.slot - b.slot;
                                    }).map((row, idx) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                            <td style={{ padding: '8px' }}>{row.lane}</td>
                                            <td style={{ padding: '8px' }}>{row.slot}</td>
                                            <td style={{ padding: '8px' }}>{row.game1 || '-'}</td>
                                            <td style={{ padding: '8px' }}>{row.game2 || '-'}</td>
                                            <td style={{ padding: '8px' }}>{row.game3 || '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        );
    }
