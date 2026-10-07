'use client';

import { updateTournamentStatus } from "@/app/actions/tournament-center";
import { useState } from "react";
import styles from "./TournamentStatusDropdown.module.css";

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
    const [busy, setBusy] = useState(false);

    const handleStatusChange = async (status: string) => {
        if (status === 'FINISHED') {
            const confirmed = window.confirm(
                "대회를 종료하면 더 이상 수정할 수 없으며 되돌릴 수 없습니다.\n계속하시겠습니까?"
            );
            if (!confirmed) return;
        }

        try {
            setBusy(true);
            await updateTournamentStatus(tournamentId, status);
            setIsOpen(false);
        } catch (error) {
            console.error("Failed to update status:", error);
            alert("상태 변경에 실패했습니다.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className={styles.root}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                disabled={busy}
                className={`btn btn-primary ${styles.trigger}`}
            >
                {busy ? '변경 중...' : '상태 변경 ▼'}
            </button>

            {isOpen && (
                <>
                    <div
                        className={styles.backdrop}
                        onClick={() => setIsOpen(false)}
                    />
                    <div className={styles.menu}>
                        {currentStatus !== 'FINISHED' && (
                            <button
                                type="button"
                                onClick={() => handleStatusChange('FINISHED')}
                                className={styles.menuButton}
                                disabled={busy}
                            >
                                {statusMap['FINISHED'].label} 단계로 이동
                            </button>
                        )}
                        {currentStatus === 'FINISHED' && (
                            <div className={styles.finished}>
                                종료된 대회입니다
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
