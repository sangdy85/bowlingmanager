'use client';

import { useState } from "react";
import { saveDailyScores } from "@/app/actions/score-edit";

interface ScoreItem {
    id?: string;
    score: number;
}

interface ScoreEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
    userName: string;
    dateStr: string;
    initialScores: ScoreItem[];
    teamId: string;
    guestName?: string;
}

export default function ScoreEditModal({ isOpen, onClose, userId, userName, dateStr, initialScores, teamId, guestName }: ScoreEditModalProps) {
    const [scores, setScores] = useState<ScoreItem[]>(initialScores);
    const [isSaving, setIsSaving] = useState(false);
    const [editDate, setEditDate] = useState(dateStr);
    const [editGuestName, setEditGuestName] = useState(guestName || "");

    if (!isOpen) return null;

    const handleAddGame = () => {
        setScores([...scores, { score: 0 }]);
    };

    const handleRemoveGame = (index: number) => {
        setScores(scores.filter((_, i) => i !== index));
    };

    const handleScoreChange = (index: number, val: string) => {
        const newScore = parseInt(val) || 0;
        const newScores = [...scores];
        newScores[index] = { ...newScores[index], score: newScore };
        setScores(newScores);
    };

    const handleSave = async () => {
        setIsSaving(true);
        const result = await saveDailyScores(
            teamId,
            userId,
            dateStr,
            scores,
            guestName,
            editDate,
            guestName !== undefined ? editGuestName : undefined
        );
        setIsSaving(false);

        if (result.success) {
            alert("저장되었습니다.");
            onClose();
        } else {
            alert(result.message);
        }
    };

    const handleDeleteAll = async () => {
        if (!confirm("정말 이 날짜의 모든 기록을 삭제하시겠습니까?\n삭제된 데이터는 복구할 수 없습니다.")) {
            return;
        }

        setIsSaving(true);
        // Pass empty scores to delete all records for this specific user/guest on this date
        const result = await saveDailyScores(teamId, userId, dateStr, [], guestName);
        setIsSaving(false);

        if (result.success) {
            alert("삭제되었습니다.");
            onClose();
        } else {
            alert(result.message);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-card text-card-foreground p-6 rounded-lg shadow-lg w-full max-w-md border border-border">
                <h3 className="text-xl font-bold mb-4">기록 수정</h3>

                <div className="space-y-4 mb-6">
                    <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">이름</label>
                        {guestName !== undefined ? (
                            <input
                                type="text"
                                className="input w-full"
                                value={editGuestName}
                                onChange={(e) => setEditGuestName(e.target.value)}
                                placeholder="이름을 입력하세요"
                            />
                        ) : (
                            <div className="p-2 bg-muted rounded font-medium">{userName} (회원)</div>
                        )}
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">날짜</label>
                        <input
                            type="date"
                            className="input w-full"
                            value={editDate}
                            onChange={(e) => setEditDate(e.target.value)}
                        />
                    </div>
                </div>

                <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2 border-t pt-4">
                    <label className="text-xs font-semibold text-muted-foreground uppercase block">점수 리스트</label>
                    {scores.map((item, index) => (
                        <div key={index} className="flex items-center gap-2">
                            <span className="w-8 font-bold text-center">{index + 1}G</span>
                            <input
                                type="number"
                                className="input flex-1 mb-0"
                                value={item.score}
                                onChange={(e) => handleScoreChange(index, e.target.value)}
                                min={0} max={300}
                            />
                            <button
                                onClick={() => handleRemoveGame(index)}
                                className="btn bg-destructive/10 text-destructive hover:bg-destructive/20 px-3 h-10"
                            >
                                삭제
                            </button>
                        </div>
                    ))}
                    <button onClick={handleAddGame} className="btn btn-secondary w-full">
                        + 게임 추가
                    </button>
                </div>

                <div className="mt-6 flex justify-between gap-2 border-t pt-4">
                    <button
                        onClick={handleDeleteAll}
                        className="btn bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        disabled={isSaving}
                    >
                        전체 삭제
                    </button>
                    <div className="flex gap-2">
                        <button onClick={onClose} className="btn btn-secondary" disabled={isSaving}>
                            취소
                        </button>
                        <button onClick={handleSave} className="btn btn-primary" disabled={isSaving}>
                            {isSaving ? "저장 중..." : "저장"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
