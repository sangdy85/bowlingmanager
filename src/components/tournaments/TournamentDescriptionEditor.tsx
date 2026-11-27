'use client';

import { useState } from 'react';
import { updateTournamentDescription } from '@/app/actions/tournament-center';

interface TournamentDescriptionEditorProps {
    tournamentId: string;
    initialDescription: string | null;
    isManager: boolean;
}

export default function TournamentDescriptionEditor({
    tournamentId,
    initialDescription,
    isManager
}: TournamentDescriptionEditorProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [description, setDescription] = useState(initialDescription || '');
    const [loading, setLoading] = useState(false);

    if (!isManager) {
        return (
            <div className="prose prose-sm max-w-none whitespace-pre-wrap text-base leading-relaxed">
                {initialDescription || "등록된 대회 요강이 없습니다."}
            </div>
        );
    }

    const handleSave = async () => {
        setLoading(true);
        try {
            await updateTournamentDescription(tournamentId, description);
            setIsEditing(false);
        } catch (error: any) {
            alert(error.message);
        } finally {
            setLoading(false);
        }
    };

    if (isEditing) {
        return (
            <div className="space-y-4">
                <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full h-64 p-4 border-2 border-primary/20 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-base"
                    placeholder="대회 요강, 시상 내역 등을 상세히 입력해주세요..."
                />
                <div className="flex justify-end gap-2">
                    <button
                        onClick={() => setIsEditing(false)}
                        className="btn btn-secondary btn-sm px-6"
                        disabled={loading}
                    >
                        취소
                    </button>
                    <button
                        onClick={handleSave}
                        className="btn btn-primary btn-sm px-6 font-bold"
                        disabled={loading}
                    >
                        {loading ? "저장 중..." : "저장하기"}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="group relative">
            <div className="prose prose-sm max-w-none whitespace-pre-wrap text-base leading-relaxed">
                {initialDescription || "등록된 대회 요강이 없습니다."}
            </div>
            <button
                onClick={() => setIsEditing(true)}
                className="absolute -top-2 -right-2 p-2 bg-white shadow-lg rounded-full opacity-0 group-hover:opacity-100 transition-all hover:scale-110 border border-border"
                title="상세 설명 수정"
            >
                ✏️
            </button>
        </div>
    );
}
