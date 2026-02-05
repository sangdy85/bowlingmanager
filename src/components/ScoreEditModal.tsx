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
        // Validation check if needed?

        const result = await saveDailyScores(teamId, userId, dateStr, scores, guestName);
        setIsSaving(false);

        if (result.success) {
            alert("저장되었습니다.");
            onClose();
            // In a real app, we might want to refresh the parent data safely without full reload,
            // but the server action calls revalidatePath, so Next.js should handle it.
        } else {
            alert(result.message);
        }
    };

    const handleDeleteAll = async () => {
        if (!confirm("정말 이 날짜의 모든 기록을 삭제하시겠습니까?\n삭제된 데이터는 복구할 수 없습니다.")) {
            return;
        }

        setIsSaving(true);
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
                <h3 className="text-xl font-bold mb-4">{userName}님의 점수 수정</h3>
                <p className="text-secondary-foreground text-sm mb-4">{dateStr}</p>

                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
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
                </div>

                <div className="mt-4 flex gap-2">
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
                        기록 삭제
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
