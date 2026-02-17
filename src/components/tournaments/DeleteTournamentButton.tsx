'use client';

import { useState } from 'react';
import { deleteTournament } from '@/app/actions/tournament-center';

export default function DeleteTournamentButton({ tournamentId }: { tournamentId: string }) {
    const [step, setStep] = useState<'IDLE' | 'CONFIRM_1' | 'CONFIRM_2'>('IDLE');
    const [deleting, setDeleting] = useState(false);

    const handleDelete = async () => {
        setDeleting(true);
        try {
            await deleteTournament(tournamentId);
        } catch (error) {
            alert("대회 삭제 중 오류가 발생했습니다.");
            setDeleting(false);
        }
    };

    if (step === 'IDLE') {
        return (
            <button
                onClick={() => setStep('CONFIRM_1')}
                className="btn btn-primary h-10 px-4 font-bold border-2 border-black shadow-md transition-all whitespace-nowrap"
            >
                대회 삭제
            </button>
        );
    }

    if (step === 'CONFIRM_1') {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                <div className="bg-card p-6 rounded-xl shadow-2xl border-2 border-black max-w-sm w-full space-y-4 animate-in fade-in zoom-in duration-200">
                    <h3 className="text-xl font-bold text-destructive flex items-center gap-2">
                        ⚠️ 대회 삭제 확인
                    </h3>
                    <p className="text-sm font-medium">
                        정말로 이 대회를 삭제하시겠습니까?
                        <br />
                        <span className="text-xs text-secondary-foreground">대회 정보와 모든 기록이 삭제됩니다.</span>
                    </p>
                    <div className="flex gap-2 justify-end">
                        <button
                            onClick={() => setStep('IDLE')}
                            className="btn btn-secondary btn-sm"
                        >
                            취소
                        </button>
                        <button
                            onClick={() => setStep('CONFIRM_2')}
                            className="btn btn-destructive btn-sm font-bold"
                        >
                            네, 삭제합니다
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Step 2: Final Warning
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-destructive text-destructive-foreground p-6 rounded-xl shadow-2xl border-4 border-black max-w-sm w-full space-y-4 animate-in fade-in zoom-in duration-200">
                <h3 className="text-xl font-black flex items-center gap-2">
                    ⛔️ 마지막 경고
                </h3>
                <p className="text-sm font-bold">
                    삭제된 데이터는 절대 복구할 수 없습니다.
                    <br />
                    정말로 진행하시겠습니까?
                </p>
                <div className="flex gap-2 justify-end mt-4">
                    <button
                        onClick={() => setStep('IDLE')}
                        className="btn bg-white text-black hover:bg-gray-200 border-none btn-sm font-bold"
                        disabled={deleting}
                    >
                        취소하고 돌아가기
                    </button>
                    <button
                        onClick={handleDelete}
                        disabled={deleting}
                        className="btn bg-black text-white hover:bg-gray-900 border-none btn-sm font-black"
                    >
                        {deleting ? "삭제 중..." : "확인했습니다. 삭제합니다."}
                    </button>
                </div>
            </div>
        </div>
    );
}
