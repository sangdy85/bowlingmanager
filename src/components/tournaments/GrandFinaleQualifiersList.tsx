'use client';

import Link from 'next/link';

interface GrandFinaleQualifiersListProps {
    tournament: any;
    rounds: any[];
    registrations: any[];
    qualifierIds: string[];
    centerId: string;
}

export default function GrandFinaleQualifiersList({ tournament, rounds, registrations, qualifierIds, centerId }: GrandFinaleQualifiersListProps) {
    const tournamentId = tournament.id;
    const qualifiedRegIds = new Set(qualifierIds.map(String));

    // Filter rounds that have participants who are qualified
    const activeRounds = rounds.map(round => {
        const hasScores = round.individualScores && round.individualScores.length > 0;
        let qualifiers = [];

        if (hasScores) {
            const groups: Record<string, any> = {};
            round.individualScores.forEach((s: any) => {
                const regId = String(s.registrationId);
                if (!qualifiedRegIds.has(regId)) return;

                if (!groups[regId]) {
                    groups[regId] = {
                        registrationId: regId,
                        registration: s.registration,
                        score1: 0,
                        score2: 0,
                        score3: 0,
                        handicap: s.registration?.handicap || 0
                    };
                }
                if (s.gameNumber === 1) groups[regId].score1 = s.score;
                if (s.gameNumber === 2) groups[regId].score2 = s.score;
                if (s.gameNumber === 3) groups[regId].score3 = s.score;
            });

            qualifiers = Object.values(groups)
                .map((g: any) => ({
                    ...g,
                    totalPins: g.score1 + g.score2 + g.score3 + (g.handicap * 3)
                }))
                .sort((a: any, b: any) => b.totalPins - a.totalPins);
        } else {
            qualifiers = (round.participants || [])
                .filter((p: any) => qualifiedRegIds.has(String(p.registrationId)))
                .map((p: any) => ({
                    registrationId: p.registrationId,
                    registration: p.registration,
                    totalPins: null
                }));
        }

        return {
            ...round,
            qualifiers
        };
    }).filter(r => r.qualifiers.length > 0);

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '48px 16px', color: '#ffffff' }}>
            {/* Header */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '32px', borderBottom: '2px solid rgba(255,255,255,0.1)', marginBottom: '64px' }}>
                <Link
                    href={`/centers/${centerId}/tournaments/${tournamentId}`}
                    style={{ fontSize: '14px', fontWeight: 'bold', color: '#94a3b8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                    ← 대회 상세페이지로 돌아가기
                </Link>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div>
                        <h1 style={{ fontSize: '36px', fontWeight: '900', color: '#ffffff', margin: '0 0 8px 0', letterSpacing: '-0.02em' }}>
                            {tournament.name}
                        </h1>
                        <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.2em', margin: 0 }}>
                            왕중왕전 진출자 현황
                        </h2>
                    </div>
                    <div style={{ textAlign: 'right', backgroundColor: '#0f172a', border: '1px solid #1e293b', padding: '16px 24px', borderRadius: '16px' }}>
                        <span style={{ fontSize: '11px', fontWeight: '900', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.2em', display: 'block', marginBottom: '4px' }}>Total Qualifiers</span>
                        <div style={{ fontSize: '42px', fontWeight: '900', color: '#ffffff', lineHeight: 1 }}>
                            {qualifierIds.length} <span style={{ fontSize: '14px', color: '#64748b', marginLeft: '8px' }}>Finalists</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Rounds List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '80px', paddingBottom: '120px' }}>
                {activeRounds.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '100px 0', border: '2px dashed #1e293b', borderRadius: '24px' }}>
                        <div style={{ fontSize: '48px', marginBottom: '24px' }}>⏳</div>
                        <h3 style={{ fontSize: '24px', fontWeight: '900', color: '#ffffff' }}>아직 선발된 진출자가 없습니다.</h3>
                    </div>
                ) : (
                    activeRounds.map(round => (
                        <div key={round.id} style={{ display: 'flex', flexDirection: 'column' }}>
                            {/* Sheet Tab */}
                            <div style={{
                                backgroundColor: '#334155',
                                color: '#ffffff',
                                padding: '10px 32px',
                                fontSize: '13px',
                                fontWeight: '900',
                                width: 'fit-content',
                                borderRadius: '12px 12px 0 0',
                                border: '3px solid #000000',
                                borderBottom: 'none'
                            }}>
                                ROUND {round.roundNumber} - QUALIFIER MANAGEMENT SHEET
                            </div>

                            {/* Table Container */}
                            <div style={{ overflowX: 'auto', backgroundColor: '#ffffff', border: '3px solid #000000', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', color: '#000000', minWidth: '800px', tableLayout: 'fixed' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#f1f5f9', height: '56px', fontSize: '14px', fontWeight: '900' }}>
                                            <th style={{ width: '100px', border: '1px solid #000000', textAlign: 'center' }}>순위 (Rank)</th>
                                            <th style={{ border: '1px solid #000000', textAlign: 'center' }}>TEAM (팀명)</th>
                                            <th style={{ border: '1px solid #000000', textAlign: 'center' }}>NAME (성명)</th>
                                            <th style={{ width: '180px', border: '1px solid #000000', textAlign: 'center' }}>TOTAL PINS (총점)</th>
                                        </tr>
                                    </thead>
                                    <tbody style={{ fontWeight: '700' }}>
                                        {round.qualifiers.map((item: any, idx: number) => (
                                            <tr key={item.registrationId} style={{ height: '52px', borderBottom: '1px solid #000000', fontSize: '16px' }}>
                                                <td style={{ border: '1px solid #000000', textAlign: 'center', backgroundColor: '#f8fafc', fontWeight: '900' }}>
                                                    {idx + 1}
                                                </td>
                                                <td style={{ border: '1px solid #000000', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {item.registration?.team?.name || item.registration?.guestTeamName || 'PLAYER'}
                                                </td>
                                                <td style={{ border: '1px solid #000000', textAlign: 'center', fontWeight: '900', color: '#3b82f6' }}>
                                                    {item.registration?.user?.name || item.registration?.guestName || 'Unknown'}
                                                </td>
                                                <td style={{ border: '1px solid #000000', textAlign: 'center', fontWeight: '900' }}>
                                                    {item.totalPins !== null ? item.totalPins.toLocaleString() : '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
