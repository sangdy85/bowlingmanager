'use client';
import { formatKSTDayLabel } from '@/lib/tournament-utils';

interface Matchup {
    id: string;
    status: string;
    teamA: { name: string } | null;
    teamASquad: string | null;
    teamB: { name: string } | null;
    teamBSquad: string | null;
    pointsA: number | null;
    pointsB: number | null;
}

interface Round {
    id: string;
    roundNumber: number;
    date: Date | null;
    matchups: Matchup[];
}

interface LeagueResultManagerProps {
    centerId: string;
    tournamentId: string;
    rounds: Round[];
    isManager: boolean;
}

export default function LeagueResultManager({
    centerId,
    tournamentId,
    rounds,
    isManager
}: LeagueResultManagerProps) {
    const isRoundFinished = (matchups: Matchup[]) => {
        return matchups.length > 0 && matchups.every(m => m.status === 'FINISHED');
    };

    return (
        <section className="card" style={{ padding: 0, overflow: 'hidden', border: '2px solid black' }}>
            <div style={{ padding: '1.5rem', backgroundColor: 'black', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    bowling {isManager ? "주차별 경기 결과 관리" : "주차별 경기 결과 확인"}
                </h2>
                {!isManager && (
                    <span style={{ fontSize: '0.75rem', opacity: 0.7, fontWeight: 500 }}>관리자만 결과를 입력할 수 있습니다.</span>
                )}
            </div>

            <div style={{ padding: '1.5rem' }}>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                    gap: '1.5rem'
                }}>
                    {rounds.map((round) => {
                        const finished = isRoundFinished(round.matchups);
                        return (
                            <div
                                key={round.id}
                                className="card"
                                style={{
                                    padding: '2rem',
                                    borderRadius: '1.5rem',
                                    border: finished ? '2px solid rgba(34, 197, 94, 0.3)' : '2px solid #e2e8f0',
                                    backgroundColor: finished ? 'rgba(34, 197, 94, 0.05)' : '#ffffff',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '2rem',
                                    transition: 'all 0.3s ease',
                                    textAlign: 'center'
                                }}
                            >
                                {/* Center-aligned Head Section */}
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', width: '100%' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                                        <span style={{
                                            padding: '0.25rem 0.75rem',
                                            borderRadius: '9999px',
                                            fontSize: '0.625rem',
                                            fontWeight: 900,
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em',
                                            backgroundColor: finished ? '#16a34a' : '#0f172a',
                                            color: '#ffffff'
                                        }}>
                                            WEEK {round.roundNumber}
                                        </span>
                                        {finished && (
                                            <span style={{ fontSize: '0.625rem', fontWeight: 'bold', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                ✅ 완료
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ fontWeight: 800, fontSize: '0.875rem', color: '#64748b' }}>
                                        {formatKSTDayLabel(round.date)}
                                    </div>
                                </div>

                                {/* Results Table (Guaranteed Center) */}
                                {finished && (
                                    <div style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                        <div style={{
                                            width: '100%',
                                            maxWidth: '300px',
                                            border: '2px solid #64748b',
                                            borderRadius: '0.75rem',
                                            overflow: 'hidden',
                                            backgroundColor: '#ffffff',
                                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                                        }}>
                                            {round.matchups.map((m, idx) => {
                                                const pa = Math.floor(m.pointsA || 0);
                                                const pb = Math.floor(m.pointsB || 0);

                                                return (
                                                    <div key={m.id} style={{
                                                        display: 'grid',
                                                        gridTemplateColumns: '1fr 60px 1fr',
                                                        alignItems: 'stretch',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 800,
                                                        borderBottom: idx !== round.matchups.length - 1 ? '1px solid #64748b' : 'none'
                                                    }}>
                                                        {/* Team A */}
                                                        <div style={{
                                                            padding: '0.75rem 0.5rem',
                                                            textAlign: 'center',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace: 'nowrap',
                                                            color: '#1e293b',
                                                            borderRight: '1px solid #64748b',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center'
                                                        }}>
                                                            {m.teamA?.name || '부전승'}
                                                            {m.teamASquad ? ` (${m.teamASquad})` : ''}
                                                        </div>

                                                        {/* Score */}
                                                        <div style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            backgroundColor: '#f8fafc',
                                                            color: '#0f172a',
                                                            borderRight: '1px solid #64748b',
                                                            fontWeight: 900
                                                        }}>
                                                            {pa}:{pb}
                                                        </div>

                                                        {/* Team B */}
                                                        <div style={{
                                                            padding: '0.75rem 0.5rem',
                                                            textAlign: 'center',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace: 'nowrap',
                                                            color: '#1e293b',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center'
                                                        }}>
                                                            {m.teamB?.name || '부전승'}
                                                            {m.teamBSquad ? ` (${m.teamBSquad})` : ''}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Bottom Link/Button */}
                                <div style={{ width: '100%', display: 'flex', justifyContent: 'center', marginTop: 'auto' }}>
                                    {isManager ? (
                                        <a
                                            href={`/centers/${centerId}/tournaments/${tournamentId}/rounds/${round.id}/results`}
                                            className="btn btn-secondary"
                                            style={{
                                                width: '100%',
                                                maxWidth: '300px',
                                                fontSize: '0.875rem',
                                                fontWeight: 'bold',
                                                textDecoration: 'none',
                                                backgroundColor: '#1e293b',
                                                color: '#ffffff',
                                                border: '2px solid black'
                                            }}
                                        >
                                            {finished ? "결과 상세보기" : "점수 입력하기"}
                                        </a>
                                    ) : (
                                        <a
                                            href={`/centers/${centerId}/tournaments/${tournamentId}/rounds/${round.id}/results`}
                                            className="btn btn-secondary"
                                            style={{
                                                width: '100%',
                                                maxWidth: '300px',
                                                fontSize: '0.875rem',
                                                fontWeight: 'bold',
                                                textDecoration: 'none',
                                                backgroundColor: finished ? '#16a34a' : '#94a3b8',
                                                color: '#ffffff',
                                                border: '2px solid black'
                                            }}
                                        >
                                            {finished ? "결과 확인하기" : "경기 준비 중"}
                                        </a>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
            {rounds.length === 0 && (
                <div style={{ padding: '5rem', textAlign: 'center', color: '#64748b' }}>
                    <p style={{ fontWeight: 500 }}>아직 등록된 일정과 결과가 없습니다.</p>
                </div>
            )}
        </section>
    );
}
