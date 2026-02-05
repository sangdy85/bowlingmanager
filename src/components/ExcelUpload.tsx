'use client';

import { useState } from 'react';
import * as XLSX from 'xlsx';
import { bulkAddScores, BulkScoreData } from '@/app/actions/score-bulk';

export default function ExcelUpload() {
    const [previewData, setPreviewData] = useState<BulkScoreData[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const [gameType, setGameType] = useState("정기전");
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const GAME_TYPES = ["정기전", "벙개", "상주", "교류전", "기타"];

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

            // Parse data (assuming Row 1 is header)
            // Header: 이름, 1G, 2G, 3G, ..., 메모
            const parsed: BulkScoreData[] = [];

            // Start from row 1 (index 1) if row 0 is header
            for (let i = 1; i < data.length; i++) {
                const row = data[i];
                if (!row[0]) continue; // Skip rows without name

                const memberName = row[0];
                const scores: number[] = [];
                let memo = '';

                // Iterate columns starting from 1 (since 0 is Name)
                for (let j = 1; j < row.length; j++) {
                    const cell = row[j];
                    if (typeof cell === 'number') {
                        scores.push(cell);
                    } else if (typeof cell === 'string') {
                        // Check if it looks like a score
                        const num = parseInt(cell);
                        if (!isNaN(num) && num >= 0 && num <= 300) {
                            scores.push(num);
                        } else {
                            memo = cell;
                        }
                    }
                }

                if (scores.length > 0) {
                    parsed.push({
                        memberName,
                        scores,
                        memo: memo || undefined
                    });
                }
            }
            setPreviewData(parsed);
            setMessage(null);
        };
        reader.readAsBinaryString(file);
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

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-secondary/20 p-4 rounded-lg">
                <div>
                    <h3 className="font-bold mb-1">엑셀 파일 업로드</h3>
                    <p className="text-sm text-secondary-foreground">.xlsx 또는 .xls 파일을 업로드하세요.</p>
                </div>
                <button onClick={downloadTemplate} className="text-xs btn btn-secondary h-8">
                    양식 다운로드
                </button>
            </div>

            <div className="flex flex-col gap-4">
                <div className="flex gap-4">
                    <div className="flex-1 flex flex-col gap-2">
                        <label htmlFor="bulkDate" className="label font-bold">날짜</label>
                        <input
                            type="date"
                            id="bulkDate"
                            className="input"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                        />
                    </div>
                    <div className="flex-1 flex flex-col gap-2">
                        <label htmlFor="bulkGameType" className="label font-bold">일괄 게임 분류</label>
                        <select
                            id="bulkGameType"
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

                <input
                    type="file"
                    accept=".xlsx, .xls"
                    className="input pt-1.5"
                    onChange={handleFileUpload}
                />
            </div>

            {previewData.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                    <div className="bg-muted p-2 text-sm font-bold grid grid-cols-3 gap-2 text-center">
                        <div>이름</div>
                        <div>점수</div>
                        <div>메모</div>
                    </div>
                    <div className="max-h-60 overflow-y-auto divide-y">
                        {previewData.map((row, idx) => (
                            <div key={idx} className="p-2 text-sm grid grid-cols-3 gap-2 text-center items-center">
                                <div>{row.memberName}</div>
                                <div>{row.scores.join(', ')}</div>
                                <div className="text-xs text-muted-foreground truncate">{row.memo}</div>
                            </div>
                        ))}
                    </div>
                    <div className="p-4 bg-muted/30 text-center">
                        <p className="text-sm mb-2 text-secondary-foreground">
                            선택된 날짜: <strong>{date}</strong><br />
                            총 {previewData.length}건의 데이터를 발견했습니다.<br />
                            <span className="text-xs text-muted-foreground">* 등록되지 않은 이름은 &apos;비회원&apos;으로 저장됩니다.</span>
                        </p>
                        <button
                            onClick={handleUpload}
                            disabled={isUploading}
                            className="btn btn-primary w-full"
                        >
                            {isUploading ? '업로드 중...' : '데이터베이스에 저장'}
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
