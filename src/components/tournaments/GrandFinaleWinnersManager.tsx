'use client';

import { useState } from 'react';
import { updateGrandFinaleSettings } from '@/app/actions/tournament-center';

interface GrandFinaleWinnersManagerProps {
    tournamentId: string;
    rounds: any[];
    selectedIds: string[];
}

export default function GrandFinaleWinnersManager({ tournamentId, rounds, selectedIds }: GrandFinaleWinnersManagerProps) {
    const [selected, setSelected] = useState<string[]>(selectedIds);
    const [isSaving, setIsSaving] = useState(false);

    const toggleSelection = (id: string | any) => {
        const regId = String(id);
        setSelected(prev =>
            prev.includes(regId) ? prev.filter(i => i !== regId) : [...prev, regId]
        );
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const res = await updateGrandFinaleSettings(tournamentId, { grandFinalistIds: selected });
            if (res.success) {
                alert('왕중왕전 참가자 명단이 저장되었습니다.');
            }
        } catch (e: any) {
            alert('저장 실패: ' + e.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-700">
            {/* Header Section - Bulletproof Alignment */}
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'flex-end',
                    width: '100%',
                    paddingBottom: '32px',
                    gap: '24px',
                    borderBottom: '2px solid rgba(255,255,255,0.1)'
                }}
            >
                <div style={{ textAlign: 'left', flex: '1' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                        <h3 style={{ fontSize: '28px', fontWeight: '900', color: '#ffffff', margin: 0, letterSpacing: '-0.02em' }}>왕중왕전 진출자 명단</h3>
                        <span style={{ fontSize: '11px', backgroundColor: '#3b82f6', color: '#ffffff', padding: '4px 10px', borderRadius: '4px', fontWeight: '900', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)' }}>V3 FINAL FIXED</span>
                    </div>
                    <p style={{ fontSize: '15px', fontWeight: '600', color: '#94a3b8', margin: 0 }}>각 회차별 입상자 중 왕중왕전 진출자를 선택해 주세요.</p>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '40px' }}>
                    <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '11px', fontWeight: '900', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.15em' }}>Selected Count</span>
                        <div style={{ fontSize: '42px', fontWeight: '900', color: '#3b82f6', lineHeight: '1' }}>
                            {selected.length}
                            <span style={{ fontSize: '14px', color: '#64748b', marginLeft: '10px', verticalAlign: 'middle' }}>Finalists</span>
                        </div>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        style={{
                            height: '64px',
                            padding: '0 48px',
                            backgroundColor: '#3b82f6',
                            color: '#ffffff',
                            fontSize: '18px',
                            fontWeight: '900',
                            borderRadius: '16px',
                            border: 'none',
                            cursor: 'pointer',
                            boxShadow: '0 12px 30px rgba(59, 130, 246, 0.4)',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        {isSaving ? '보존 중...' : '🏆 명단 저장하기'}
                    </button>
                </div>
            </div>

            {/* Rounds Tables - High Contrast Traditional Grid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '80px', paddingTop: '40px', paddingBottom: '160px' }}>
                {rounds.map(round => {
                    const aggregatedRanks = (() => {
                        const hasScores = round.individualScores && round.individualScores.length > 0;
                        if (hasScores) {
                            const groups: Record<string, any> = {};
                            round.individualScores.forEach((s: any) => {
                                const regId = s.registrationId || s.registration?.id;
                                if (!regId) return;

                                const idStr = String(regId);
                                if (!groups[idStr]) {
                                    groups[idStr] = {
                                        id: idStr,
                                        registrationId: idStr,
                                        registration: s.registration,
                                        score1: 0,
                                        score2: 0,
                                        score3: 0,
                                        handicap: s.registration?.handicap || 0
                                    };
                                }
                                if (s.gameNumber === 1) groups[idStr].score1 = s.score;
                                if (s.gameNumber === 2) groups[idStr].score2 = s.score;
                                if (s.gameNumber === 3) groups[idStr].score3 = s.score;
                            });

                            return Object.values(groups)
                                .map(g => ({
                                    ...g,
                                    totalPins: (g.score1 || 0) + (g.score2 || 0) + (g.score3 || 0) + (g.handicap * 3)
                                }))
                                .sort((a, b) => b.totalPins - a.totalPins)
                                .slice(0, 20);
                        } else {
                            return (round.participants || [])
                                .slice(0, 20)
                                .map((p: any) => ({
                                    id: String(p.registrationId),
                                    registrationId: String(p.registrationId),
                                    registration: p.registration,
                                    totalPins: null
                                }));
                        }
                    })();

                    return (
                        <div key={round.id} style={{ display: 'flex', flexDirection: 'column' }}>
                            {/* Sheet Tab - Fixed styling conflict */}
                            <div
                                style={{
                                    backgroundColor: '#334155',
                                    color: '#ffffff',
                                    padding: '10px 32px',
                                    fontSize: '13px',
                                    fontWeight: '900',
                                    width: 'fit-content',
                                    borderRadius: '12px 12px 0 0',
                                    borderTop: '1px solid #475569',
                                    borderLeft: '1px solid #475569',
                                    borderRight: '1px solid #475569',
                                    borderBottom: 'none'
                                }}
                            >
                                ROUND {round.roundNumber} - MANAGEMENT SHEET
                            </div>

                            <div style={{ overflowX: 'auto', backgroundColor: '#ffffff', boxShadow: '0 35px 70px -15px rgba(0, 0, 0, 0.6)' }}>
                                <table
                                    style={{
                                        width: '100%',
                                        borderCollapse: 'collapse',
                                        backgroundColor: '#ffffff',
                                        color: '#000000',
                                        tableLayout: 'fixed',
                                        minWidth: '1000px',
                                        border: '3px solid #000000'
                                    }}
                                >
                                    <thead>
                                        <tr style={{ backgroundColor: '#f1f5f9', color: '#000000', fontSize: '14px', fontWeight: '900' }}>
                                            <th style={{ width: '60px', height: '56px', border: '1px solid #000000', textAlign: 'center' }}>SEL</th>
                                            <th style={{ width: '60px', border: '1px solid #000000', textAlign: 'center' }}>NO</th>
                                            <th style={{ width: '220px', border: '1px solid #000000', textAlign: 'left', paddingLeft: '24px' }}>TEAM (팀명)</th>
                                            <th style={{ width: '240px', border: '1px solid #000000', textAlign: 'left', paddingLeft: '24px' }}>NAME (성명)</th>
                                            <th style={{ width: '130px', border: '1px solid #000000', textAlign: 'right', paddingRight: '24px' }}>TOTAL PINS</th>
                                            <th style={{ border: '1px solid #000000', textAlign: 'center' }}>STATUS</th>
                                        </tr>
                                    </thead>
                                    <tbody style={{ fontWeight: '700' }}>
                                        {aggregatedRanks.map((item: any, idx: number) => {
                                            const isChecked = selected.includes(String(item.registrationId));
                                            return (
                                                <tr
                                                    key={item.id}
                                                    onClick={() => toggleSelection(item.registrationId)}
                                                    style={{
                                                        height: '52px',
                                                        cursor: 'pointer',
                                                        backgroundColor: isChecked ? '#eff6ff' : '#ffffff',
                                                        color: '#000000',
                                                        fontSize: '16px'
                                                    }}
                                                >
                                                    <td style={{ border: '1px solid #000000', textAlign: 'center' }}>
                                                        <div style={{
                                                            width: '26px', height: '26px', margin: 'auto',
                                                            border: '2px solid #000000', backgroundColor: isChecked ? '#3b82f6' : '#ffffff',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff',
                                                            borderRadius: '4px'
                                                        }}>
                                                            {isChecked && <span style={{ fontSize: '16px', fontWeight: '900' }}>✓</span>}
                                                        </div>
                                                    </td>
                                                    <td style={{ border: '1px solid #000000', backgroundColor: '#f8fafc', textAlign: 'center', color: '#000000', fontWeight: '900' }}>
                                                        {idx + 1}
                                                    </td>
                                                    <td style={{ border: '1px solid #000000', paddingLeft: '24px', color: '#000000' }}>
                                                        {item.registration?.team?.name || item.registration?.guestTeamName || 'FREELANCER'}
                                                    </td>
                                                    <td style={{ border: '1px solid #000000', paddingLeft: '24px', fontWeight: '900', color: isChecked ? '#3b82f6' : '#000000' }}>
                                                        {item.registration?.user?.name || item.registration?.guestName || 'Unknown'}
                                                    </td>
                                                    <td style={{ border: '1px solid #000000', paddingRight: '24px', textAlign: 'right', fontWeight: '900', color: '#000000' }}>
                                                        {item.totalPins !== null ? item.totalPins.toLocaleString() : '-'}
                                                    </td>
                                                    <td style={{ border: '1px solid #000000', textAlign: 'center' }}>
                                                        {isChecked ? (
                                                            <span style={{ color: '#3b82f6', fontWeight: '900', fontSize: '12px' }}>● SELECTED</span>
                                                        ) : (
                                                            <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '12px' }}>Candidate</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {aggregatedRanks.length === 0 && (
                                            <tr>
                                                <td colSpan={6} style={{ height: '120px', border: '1px solid #000000', textAlign: 'center', color: '#94a3b8' }}>
                                                    (No data available for this round)
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
