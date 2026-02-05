'use client';

import { useState, useRef, useEffect } from 'react';
import { analyzeScoreboardWithGemini, GeminiParsedRow } from '@/app/actions/gemini-score';

interface GeminiScoreUploadProps {
    knownMembers: string[];
    rows: GeminiParsedRow[];
    setRows: (rows: GeminiParsedRow[]) => void;
}

export default function GeminiScoreUpload({ knownMembers, rows, setRows }: GeminiScoreUploadProps) {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [showQuotaModal, setShowQuotaModal] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setMessage(null);
        setShowQuotaModal(false);
        setIsAnalyzing(true);
        setRows([]);

        try {
            const formData = new FormData();
            formData.append('image', file);
            formData.append('knownMembers', JSON.stringify(knownMembers));

            const result = await analyzeScoreboardWithGemini(formData);

            if (result.success && result.data) {
                setRows(result.data);
                setMessage({ type: 'success', text: `분석 완료! ${result.data.length}명의 기록을 찾았습니다.` });
            } else if (result.errorType === 'QUOTA') {
                setShowQuotaModal(true);
            } else {
                setMessage({ type: 'error', text: result.message || "분석에 실패했습니다." });
            }
        } catch (err) {
            console.error(err);
            setMessage({ type: 'error', text: "이미지 처리 중 오류가 발생했습니다." });
        } finally {
            setIsAnalyzing(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const removeRow = (index: number) => {
        setRows(rows.filter((_, i) => i !== index));
    };

    return (
        <div className="flex flex-col h-full space-y-4">
            {/* Header / Upload Tool */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 border rounded-xl bg-muted/10 shadow-sm">
                <div className="flex items-center gap-3">
                    <span className="text-3xl">⚡</span>
                    <div>
                        <h3 className="font-bold text-base leading-none mb-1">AI 자동 분석</h3>
                        <p className="text-xs text-muted-foreground">사진을 올리면 자동으로 입력됩니다.</p>
                    </div>
                </div>

                <div className="flex gap-2">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        accept="image/*"
                        className="hidden"
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isAnalyzing}
                        className="btn btn-primary btn-md gap-2 shadow-md hover:scale-105 transition-transform"
                    >
                        {isAnalyzing ? (
                            <span className="loading loading-spinner loading-sm"></span>
                        ) : (
                            <span className="text-lg">📸</span>
                        )}
                        <span>새 사진 올리기</span>
                    </button>
                    {rows.length > 0 && (
                        <button onClick={() => setRows([])} className="btn btn-ghost btn-md border px-4">
                            초기화
                        </button>
                    )}
                </div>
            </div>

            {/* Analysis Result Area */}
            <div className="border rounded-xl bg-card overflow-hidden shadow-sm flex flex-col">
                <div className="bg-muted/30 p-3 border-b grid grid-cols-[140px_1fr_40px] gap-3 text-center text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    <div>이름</div>
                    <div>점수 (콤마로 구분)</div>
                    <div></div>
                </div>

                <div className="max-h-[500px] overflow-y-auto p-4 space-y-6 bg-muted/5 min-h-[150px] relative">
                    {isAnalyzing && (
                        <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center text-center p-6 animate-in fade-in duration-300">
                            <span className="loading loading-spinner loading-lg text-primary mb-4"></span>
                            <p className="font-bold text-lg">점수판 분석 중...</p>
                            <p className="text-sm text-muted-foreground mt-1">Gemini가 이미지를 읽고 있습니다.<br />잠시만 기다려주세요.</p>
                        </div>
                    )}

                    {rows.length === 0 && !isAnalyzing ? (
                        <div className="py-12 flex flex-col items-center justify-center text-muted-foreground/60 space-y-3">
                            <div className="text-6xl grayscale opacity-30">📸</div>
                            <p className="text-sm font-medium">분석할 사진을 업로드해 주세요.</p>
                        </div>
                    ) : (
                        rows.map((row, idx) => (
                            <div key={idx} className="grid grid-cols-[140px_1fr_40px] gap-2 items-center animate-in fade-in slide-in-from-bottom-2 duration-300 bg-background p-3 rounded-xl border-2 shadow-sm group hover:border-primary/20 transition-colors">
                                <RowInput
                                    member={row.memberName}
                                    scores={row.scores}
                                    knownMembers={knownMembers}
                                    onUpdate={(m, s) => {
                                        const newRows = [...rows];
                                        newRows[idx].memberName = m;
                                        newRows[idx].scores = s;
                                        setRows(newRows);
                                    }}
                                />
                                <button
                                    onClick={() => removeRow(idx)}
                                    className="btn btn-ghost btn-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 w-8 rounded-full flex items-center justify-center transition-all"
                                    title="행 삭제"
                                >
                                    ✕
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {message && (
                <div className={`p-3 rounded-lg text-sm font-bold text-center animate-in zoom-in-95 duration-200 ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                    {message.text}
                </div>
            )}

            {rows.length > 0 && !isAnalyzing && (
                <div className="flex flex-col gap-2 pt-2">
                    <div className="text-[10px] text-muted-foreground text-center italic">
                        ※ 실제 저장하려면 아래 하단의 '저장' 버튼을 눌러주세요.
                    </div>
                </div>
            )}

            <datalist id="known-members-datalist">
                {knownMembers.map((m: string) => (
                    <option key={m} value={m} />
                ))}
            </datalist>

            {/* Quota Exceeded Modal */}
            {showQuotaModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-background rounded-xl shadow-xl p-6 max-w-sm w-full mx-4 border-2 border-primary/20">
                        <div className="text-center space-y-4">
                            <div className="text-4xl">🤖</div>
                            <h3 className="text-lg font-bold">무료 사용량 초과</h3>
                            <p className="text-muted-foreground text-sm">
                                오늘 무료 분석 횟수를 모두 사용했습니다.<br />내일 다시 시도해주세요.
                            </p>
                            <button
                                onClick={() => setShowQuotaModal(false)}
                                className="btn btn-primary w-full"
                            >
                                확인
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function RowInput({ member, scores, knownMembers, onUpdate }: {
    member: string;
    scores: number[];
    knownMembers: string[];
    onUpdate: (m: string, s: number[]) => void;
}) {
    // Local state to allow free typing (including commas) without premature re-formatting
    const [localText, setLocalText] = useState(scores.join(', '));

    // Sync from props only if the incoming scores are semantically different from our current local input.
    // This prevents the "typed comma disappears" issue.
    useEffect(() => {
        const currentParsed = localText.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
        const isDifferent = JSON.stringify(currentParsed) !== JSON.stringify(scores);
        if (isDifferent) {
            setLocalText(scores.join(', '));
        }
        // We omit localText from deps to prevent loop on typing, effectively syncing only on props change
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scores]);

    return (
        <>
            <div className="relative group/name">
                <input
                    list="known-members-datalist"
                    className="input h-9 text-sm w-full bg-muted/20 border-transparent focus:border-primary/30 transition-colors"
                    value={member}
                    onChange={(e) => onUpdate(e.target.value, scores)}
                    placeholder="이름"
                />
                {!knownMembers.includes(member) && member && member !== 'Unknown' && (
                    <span className="absolute -top-2 -right-1 bg-amber-500 text-[9px] text-white px-1.5 py-0.5 rounded-full font-bold shadow-sm whitespace-nowrap z-10">
                        비회원
                    </span>
                )}
            </div>
            <input
                className="input h-9 text-sm font-mono tracking-tight bg-muted/20 border-transparent focus:border-primary/30 transition-colors"
                placeholder="점수들 (150, 180...)"
                value={localText}
                onChange={(e) => {
                    const val = e.target.value;
                    setLocalText(val);
                    const nums = val.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
                    onUpdate(member, nums);
                }}
            />
        </>
    );
}
