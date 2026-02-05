'use client';

import { useState, useRef, MouseEvent } from 'react';
import { bulkAddScores, BulkScoreData } from '@/app/actions/score-bulk';

interface SplitViewScoreEntryProps {
    knownMembers: string[];
}

export default function SplitViewScoreEntry({ knownMembers }: SplitViewScoreEntryProps) {
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [rows, setRows] = useState<BulkScoreData[]>([{ memberName: '', scores: [] }]);
    const [isUploading, setIsUploading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Image Viewer State
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const imgRef = useRef<HTMLImageElement>(null);

    // Global Form State
    const [gameType, setGameType] = useState("정기전");
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const GAME_TYPES = ["정기전", "벙개", "상주", "교류전", "기타"];

    // --- Image Handling ---
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        setImageSrc(url);
        // Reset view
        setZoom(1);
        setPan({ x: 0, y: 0 });
    };

    const handleWheel = (e: React.WheelEvent) => {
        if (e.ctrlKey) {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            setZoom(z => Math.max(0.1, Math.min(5, z * delta)));
        }
    };

    const handleMouseDown = (e: MouseEvent) => {
        e.preventDefault();
        setIsDragging(true);
        setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging) return;
        setPan({
            x: e.clientX - dragStart.x,
            y: e.clientY - dragStart.y
        });
    };

    const handleMouseUp = () => setIsDragging(false);

    // --- Form Handling ---
    const addRow = () => {
        setRows([...rows, { memberName: '', scores: [] }]);
    };

    const updateRow = (idx: number, field: keyof BulkScoreData, value: any) => {
        const newRows = [...rows];
        if (field === 'scores') {
            // Parse comma-separated string back to number[]
            // We store logic here but input assumes string interaction? 
            // Actually, let's keep internal state as specific string for input, 
            // but the BulkScoreData expects number[].
            // To simplify, we'll parse on render/change or just keep a separate local state?
            // Let's parse on saving, but here we need to store valid numbers.
            // For smoother UI, maybe we just use a helper function on the Input `onChange` 
            // and keep `rows` as the source of truth if we can.
            // BUT, if user types "150, " (trailing comma), parsing to number[] removes it.
            // So we need a local "display value" or just be loose.
            // Let's implement a specific Input component or simple logic inside the map.
        }
        // @ts-ignore
        newRows[idx][field] = value;
        setRows(newRows);
    };

    const removeRow = (idx: number) => {
        const newRows = [...rows];
        newRows.splice(idx, 1);
        setRows(newRows);
    };

    const handleSave = async () => {
        // Validation
        const validRows = rows.filter(r => r.memberName && r.scores.length > 0);
        if (validRows.length === 0) {
            setMessage({ type: 'error', text: '저장할 데이터가 없습니다. 이름과 점수를 입력해주세요.' });
            return;
        }

        setIsUploading(true);
        const result = await bulkAddScores(validRows, date, gameType);
        setIsUploading(false);
        setMessage({ type: result.success ? 'success' : 'error', text: result.message });
        if (result.success) {
            // Clear or keep? Maybe keep image, clear rows?
            // Usually clearing rows is safer to prevent double submit
            setRows([{ memberName: '', scores: [] }]);
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-200px)] min-h-[600px] gap-4">
            {/* Top Bar: settings */}
            <div className="flex gap-4 items-end bg-secondary/10 p-4 rounded-lg">
                <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-muted-foreground">날짜</label>
                    <input
                        type="date"
                        className="input h-9"
                        value={date}
                        onChange={e => setDate(e.target.value)}
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-muted-foreground">게임 분류</label>
                    <select
                        className="input h-9 min-w-[100px]"
                        value={gameType}
                        onChange={e => setGameType(e.target.value)}
                    >
                        {GAME_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
                <div className="flex-1"></div>
                <label className="btn btn-secondary h-9 text-sm cursor-pointer flex items-center px-4">
                    <span>📷 사진 올리기</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
                </label>
            </div>

            <div className="flex-1 flex gap-4 overflow-hidden border rounded-lg relative">

                {/* Left: Image Viewer */}
                <div className="flex-1 bg-gray-100 relative overflow-hidden flex items-center justify-center select-none group">
                    {imageSrc ? (
                        <>
                            <div
                                className="absolute inset-0 cursor-grab active:cursor-grabbing"
                                onMouseDown={handleMouseDown}
                                onMouseMove={handleMouseMove}
                                onMouseUp={handleMouseUp}
                                onMouseLeave={handleMouseUp}
                                onWheel={handleWheel}
                            >
                                <img
                                    src={imageSrc}
                                    ref={imgRef}
                                    style={{
                                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                                        transformOrigin: '0 0',
                                        transition: isDragging ? 'none' : 'transform 0.1s'
                                    }}
                                    className="max-w-none"
                                    draggable={false}
                                    alt="Scoreboard"
                                />
                            </div>

                            {/* Zoom Controls Overlay */}
                            <div className="absolute bottom-4 left-4 flex gap-1 bg-black/50 p-1 rounded backdrop-blur">
                                <button onClick={() => setZoom(z => z * 1.2)} className="w-8 h-8 flex items-center justify-center text-white hover:bg-white/20 rounded">+</button>
                                <button onClick={() => setZoom(1)} className="w-8 h-8 flex items-center justify-center text-white hover:bg-white/20 rounded text-xs">1:1</button>
                                <button onClick={() => setZoom(z => z / 1.2)} className="w-8 h-8 flex items-center justify-center text-white hover:bg-white/20 rounded">-</button>
                            </div>

                            {/* Help Text */}
                            <div className="absolute top-4 left-4 bg-black/50 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                드래그: 이동 / 휠: 확대축소
                            </div>
                        </>
                    ) : (
                        <div className="text-muted-foreground text-sm flex flex-col items-center gap-2">
                            <div className="text-4xl text-muted-foreground/30">🖼️</div>
                            <p>사진을 먼저 올려주세요</p>
                        </div>
                    )}
                </div>

                {/* Right: Manual Entry Form */}
                <div className="w-[450px] flex flex-col bg-background border-l">
                    <div className="p-3 border-b bg-muted/20 font-bold text-sm grid grid-cols-[100px_1fr_40px] gap-2 text-center">
                        <div>이름</div>
                        <div>점수 (콤마로 구분)</div>
                        <div></div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                        {rows.map((row, idx) => (
                            <div key={idx} className="grid grid-cols-[100px_1fr_40px] gap-2 items-center">
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
                                <button onClick={() => removeRow(idx)} className="text-muted-foreground hover:text-destructive p-1">
                                    🗑️
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="p-3 border-t bg-muted/10 flex flex-col gap-2">
                        <button onClick={addRow} className="btn btn-secondary w-full py-2 text-sm">
                            + 줄 추가
                        </button>
                        <button onClick={handleSave} disabled={isUploading} className="btn btn-primary w-full py-2">
                            {isUploading ? '저장 중...' : '저장하기'}
                        </button>
                    </div>
                </div>
            </div>

            {message && (
                <div className={`p-3 rounded text-center text-sm ${message.type === 'success' ? 'bg-green-500/10 text-green-500' : 'bg-destructive/10 text-destructive'}`}>
                    {message.text}
                </div>
            )}
        </div>
    );
}

// Helper component to handle the specific "Text <-> Number[]" friction
function RowInput({
    member,
    scores,
    knownMembers,
    onUpdate
}: {
    member: string,
    scores: number[],
    knownMembers: string[],
    onUpdate: (member: string, scores: number[]) => void
}) {
    // Initial text value from scores
    const [text, setText] = useState(scores.length > 0 ? scores.join(', ') : '');

    // We only initialize once. If parent resets (e.g. scores becomes empty), we should sync.
    // Simple sync: if scores is empty and text is not, clear text.
    if (scores.length === 0 && text !== '') {
        setText('');
    }

    const handleTextChange = (val: string) => {
        setText(val);
        // Parse for parent
        const nums = val.split(',')
            .map(s => parseInt(s.trim()))
            .filter(n => !isNaN(n));
        onUpdate(member, nums);
    };

    const handleMemberChange = (val: string) => {
        onUpdate(val, scores);
    };

    return (
        <>
            <select
                className="input h-9 text-sm p-1"
                value={member}
                onChange={(e) => handleMemberChange(e.target.value)}
            >
                <option value="">선택</option>
                {knownMembers.map(m => (
                    <option key={m} value={m}>{m}</option>
                ))}
            </select>
            <input
                className="input h-9 text-sm"
                placeholder="150, 180"
                value={text}
                onChange={(e) => handleTextChange(e.target.value)}
            />
        </>
    );
}

