'use client';

import { useState } from "react";
import { updateDailyGroupInfo } from "@/app/actions/score-edit";
import { GAME_TYPES } from "./TeamYearlyStats";

interface ScoreGroupEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    teamId: string;
    dateStr: string;
    initialGameType?: string;
    initialMemo?: string;
}

export default function ScoreGroupEditModal({
    isOpen,
    onClose,
    teamId,
    dateStr,
    initialGameType,
    initialMemo
}: ScoreGroupEditModalProps) {
    const [editDate, setEditDate] = useState(dateStr);
    const [editGameType, setEditGameType] = useState(initialGameType || "정기전");
    const [editMemo, setEditMemo] = useState(initialMemo || "");
    const [isSaving, setIsSaving] = useState(false);

    if (!isOpen) return null;

    const handleSave = async () => {
        setIsSaving(true);
        const result = await updateDailyGroupInfo(
            teamId,
            dateStr,
            editDate,
            editGameType,
            editMemo
        );
        setIsSaving(false);

        if (result.success) {
            alert("수정되었습니다.");
            onClose();
        } else {
            alert(result.message);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-card text-card-foreground p-6 rounded-lg shadow-lg w-full max-w-md border border-border">
                <h3 className="text-xl font-bold mb-6">그룹 정보 일괄 수정</h3>

                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">날짜</label>
                        <input
                            type="date"
                            className="input w-full"
                            value={editDate}
                            onChange={(e) => setEditDate(e.target.value)}
                        />
                        <p className="text-[10px] text-muted-foreground mt-1">* 해당 날짜의 모든 기록이 이 날짜로 이동합니다.</p>
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">게임 분류</label>
                        <select
                            className="input w-full"
                            value={editGameType}
                            onChange={(e) => setEditGameType(e.target.value)}
                        >
                            {GAME_TYPES.map(type => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">메모</label>
                        <textarea
                            className="input w-full h-24 pt-2"
                            value={editMemo}
                            onChange={(e) => setEditMemo(e.target.value)}
                            placeholder="메모를 입력하세요"
                        />
                    </div>
                </div>

                <div className="mt-8 flex justify-end gap-2 border-t pt-4">
                    <button onClick={onClose} className="btn btn-secondary" disabled={isSaving}>
                        취소
                    </button>
                    <button onClick={handleSave} className="btn btn-primary" disabled={isSaving}>
                        {isSaving ? "수정 중..." : "일괄 적용"}
                    </button>
                </div>
            </div>
        </div>
    );
}
