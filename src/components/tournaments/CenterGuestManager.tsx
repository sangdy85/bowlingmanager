'use client';

import { useState, useEffect } from 'react';
import { getCenterGuests, mergeCenterGuestStats, deleteCenterGuestRecords } from "@/app/actions/center-guest-actions";

interface CenterGuestManagerProps {
    centerId: string;
    members: { id: string; name: string; email: string; alias: string | null }[];
}

export default function CenterGuestManager({ centerId, members }: CenterGuestManagerProps) {
    const [guests, setGuests] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isPending, setIsPending] = useState(false);
    const [mergeTarget, setMergeTarget] = useState<string | null>(null);
    const [selectedUserId, setSelectedUserId] = useState<string>("");

    const fetchGuests = async () => {
        setIsLoading(true);
        try {
            const data = await getCenterGuests(centerId);
            setGuests(data);
        } catch (error) {
            console.error("Failed to fetch guests:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchGuests();
    }, [centerId]);

    const handleDelete = async (guestName: string) => {
        if (!confirm(`'${guestName}'님의 모든 센터 대회 기록을 영구적으로 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;

        setIsPending(true);
        const result = await deleteCenterGuestRecords(centerId, guestName);
        setIsPending(false);

        if (result.success) {
            alert(result.message);
            fetchGuests();
        } else {
            alert(result.message);
        }
    };

    const handleMergeClick = (guestName: string) => {
        setMergeTarget(guestName);
        setSelectedUserId("");
    };

    const handleMergeCancel = () => {
        setMergeTarget(null);
        setSelectedUserId("");
    };

    const handleMergeConfirm = async () => {
        if (!mergeTarget || !selectedUserId) return;

        const targetUser = members.find(m => m.id === selectedUserId);
        if (!confirm(`'${mergeTarget}'님의 모든 기록을 회원 '${targetUser?.name}'님 계정으로 통합하시겠습니까?\n기존 기록들이 모두 이 회원에게 연결됩니다.`)) return;

        setIsPending(true);
        const result = await mergeCenterGuestStats(centerId, mergeTarget, selectedUserId);
        setIsPending(false);

        if (result.success) {
            alert(result.message);
            setMergeTarget(null);
            fetchGuests();
        } else {
            alert(result.message);
        }
    };

    // Filter members that match the guest name (fuzzy match or direct)
    const getFilteredMembers = (guestName: string) => {
        return members.filter(m =>
            m.name.includes(guestName) ||
            guestName.includes(m.name) ||
            (m.alias && (m.alias.includes(guestName) || guestName.includes(m.alias)))
        );
    };

    if (isLoading) return <div className="p-4 text-center text-slate-400 font-bold">비회원 기록 조회 중...</div>;

    return (
        <div className="bg-white rounded-2xl border-2 border-slate-900 shadow-xl overflow-hidden mb-8">
            <div className="bg-slate-900 px-6 py-4 flex justify-between items-center">
                <h2 className="font-black text-white text-lg flex items-center gap-2">
                    <span className="text-xl">🏃</span> 비회원 대회/리그 기록 관리
                </h2>
            </div>

            <div className="p-6">
                <p className="text-sm text-slate-500 font-bold mb-6">
                    신규 가입한 회원이 이전에 비회원(게스트)으로 참가했던 기록을 합쳐줄 수 있습니다.
                </p>

                {guests.length === 0 ? (
                    <div className="text-center py-10 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                        <p className="text-slate-400 font-bold">처리할 비회원 기록이 없습니다.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {guests.map((guestName, idx) => (
                            <div key={idx} className="flex flex-col p-4 bg-slate-50 border-2 border-slate-200 rounded-xl hover:bg-slate-100 transition-all gap-3">
                                <div className="flex justify-between items-center">
                                    <span className="font-black text-slate-800">{guestName} <span className="text-[10px] bg-slate-200 px-2 py-0.5 rounded text-slate-500 font-bold ml-1">비회원 기록</span></span>
                                </div>

                                {mergeTarget === guestName ? (
                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center gap-2">
                                            <select
                                                className="flex-1 h-10 border-2 border-slate-900 rounded-lg px-2 text-sm font-bold outline-none"
                                                value={selectedUserId}
                                                onChange={(e) => setSelectedUserId(e.target.value)}
                                                disabled={isPending}
                                            >
                                                <option value="">통합할 회원 선택 ({getFilteredMembers(guestName).length}명 추천)</option>
                                                {getFilteredMembers(guestName).map(m => (
                                                    <option key={m.id} value={m.id}>
                                                        {m.name} ({m.email})
                                                    </option>
                                                ))}
                                                <option disabled>──────────</option>
                                                {members.filter(m => !getFilteredMembers(guestName).includes(m)).map(m => (
                                                    <option key={m.id} value={m.id}>
                                                        {m.name} ({m.email})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="flex gap-2 justify-end">
                                            <button
                                                onClick={handleMergeConfirm}
                                                disabled={isPending || !selectedUserId}
                                                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-black text-xs hover:bg-blue-700 disabled:bg-slate-400 transition-all"
                                            >
                                                {isPending ? '통합 중...' : '기록 통합 확정'}
                                            </button>
                                            <button
                                                onClick={handleMergeCancel}
                                                disabled={isPending}
                                                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg font-black text-xs hover:bg-slate-300 transition-all"
                                            >
                                                취소
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex gap-2 overflow-x-auto pb-1">
                                        <button
                                            onClick={() => handleMergeClick(guestName)}
                                            disabled={isPending || !!mergeTarget}
                                            className="whitespace-nowrap px-3 py-1.5 bg-white border-2 border-blue-600 text-blue-600 rounded-lg font-black text-[11px] hover:bg-blue-50 transition-all"
                                        >
                                            회원 계정으로 통합
                                        </button>
                                        <button
                                            onClick={() => handleDelete(guestName)}
                                            disabled={isPending || !!mergeTarget}
                                            className="whitespace-nowrap px-3 py-1.5 bg-white border-2 border-red-500 text-red-500 rounded-lg font-black text-[11px] hover:bg-red-50 transition-all"
                                        >
                                            기록 삭제
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="bg-amber-50 p-4 border-t-2 border-slate-900">
                <p className="text-[10px] text-amber-800 font-bold leading-relaxed">
                    ※ 기록 통합 시 해당 게스트 명의로 등록된 모든 대회 참가 기록 및 리그 경기 결과가 선택한 회원 계정으로 즉시 연결됩니다.<br />
                    ※ 한 번 통합된 기록은 다시 분리하기 어려우니 신중하게 확인 후 진행해 주세요.
                </p>
            </div>
        </div>
    );
}
