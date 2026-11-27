'use client';

import { useState, useEffect } from 'react';
import { getCenterGuests, mergeCenterGuestStats, deleteCenterGuestRecords } from "@/app/actions/center-guest-actions";
import styles from "./CenterGuestManager.module.css";

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

    if (isLoading) return <div className={styles.loading}>비회원 기록 조회 중...</div>;

    return (
        <section className={styles.shell}>
            <div className={styles.header}>
                <h2 className={styles.title}>🏃 비회원 대회 · 리그 기록 관리</h2>
                <p className={styles.subtitle}>신규 가입 회원에게 과거 비회원 참가 기록을 통합할 수 있습니다.</p>
            </div>

            <div className={styles.body}>

                {guests.length === 0 ? (
                    <div className={styles.empty}>처리할 비회원 기록이 없습니다.</div>
                ) : (
                    <div className={styles.list}>
                        {guests.map((guestName, idx) => (
                            <div key={idx} className={styles.card}>
                                <div className={styles.name}>{guestName}<span className={styles.badge}>비회원 기록</span></div>

                                {mergeTarget === guestName ? (
                                    <div className={styles.merge}>
                                        <div className="flex items-center gap-2">
                                            <select
                                                className="w-full"
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
                                        <div className={styles.mergeActions}>
                                            <button
                                                onClick={handleMergeConfirm}
                                                disabled={isPending || !selectedUserId}
                                                className={`btn btn-primary ${styles.smallButton}`}
                                            >
                                                {isPending ? '통합 중...' : '기록 통합 확정'}
                                            </button>
                                            <button
                                                onClick={handleMergeCancel}
                                                disabled={isPending}
                                                className={`btn btn-secondary ${styles.smallButton}`}
                                            >
                                                취소
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className={styles.actions}>
                                        <button
                                            onClick={() => handleMergeClick(guestName)}
                                            disabled={isPending || !!mergeTarget}
                                            className={`btn btn-secondary ${styles.smallButton}`}
                                        >
                                            회원 계정으로 통합
                                        </button>
                                        <button
                                            onClick={() => handleDelete(guestName)}
                                            disabled={isPending || !!mergeTarget}
                                            className={`btn btn-secondary ${styles.smallButton}`}
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

            <div className={styles.warning}>
                <p>
                    ※ 기록 통합 시 해당 게스트 명의로 등록된 모든 대회 참가 기록 및 리그 경기 결과가 선택한 회원 계정으로 즉시 연결됩니다.<br />
                    ※ 한 번 통합된 기록은 다시 분리하기 어려우니 신중하게 확인 후 진행해 주세요.
                </p>
            </div>
        </section>
    );
}
