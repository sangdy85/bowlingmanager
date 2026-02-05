'use client';

import { useState } from 'react';
import { deleteGuestRecords, mergeGuestStats } from "@/app/actions/team";

interface TeamGuestManagerProps {
    teamId: string;
    guests: string[]; // List of guest names
    ownerId: string | null;
    currentUserId: string;
    members: { id: string; name: string; realName: string; email: string; alias: string | null }[];
}

export default function TeamGuestManager({ teamId, guests, ownerId, currentUserId, members }: TeamGuestManagerProps) {
    const [isPending, setIsPending] = useState(false);
    const [mergeTarget, setMergeTarget] = useState<string | null>(null); // Guest name being merged
    const [selectedMemberId, setSelectedMemberId] = useState<string>("");

    // Only allow access if current user is owner
    if (currentUserId !== ownerId) return <div className="p-4 text-center text-red-500">권한이 없습니다.</div>;

    const handleDelete = async (guestName: string) => {
        if (!confirm(`'${guestName}'의 모든 기록을 영구적으로 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;

        setIsPending(true);
        const result = await deleteGuestRecords(teamId, guestName);
        setIsPending(false);

        if (result.success) {
            alert(result.message);
        } else {
            alert(result.message);
        }
    };

    const handleMergeClick = (guestName: string) => {
        setMergeTarget(guestName);
        setSelectedMemberId("");
    };

    const handleMergeCancel = () => {
        setMergeTarget(null);
        setSelectedMemberId("");
    };

    const handleMergeConfirm = async () => {
        if (!mergeTarget || !selectedMemberId) return;

        const targetMember = members.find(m => m.id === selectedMemberId);
        if (!confirm(`'${mergeTarget}'의 모든 기록을 '${targetMember?.name}'(으)로 통합하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;

        setIsPending(true);
        const result = await mergeGuestStats(teamId, mergeTarget, selectedMemberId);
        setIsPending(false);

        if (result.success) {
            alert(result.message);
            setMergeTarget(null);
        } else {
            alert(result.message);
        }
    };

    // Filter members for the current merge target
    const getFilteredMembers = (guestName: string) => {
        return members.filter(m => m.realName === guestName || m.name === guestName);
    };

    return (
        <div className="bg-background rounded-lg shadow border w-full">
            <div className="p-4 border-b bg-muted/30">
                <h2 className="font-bold text-lg">기록 관리 (비회원/탈퇴회원)</h2>
                <p className="text-sm text-secondary-foreground">탈퇴했거나 강퇴된 회원, 또는 비회원의 기록을 정회원에게 통합하거나 삭제할 수 있습니다.</p>
            </div>

            <div className="p-4">
                {guests.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">비회원 기록이 없습니다.</p>
                ) : (
                    <ul className="space-y-3">
                        {guests.map((guestName, idx) => (
                            <li key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border rounded-lg bg-card hover:bg-muted/10 transition-colors gap-3">
                                <div className="flex flex-col">
                                    <span className="font-bold">{guestName} <span className="text-xs font-normal text-muted-foreground">(비회원)</span></span>
                                </div>

                                {mergeTarget === guestName ? (
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <select
                                            className="border rounded px-2 py-1 text-sm min-w-[150px]"
                                            value={selectedMemberId}
                                            onChange={(e) => setSelectedMemberId(e.target.value)}
                                            disabled={isPending}
                                        >
                                            <option value="">통합할 팀원 선택 ({getFilteredMembers(guestName).length}명 매칭)</option>
                                            {getFilteredMembers(guestName).length > 0 ? (
                                                getFilteredMembers(guestName).map(m => (
                                                    <option key={m.id} value={m.id}>
                                                        {m.name} ({m.email})
                                                    </option>
                                                ))
                                            ) : (
                                                <option value="" disabled>이름이 일치하는 회원이 없습니다</option>
                                            )}
                                        </select>
                                        <button
                                            onClick={handleMergeConfirm}
                                            disabled={isPending || !selectedMemberId}
                                            className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                                        >
                                            확인
                                        </button>
                                        <button
                                            onClick={handleMergeCancel}
                                            disabled={isPending}
                                            className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
                                        >
                                            취소
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleMergeClick(guestName)}
                                            disabled={isPending || !!mergeTarget}
                                            className="px-4 py-2 text-sm bg-blue-50 text-blue-600 border border-blue-200 rounded hover:bg-blue-100 hover:text-blue-700 hover:border-blue-300 transition-colors disabled:opacity-50"
                                        >
                                            기록 통합
                                        </button>
                                        <button
                                            onClick={() => handleDelete(guestName)}
                                            disabled={isPending || !!mergeTarget}
                                            className="px-4 py-2 text-sm bg-red-50 text-red-600 border border-red-200 rounded hover:bg-red-100 hover:text-red-700 hover:border-red-300 transition-colors disabled:opacity-50"
                                        >
                                            기록 삭제
                                        </button>
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
