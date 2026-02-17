'use client';

import { updateTournamentStatus } from "@/app/actions/tournament-center";
import { useState } from "react";

interface TournamentStatusDropdownProps {
    tournamentId: string;
    currentStatus: string;
    statusMap: Record<string, { label: string, color: string }>;
}

export default function TournamentStatusDropdown({
    tournamentId,
    currentStatus,
    statusMap
}: TournamentStatusDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);

    const handleStatusChange = async (status: string) => {
        if (status === 'FINISHED') {
            const confirmed = window.confirm(
                "대회를 종료하면 더 이상 수정할 수 없으며 되돌릴 수 없습니다.\n계속하시겠습니까?"
            );
            if (!confirmed) return;
        }

        try {
            await updateTournamentStatus(tournamentId, status);
            setIsOpen(false);
        } catch (error) {
            console.error("Failed to update status:", error);
            alert("상태 변경에 실패했습니다.");
        }
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="btn btn-primary h-12 px-6 font-black shadow-lg"
            >
                상태 변경 ▼
            </button>

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-48 bg-card border-2 border-black rounded-xl shadow-2xl z-50 overflow-hidden">
                        {currentStatus !== 'FINISHED' && (
                            <button
                                onClick={() => handleStatusChange('FINISHED')}
                                className="w-full text-left px-4 py-3 hover:bg-primary/10 transition-colors text-sm font-bold"
                            >
                                {statusMap['FINISHED'].label} 단계로 이동
                            </button>
                        )}
                        {currentStatus === 'FINISHED' && (
                            <div className="px-4 py-3 text-sm font-bold text-secondary-foreground">
                                종료된 대회입니다
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
