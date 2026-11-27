'use client';

import { useState } from 'react';
import { parseScoreboardImage } from '@/utils/scoreImageParser';
import { bulkAddScores, BulkScoreData } from '@/app/actions/score-bulk';

interface OCRUploadProps {
    knownMembers: string[];
}

export default function OCRUpload({ knownMembers }: OCRUploadProps) {
    const [previewData, setPreviewData] = useState<BulkScoreData[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const [gameType, setGameType] = useState("정기전");
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const GAME_TYPES = ["정기전", "벙개", "상주", "교류전", "기타"];

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsProcessing(true);
        setMessage(null);
        try {
            // We pass empty array for knownMembers for now, or could pass them if available props
            // But simple heuristic parsing works reasonably well without them for structure
            const parsedRows = await parseScoreboardImage(file, knownMembers);

            // Map to BulkScoreData
            const bulkData: BulkScoreData[] = parsedRows.map(row => ({
                memberName: row.name,
                scores: row.scores,
                memo: undefined
            }));

            setPreviewData(bulkData);
            if (bulkData.length === 0) {
                setMessage({ type: 'error', text: '인식된 점수 정보가 없습니다. 사진을 확인해주세요.' });
            }
        } catch (error) {
            console.error(error);
            setMessage({ type: 'error', text: '이미지 분석 중 오류가 발생했습니다.' });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleUpload = async () => {
        if (previewData.length === 0) return;
        setIsUploading(true);
        const result = await bulkAddScores(previewData, date, gameType);
        setIsUploading(false);
        setMessage({ type: result.success ? 'success' : 'error', text: result.message });
        if (result.success) {
            setPreviewData([]);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-secondary/20 p-4 rounded-lg">
                <h3 className="font-bold mb-1">사진 업로드 (AI 분석)</h3>
                <p className="text-sm text-secondary-foreground">
                    볼링 점수판 사진을 올리면 자동으로 인식합니다.<br />
                    <span className="text-xs opacity-70">* 손글씨나 화질에 따라 오차가 있을 수 있으니 반드시 확인해주세요.</span>
                </p>
            </div>

            <div className="flex flex-col gap-4">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 flex flex-col gap-2">
                        <label htmlFor="ocrDate" className="label font-bold">날짜</label>
                        <input
                            type="date"
                            id="ocrDate"
                            className="input"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                        />
                    </div>
                    <div className="flex-1 flex flex-col gap-2">
                        <label htmlFor="ocrGameType" className="label font-bold">일괄 게임 분류</label>
                        <select
                            id="ocrGameType"
                            className="input"
                            value={gameType}
                            onChange={(e) => setGameType(e.target.value)}
                        >
                            {GAME_TYPES.map(type => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <label className="btn btn-secondary w-full cursor-pointer flex items-center justify-center gap-2 h-12">
                        <span>📷 사진 촬영 / 선택</span>
                        <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleFileUpload}
                            disabled={isProcessing}
                        />
                    </label>
                    {isProcessing && <p className="text-center text-sm text-primary animate-pulse">이미지를 분석하고 있습니다...</p>}
                </div>
            </div>

            {previewData.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                        <div style={{ minWidth: '400px' }}>
                            <div className="bg-muted p-2 text-sm font-bold grid grid-cols-3 gap-2 text-center">
                                <div>이름</div>
                                <div>점수</div>
                                <div>수정</div>
                            </div>
                            <div className="max-h-60 overflow-y-auto divide-y">
                                {previewData.map((row, idx) => (
                                    <div key={idx} className="p-2 text-sm grid grid-cols-3 gap-2 text-center items-center">
                                        <select
                                            className="p-1 border rounded w-full text-center"
                                            value={row.memberName || ""}
                                            onChange={(e) => {
                                                const newData = [...previewData];
                                                newData[idx].memberName = e.target.value;
                                                setPreviewData(newData);
                                            }}
                                        >
                                            <option value="">팀원 선택</option>
                                            {knownMembers.map(member => (
                                                <option key={member} value={member}>{member}</option>
                                            ))}
                                        </select>
                                        <input
                                            className="p-1 border rounded w-full text-center"
                                            value={row.scores.join(', ')}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                try {
                                                    const parts = val.split(',').map(s => s.trim()).filter(s => s);
                                                    const nums = parts.map(Number).filter(n => !isNaN(n));
                                                    const newData = [...previewData];
                                                    newData[idx].scores = nums;
                                                    setPreviewData(newData);
                                                } catch (e) { }
                                            }}
                                            placeholder="150, 180..."
                                        />
                                        <button
                                            onClick={() => {
                                                const newData = [...previewData];
                                                newData.splice(idx, 1);
                                                setPreviewData(newData);
                                            }}
                                            className="text-red-500 text-xs hover:underline"
                                        >
                                            삭제
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="p-4 bg-muted/30 text-center">
                        <button
                            onClick={handleUpload}
                            disabled={isUploading}
                            className="btn btn-primary w-full"
                        >
                            {isUploading ? '저장 중...' : '데이터베이스에 저장'}
                        </button>
                    </div>
                </div>
            )}

            {message && (
                <div className={`p-4 rounded text-center text-sm ${message.type === 'success' ? 'bg-green-500/10 text-green-500' : 'bg-destructive/10 text-destructive'}`}>
                    {message.text}
                </div>
            )}
        </div>
    );
}
