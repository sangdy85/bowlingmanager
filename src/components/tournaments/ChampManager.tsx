'use client';

import Link from 'next/link';
import { useState } from 'react';
import { joinRound } from '@/app/actions/round-actions';
import { calculateTournamentStatus, STATUS_LABELS } from '@/lib/tournament-utils';

interface ChampManagerProps {
    tournament: any;
    centerId: string;
    isManager: boolean;
    currentUserId?: string;
    isMemberView?: boolean;
    isArchiveView?: boolean;
}

export default function ChampManager({ tournament, centerId, isManager, currentUserId, isMemberView = false, isArchiveView = false }: ChampManagerProps) {
    const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});

    if (!tournament.leagueRounds || tournament.leagueRounds.length === 0) {
        return <div className="p-4 border rounded">생성된 회차가 없습니다.</div>;
    }

    const handleJoin = async (roundId: string) => {
        if (!confirm('해당 회차에 참가 신청하시겠습니까?')) return;

        setLoadingMap(prev => ({ ...prev, [roundId]: true }));
        try {
            if (!currentUserId) throw new Error("로그인이 필요합니다.");
            const res = await joinRound(roundId, currentUserId);
            if (res.success) {
                alert('참가 신청이 완료되었습니다.');
                window.location.reload();
            } else {
                alert(res.message || '신청 실패');
            }
        } catch (e: any) {
            alert(e.message);
        } finally {
            setLoadingMap(prev => ({ ...prev, [roundId]: false }));
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {!isMemberView && (
                <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-4">
                        <span style={{ fontSize: '24px' }}>🏆</span>
                        <h3 style={{ fontSize: '20px', fontWeight: 900, color: 'white', margin: 0 }}>챔프전 회차 목록</h3>
                    </div>
                    {isManager && tournament.settings && (() => {
                        try {
                            const s = JSON.parse(tournament.settings);
                            if (s.hasGrandFinale && s.hasGrandFinale !== 'NONE') {
                                return (
                                    <Link
                                        href={`/centers/${centerId}/tournaments/${tournament.id}/grand-finale`}
                                        className="btn btn-primary flex items-center gap-2 h-10 px-4 text-sm font-bold shadow-lg border-2 border-black"
                                    >
                                        <span>🎖️</span> 왕중왕전 관리
                                    </Link>
                                );
                            }
                        } catch (e) {
                            console.error("Failed to parse tournament settings in ChampManager", e);
                        }
                        return null;
                    })()}
                </div>
            )}

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: '24px'
            }}>
                {tournament.leagueRounds
                    .filter((round: any) => {
                        if (!isArchiveView) return true;
                        // For Archive view, show if round is CLOSED or has results/scores
                        const hasResults = round.results && round.results.length > 0;
                        const hasIndividualScores = round.individualScores && round.individualScores.length > 0;
                        const hasParticipantsWithScores = round.participants?.some((p: any) => p.scores && p.scores.length > 0);
                        return round.status === 'CLOSED' || hasResults || hasIndividualScores || hasParticipantsWithScores;
                    })
                    .map((round: any) => {
                        const effectiveDate = round.effectiveDateStr ? new Date(round.effectiveDateStr) : (round.date ? new Date(round.date) : null);
                        const status = round.calculatedStatus || 'UPCOMING';

                        const isJoined = round.participants?.some((p: any) => p.registration?.userId === currentUserId);
                        const hasScores = (round.individualScores && round.individualScores.length > 0) ||
                            (round.results && round.results.length > 0) ||
                            (round.participants?.some((p: any) => p.scores && p.scores.length > 0));

                        const dateStr = effectiveDate ? effectiveDate.toLocaleString('ko-KR', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            weekday: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                            hourCycle: 'h23'
                        }) : '일정 미정';
                        const statusText = STATUS_LABELS[status as any];

                        return (
                            <div key={round.id} className="card" style={{
                                padding: '32px',
                                display: 'flex',
                                flexDirection: 'column',
                                borderRadius: '24px',
                                transition: 'all 0.2s',
                                cursor: 'default',
                                border: status === 'CLOSED' ? '2px solid rgba(148, 163, 184, 0.2)' : '2px solid rgba(59, 130, 246, 0.2)',
                                background: status === 'CLOSED' ? 'rgba(15, 23, 42, 0.5)' : '#0f172a'
                            }}>
                                {/* Header */}
                                <div className="flex items-center gap-3" style={{ marginBottom: '24px' }}>
                                    <span style={{ color: status === 'CLOSED' ? '#94a3b8' : '#a78bfa', fontSize: '20px' }}>
                                        {status === 'CLOSED' ? '🏁' : '⚙️'}
                                    </span>
                                    <h4 style={{ fontSize: '18px', fontWeight: 700, color: 'white', margin: 0 }}>
                                        {round.roundNumber}회차 {isManager ? '관리' : '대회 정보'}
                                    </h4>
                                </div>

                                {/* Info */}
                                <div style={{ marginBottom: '32px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <p style={{ fontSize: '14px', fontWeight: 500, color: '#e2e8f0', margin: 0 }}>
                                        대회 일시: {dateStr}
                                    </p>
                                    <p style={{ fontSize: '14px', fontWeight: 500, color: '#e2e8f0', margin: 0 }}>
                                        현재 상태: <span style={{
                                            color: status === 'OPEN' ? '#60a5fa' : status === 'FINISHED' ? '#ef4444' : status === 'CLOSED' ? '#94a3b8' : '#facc15',
                                            fontWeight: 700
                                        }}>{statusText}</span>
                                    </p>

                                    {/* Lucky Draw Winner Display for Closed Rounds */}
                                    {status === 'CLOSED' && round.luckyDrawResult && (() => {
                                        try {
                                            const result = JSON.parse(round.luckyDrawResult);
                                            if (result.winners && result.winners.length > 0) {
                                                return (
                                                    <div className="mt-4 p-3 bg-blue-600/10 rounded-xl border border-blue-500/20">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <span className="text-xs">🍀</span>
                                                            <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Lucky Draw Winners</span>
                                                        </div>
                                                        <div className="flex flex-wrap gap-2">
                                                            {result.winners.map((winner: any, idx: number) => (
                                                                <span key={idx} className="text-xs font-bold text-white bg-blue-600/50 px-2 py-1 rounded-lg">
                                                                    {winner.registration?.user?.name || winner.registration?.guestName}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            }
                                        } catch (e) { return null; }
                                        return null;
                                    })()}
                                </div>

                                {/* Action Button */}
                                <div style={{ marginTop: 'auto' }} className="flex flex-col gap-3">
                                    {isManager ? (
                                        <Link
                                            href={`/centers/${centerId}/tournaments/${tournament.id}/rounds/${round.id}`}
                                            className="btn btn-primary w-full h-14 rounded-2xl flex items-center justify-center font-black shadow-lg border-2 border-black bg-blue-600 hover:bg-blue-700"
                                        >
                                            📊 대회 관리
                                        </Link>
                                    ) : (
                                        <>
                                            {/* Results override: If scores exist, prioritize results view regardless of status */}
                                            {(status === 'CLOSED' || hasScores) ? (
                                                <Link
                                                    href={`/centers/${centerId}/tournaments/${tournament.id}/rounds/${round.id}?tab=finalResults`}
                                                    className="btn btn-primary w-full h-14 rounded-2xl flex items-center justify-center font-black shadow-lg border-2 border-black bg-blue-600 hover:bg-blue-700 hover:scale-[1.02] transition-all"
                                                >
                                                    📊 결과 확인
                                                </Link>
                                            ) : (
                                                <div className="flex flex-col gap-2">
                                                    {status === 'OPEN' && !isJoined && (
                                                        <button
                                                            onClick={() => handleJoin(round.id)}
                                                            disabled={loadingMap[round.id]}
                                                            className="btn btn-primary w-full h-14 rounded-2xl flex items-center justify-center font-black shadow-lg border-2 border-black hover:scale-[1.02] transition-all"
                                                        >
                                                            {loadingMap[round.id] ? '처리 중...' : '참가 신청하기'}
                                                        </button>
                                                    )}
                                                    {isJoined && (
                                                        <div style={{
                                                            width: '100%',
                                                            height: '56px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                                            color: '#34d399',
                                                            border: '1px solid rgba(16, 185, 129, 0.2)',
                                                            borderRadius: '16px',
                                                            fontSize: '15px',
                                                            fontWeight: 700
                                                        }}>
                                                            ✅ 참가 완료됨
                                                        </div>
                                                    )}
                                                    {status === 'UPCOMING' && !isJoined && (
                                                        <div style={{
                                                            width: '100%',
                                                            height: '56px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            backgroundColor: 'rgba(51, 65, 85, 0.3)',
                                                            color: '#64748b',
                                                            border: '1px solid #334155',
                                                            borderRadius: '16px',
                                                            fontSize: '15px',
                                                            fontWeight: 700,
                                                            cursor: 'not-allowed'
                                                        }}>
                                                            신청 예정
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })}
            </div>
        </div>
    );
}
