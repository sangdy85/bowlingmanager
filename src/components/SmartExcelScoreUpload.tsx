import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { analyzeLeagueRoundExcelWithGemini } from '@/app/actions/gemini-score';

interface SmartExcelScoreUploadProps {
    onDataParsed: (data: any) => void;
    gameCount?: number;
}

export default function SmartExcelScoreUpload({ onDataParsed, gameCount = 3 }: SmartExcelScoreUploadProps) {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [rawScores, setRawScores] = useState<any[]>([]); // New state for verification table
    const [showRawScores, setShowRawScores] = useState(false); // Collapsible state
    const [uploadMode, setUploadMode] = useState<'AI' | 'STANDARD' | 'STANDARD2'>('AI');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const downloadTemplate = () => {
        // Create header: Lane, Slot, 1G, 2G, ..., NG
        const header = ['레인(Lane)', '순번(Slot)'];
        for (let i = 1; i <= gameCount; i++) {
            header.push(`${i}G`);
        }

        const sampleRow1 = [1, 1];
        const sampleRow2 = [1, 2];
        for (let i = 1; i <= gameCount; i++) {
            sampleRow1.push(150 + (i * 10));
            sampleRow2.push(160 + (i * 10));
        }

        const data = [header, sampleRow1, sampleRow2];
        const ws = XLSX.utils.aoa_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'ScoreTemplate');
        XLSX.writeFile(wb, `BowlingScoreTemplate_${gameCount}G.xlsx`);
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setMessage(null);
        setRawScores([]);
        setShowRawScores(false);
        setIsAnalyzing(true);

        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

            // Sanitize and filter empty rows
            const sanitizedData = jsonData.filter((row: any) => {
                if (!Array.isArray(row)) return false;
                return row.some(cell => cell !== null && cell !== undefined && cell !== '');
            }) as any[][];

            if (uploadMode === 'STANDARD') {
                // 1. Standard Mode: Strict Parsing
                if (sanitizedData.length < 2) {
                    throw new Error("데이터가 너무 부족합니다. 정해진 양식에 맞춰 작성해주세요.");
                }

                // Header Validation (Row 1 / Index 0)
                const headerRow = sanitizedData[0];
                const isLaneCol = String(headerRow[0] || '').toLowerCase().includes('레인') || String(headerRow[0] || '').toLowerCase().includes('lane');
                const isSlotCol = String(headerRow[1] || '').toLowerCase().includes('순번') || String(headerRow[1] || '').toLowerCase().includes('slot');

                if (!isLaneCol || !isSlotCol) {
                    throw new Error("정해진 양식(A열:레인, B열:순번)과 정보가 일치 하지 않아 업로드 할 수 없습니다.");
                }

                const processed = sanitizedData.slice(1).map((row: any) => {
                    const laneRaw = row[0];
                    const slotRaw = row[1];

                    const lane = typeof laneRaw === 'number' ? laneRaw : parseInt(String(laneRaw).replace(/[^0-9]/g, '')) || 0;
                    const slot = typeof slotRaw === 'number' ? slotRaw : parseInt(String(slotRaw).replace(/[^0-9]/g, '')) || 0;

                    if (!lane || !slot) return null;

                    const scores: number[] = [];
                    for (let i = 0; i < gameCount; i++) {
                        const scoreIdx = 2 + i;
                        const scoreVal = parseInt(String(row[scoreIdx] || '0').replace(/[^0-9]/g, ''));
                        scores.push(isNaN(scoreVal) ? 0 : scoreVal);
                    }

                    return {
                        lane,
                        slot,
                        games: scores
                    };
                }).filter(r => r !== null);

                if (processed.length === 0) {
                    throw new Error("처리할 수 있는 점수 데이터가 없습니다. 양식의 정보를 확인해주세요.");
                }

                onDataParsed(processed);
                setRawScores(processed);
                setMessage({ type: 'success', text: `표준 양식 분석 완료! ${processed.length}개의 데이터를 읽었습니다.` });
            } else if (uploadMode === 'STANDARD2') {
                // 2. Standard Mode 2: Event Tournament parsing (e.g. JangAn Perfect)
                const processed = [];
                let currentLane = 0;

                for (let r = 0; r < sanitizedData.length; r++) {
                    const row = sanitizedData[r];
                    
                    let laneFoundInRow = false;
                    for (let c = 0; c < row.length; c++) {
                        const cell = String(row[c] || '').trim();
                        if (cell.replace(/\s+/g, '').startsWith('레인:')) {
                            const match = cell.match(/\d+/);
                            if (match) {
                                currentLane = parseInt(match[0]);
                                laneFoundInRow = true;
                            }
                            break;
                        }
                    }
                    
                    if (laneFoundInRow && currentLane > 0) {
                        let slot = 1;
                        for (let pr = r + 1; pr < sanitizedData.length; pr++) {
                            const pRow = sanitizedData[pr];
                            if (!pRow) break;
                            
                            // Check if this row is a new block (contains "레인:" or "소속")
                            if (pRow.some(cell => {
                                const text = String(cell).replace(/\s+/g, '');
                                return text.startsWith('레인:') || text.includes('소속');
                            })) {
                                break;
                            }
                            
                            let nameCol = 0;
                            while(nameCol < pRow.length && !String(pRow[nameCol] || '').trim()) {
                                nameCol++;
                            }
                            
                            const pName = String(pRow[nameCol] || '').trim();
                            
                            if (pName === '참가자' || !pName || pName.includes('팀') || pName.includes('총점')) {
                                continue;
                            }
                            
                            const scores: number[] = [];
                            let scoreStartCol = nameCol + 1;
                            while(scoreStartCol < pRow.length && String(pRow[scoreStartCol] || '').trim() === '') {
                                scoreStartCol++;
                            }
                            
                            let hasValidScore = false;
                            for (let g = 0; g < gameCount; g++) {
                                const scoreIdx = scoreStartCol + g;
                                const valStr = String(pRow[scoreIdx] || '0').trim();
                                const val = parseInt(valStr.replace(/[^0-9]/g, ''));
                                const finalScore = isNaN(val) ? 0 : val;
                                scores.push(finalScore);
                                if (finalScore > 0) hasValidScore = true;
                            }
                            
                            // Check if this is actually the header row "1, 2, 3..."
                            // Usually a player won't score exactly 1, 2, 3 in order.
                            // If the first score is 1, and the second is 2 (if gameCount > 1), it's the header row.
                            if (scores[0] === 1 && (gameCount < 2 || scores[1] === 2)) {
                                continue;
                            }
                            
                            if (hasValidScore) {
                                processed.push({
                                    lane: currentLane,
                                    slot,
                                    games: scores
                                });
                                slot++;
                            }
                        }
                    }
                }

                if (processed.length === 0) {
                    throw new Error("처리할 수 있는 점수 데이터가 없습니다. 양식(레인: X) 정보를 확인해주세요.");
                }

                onDataParsed(processed);
                setRawScores(processed);
                setMessage({ type: 'success', text: `표준 양식 2 분석 완료! ${processed.length}개의 데이터를 읽었습니다.` });
            } else {
                // 3. AI Mode: Call Server Action
                const result = await analyzeLeagueRoundExcelWithGemini(sanitizedData, gameCount);

                if (result.success && result.data) {
                    onDataParsed(result.data);
                    setRawScores(result.data);
                    const totalRecords = result.data.length;
                    setMessage({ type: 'success', text: `AI 분석 완료! ${totalRecords}개의 데이터를 읽었습니다.` });
                } else if (result.errorType === 'QUOTA') {
                    setMessage({ type: 'error', text: result.message || "무료 사용량을 초과했습니다." });
                } else {
                    setMessage({ type: 'error', text: result.message || "분석에 실패했습니다." });
                }
            }
        } catch (err: any) {
            console.error(err);
            setMessage({ type: 'error', text: err.message || "파일 처리 중 오류가 발생했습니다." });
        } finally {
            setIsAnalyzing(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <div className="flex flex-col gap-4 w-full">
            <div className="flex items-center gap-2">
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept=".xlsx, .xls"
                    className="hidden"
                />

                <button
                    type="button"
                    onClick={() => { setUploadMode('AI'); setTimeout(() => fileInputRef.current?.click(), 0); }}
                    disabled={isAnalyzing}
                    className="btn bg-green-600 hover:bg-green-700 text-white font-black shadow-md border-0 flex items-center gap-2 transition-all active:scale-95 h-12 px-5"
                >
                    {isAnalyzing && uploadMode === 'AI' ? (
                        <span className="loading loading-spinner loading-sm"></span>
                    ) : (
                        <span className="text-xl">✨</span>
                    )}
                    <span>AI 업로드</span>
                </button>

                <div className="flex flex-wrap items-center gap-2 mt-2">
                    <button
                        type="button"
                        onClick={() => { setUploadMode('STANDARD'); setTimeout(() => fileInputRef.current?.click(), 0); }}
                        disabled={isAnalyzing}
                        className="btn bg-slate-600 hover:bg-slate-700 text-white font-black shadow-md border-0 flex items-center gap-2 transition-all active:scale-95 h-10 px-4 shrink-0 text-sm"
                    >
                        {isAnalyzing && uploadMode === 'STANDARD' ? (
                            <span className="loading loading-spinner loading-sm"></span>
                        ) : (
                            <span className="text-lg">📋</span>
                        )}
                        <span>표준 양식 업로드</span>
                    </button>
                    
                    <button
                        type="button"
                        onClick={() => { setUploadMode('STANDARD2'); setTimeout(() => fileInputRef.current?.click(), 0); }}
                        disabled={isAnalyzing}
                        className="btn bg-indigo-600 hover:bg-indigo-700 text-white font-black shadow-md border-0 flex items-center gap-2 transition-all active:scale-95 h-10 px-4 shrink-0 text-sm"
                    >
                        {isAnalyzing && uploadMode === 'STANDARD2' ? (
                            <span className="loading loading-spinner loading-sm"></span>
                        ) : (
                            <span className="text-lg">🎳</span>
                        )}
                        <span>이벤트전 양식 (JangAn)</span>
                    </button>

                    <button
                        type="button"
                        onClick={downloadTemplate}
                        className="text-[10px] text-slate-400 hover:text-blue-500 underline whitespace-nowrap ml-auto"
                    >
                        [{gameCount}게임 표준양식 다운로드]
                    </button>
                </div>

                {message && (
                    <div className={`text-sm px-3 py-1 rounded-full font-medium ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                        {message.text}
                    </div>
                )}
            </div>

            {/* Verification Table - Collapsible */}
            {rawScores.length > 0 && (
                <div className="mt-2">
                    <button
                        type="button"
                        onClick={() => setShowRawScores(!showRawScores)}
                        className="text-xs font-bold text-slate-500 hover:text-blue-600 flex items-center gap-1.5 transition-colors mb-2 ml-1"
                    >
                        {showRawScores ? '🔼 분석 데이터 대조표 접기' : '🔽 분석 데이터 대조표 펼쳐보기 (검증용)'}
                    </button>

                    {showRawScores && (
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-inner animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="font-black text-slate-700 text-sm flex items-center gap-2">
                                    🔍 데이터 대조표 (원본 검증)
                                </h4>
                                <button onClick={() => setShowRawScores(false)} className="text-slate-400 hover:text-slate-600 text-xs">닫기</button>
                            </div>
                            <div className="max-h-[300px] overflow-y-auto overflow-x-auto">
                                <table className="w-full text-[11px] border-collapse bg-white">
                                    <thead className="sticky top-0 bg-slate-100 z-10">
                                        <tr className="border-b border-slate-300">
                                            <th className="p-2 text-center w-16">레인</th>
                                            <th className="p-2 text-center w-12">순번</th>
                                            {Array.from({ length: gameCount }).map((_, i) => (
                                                <th key={i} className="p-2 text-center">{i + 1}G</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {rawScores.sort((a, b) => {
                                            const aL = parseInt(String(a.lane).replace(/[^0-9]/g, '')) || 0;
                                            const bL = parseInt(String(b.lane).replace(/[^0-9]/g, '')) || 0;
                                            return aL - bL || (a.slot - b.slot);
                                        }).map((row, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50">
                                                <td className="p-2 text-center font-bold text-blue-600">{row.lane}</td>
                                                <td className="p-2 text-center text-slate-400">{row.slot}</td>
                                                {Array.from({ length: gameCount }).map((_, i) => (
                                                    <td key={i} className="p-2 text-center font-black">{row.games?.[i] || '-'}</td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <p className="mt-2 text-[10px] text-slate-400">
                                ※ 분석된 내용입니다. 배정된 선수와 점수가 다르게 매칭된다면 여기서 레인 번호와 순번을 확인하세요.
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
