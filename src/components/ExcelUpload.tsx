'use client';

import { useState } from 'react';
import * as XLSX from 'xlsx';
import { bulkAddScores, BulkScoreData } from '@/app/actions/score-bulk';
import { analyzeExcelWithGemini } from '@/app/actions/gemini-score';

export default function ExcelUpload() {
    const [previewData, setPreviewData] = useState<BulkScoreData[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [useAI, setUseAI] = useState(true);

    const [gameType, setGameType] = useState("정기전");
    const [defaultDate, setDefaultDate] = useState(new Date().toISOString().split('T')[0]);
    const GAME_TYPES = ["정기전", "벙개", "상주", "교류전", "기타"];

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

            if (useAI) {
                setIsProcessing(true);
                setMessage(null);
                try {
                    // Send structure-agnostic JSON to Gemini
                    const result = await analyzeExcelWithGemini(rawData);
                    if (result.success && result.data) {
                        setPreviewData(result.data);
                    } else {
                        setMessage({ type: 'error', text: result.message || "AI 분석에 실패했습니다." });
                    }
                } catch (err) {
                    setMessage({ type: 'error', text: "AI 분석 중 오류가 발생했습니다." });
                } finally {
                    setIsProcessing(false);
                }
            } else {
                // Legacy logic (assuming Row 1 is header)
                const parsed: BulkScoreData[] = [];
                for (let i = 1; i < rawData.length; i++) {
                    const row = rawData[i];
                    if (!row[0]) continue;
                    const memberName = row[0];
                    const scores: number[] = [];
                    let memo = '';
                    for (let j = 1; j < row.length; j++) {
                        const cell = row[j];
                        if (typeof cell === 'number') {
                            scores.push(cell);
                        } else if (typeof cell === 'string') {
                            const num = parseInt(cell);
                            if (!isNaN(num) && num >= 0 && num <= 300) {
                                scores.push(num);
                            } else {
                                memo = cell;
                            }
                        }
                    }
                    if (scores.length > 0) {
                        parsed.push({ memberName, scores, memo: memo || undefined });
                    }
                }
                setPreviewData(parsed);
                setMessage(null);
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleUpload = async () => {
        if (previewData.length === 0) return;
        setIsUploading(true);
        // bulkAddScores now supports per-row gameDate
        const result = await bulkAddScores(previewData, defaultDate, gameType);
        setIsUploading(false);
        setMessage({ type: result.success ? 'success' : 'error', text: result.message });
        if (result.success) {
            setPreviewData([]);
        }
    };

    const downloadTemplate = () => {
        const ws = XLSX.utils.aoa_to_sheet([
            ["이름", "1G", "2G", "3G", "4G", "메모"],
            ["홍길동", 150, 180, 200, "", "정기전"],
            ["김철수", 120, 130, 140, 150, ""]
        ]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template");
        XLSX.writeFile(wb, "score_template.xlsx");
    };

    // Group preview data by date for better display
    const groupedData: Record<string, BulkScoreData[]> = {};
    previewData.forEach(item => {
        const d = item.gameDate || defaultDate;
        if (!groupedData[d]) groupedData[d] = [];
        groupedData[d].push(item);
    });

    return (
        <div className="flex flex-col gap-4">
            <div className="card" style={{ padding: '1.5rem', border: '1px solid var(--primary)', backgroundColor: 'rgba(59, 130, 246, 0.05)' }}>
                <div className="flex justify-between items-center">
                    <div>
                        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            ✨ AI 스마트 엑셀 분석
                            <span style={{ fontSize: '10px', backgroundColor: 'var(--primary)', color: 'white', padding: '2px 6px', borderRadius: '10px', textTransform: 'uppercase' }}>Alpha</span>
                        </h3>
                        <p style={{ fontSize: '0.875rem', color: 'var(--secondary-foreground)', margin: '0.5rem 0 0 0' }}>양식에 상관없이 엑셀 내용을 AI가 자동으로 분석합니다.</p>
                    </div>
                    <div className="flex items-center gap-3" style={{ backgroundColor: 'white', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                        <div className="flex flex-col" style={{ lineHeight: '1.2', fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--primary)', textAlign: 'center' }}>
                            <span>AI</span>
                            <span>사용</span>
                        </div>
                        <button
                            onClick={() => setUseAI(!useAI)}
                            style={{ width: '40px', height: '20px', borderRadius: '10px', border: 'none', position: 'relative', cursor: 'pointer', backgroundColor: useAI ? 'var(--primary)' : '#cbd5e1', transition: 'background-color 0.2s' }}
                        >
                            <div style={{ position: 'absolute', top: '3px', width: '14px', height: '14px', backgroundColor: 'white', borderRadius: '50%', transition: 'left 0.2s', left: useAI ? '23px' : '3px' }} />
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex flex-col gap-4">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 flex flex-col gap-2">
                        <label htmlFor="bulkDate" className="label" style={{ fontWeight: 'bold' }}>기본 날짜</label>
                        <input
                            type="date"
                            id="bulkDate"
                            className="input"
                            value={defaultDate}
                            onChange={(e) => setDefaultDate(e.target.value)}
                        />
                        <p style={{ fontSize: '10px', color: 'var(--secondary-foreground)', marginTop: '-0.5rem' }}>* 엑셀에 날짜가 없을 경우 이 날짜로 저장됩니다.</p>
                    </div>
                    <div className="flex-1 flex flex-col gap-2">
                        <label htmlFor="bulkGameType" className="label" style={{ fontWeight: 'bold' }}>일괄 게임 분류</label>
                        <select
                            id="bulkGameType"
                            className="select"
                            value={gameType}
                            onChange={(e) => setGameType(e.target.value)}
                        >
                            {GAME_TYPES.map(type => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div style={{ position: 'relative' }}>
                    <input
                        type="file"
                        accept=".xlsx, .xls"
                        style={{ display: 'none' }}
                        id="excelFileInput"
                        onChange={handleFileUpload}
                        disabled={isProcessing}
                    />
                    <label
                        htmlFor="excelFileInput"
                        className="btn"
                        style={{
                            width: '100%',
                            height: '80px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            border: '2px dashed var(--border)',
                            backgroundColor: isProcessing ? 'var(--input)' : 'transparent',
                        }}
                    >
                        {isProcessing ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ width: '16px', height: '16px', border: '2px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%' }} />
                                AI 분석 중...
                            </span>
                        ) : (
                            <>
                                <span style={{ fontWeight: 'bold', color: 'var(--primary)' }}>📂 엑셀 파일 선택하기</span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--secondary-foreground)' }}>이곳을 클릭하거나 파일을 끌어다 놓으세요.</span>
                            </>
                        )}
                    </label>
                </div>
            </div>

            {previewData.length > 0 && (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ backgroundColor: 'var(--secondary)', padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 'bold', fontSize: '0.875rem' }}>분석 결과 미리보기</span>
                        <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>총 {previewData.length}건</span>
                    </div>

                    <div className="overflow-x-auto" style={{ maxHeight: '400px' }}>
                        <div style={{ minWidth: '400px' }}>
                            {Object.entries(groupedData).map(([date, items]) => (
                                <div key={date}>
                                    <div style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: '0.5rem 1rem', fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                                        📅 {date}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        {items.map((row, idx) => (
                                            <div key={idx} style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div>
                                                    <div style={{ fontWeight: '700' }}>{row.memberName}</div>
                                                    <div style={{ fontSize: '10px', color: 'var(--secondary-foreground)' }}>{row.memo || '-'}</div>
                                                </div>
                                                <div style={{ display: 'flex', gap: '4px' }}>
                                                    {row.scores.map((s, si) => (
                                                        <span key={si} style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--input)', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                                                            {s}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div style={{ padding: '1rem' }}>
                        <button
                            onClick={handleUpload}
                            disabled={isUploading}
                            className="btn btn-primary w-full"
                        >
                            {isUploading ? '저장 중...' : '데이터베이스에 저장하기'}
                        </button>
                    </div>
                </div>
            )}

            {message && (
                <div className={`card`} style={{ padding: '1rem', textAlign: 'center', backgroundColor: message.type === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: message.type === 'success' ? '#4ade80' : '#f87171' }}>
                    {message.text}
                </div>
            )}
        </div>
    );
}
