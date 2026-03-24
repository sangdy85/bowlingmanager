'use client';

import { useState, useEffect } from 'react';

interface User {
    id: string;
    name: string;
}

interface TeamMember {
    user: User;
}

interface Team {
    id: string;
    name: string;
    members: TeamMember[];
}

interface IndividualScore {
    id?: string;
    userId?: string | null;
    playerName?: string | null;
    teamId: string;
    teamSquad?: string | null;
    handicap: number;
    score1: number;
    score2: number;
    score3: number;
}

interface Matchup {
    id: string;
    teamA: Team | null;
    teamB: Team | null;
    teamAId: string | null;
    teamBId: string | null;
    teamASquad?: string | null;
    teamBSquad?: string | null;
    lanes: string | null;
    individualScores: IndividualScore[];
    pointsA: number | null;
    pointsB: number | null;
    status: string;
}

interface RoundResultSummaryProps {
    tournamentName?: string;
    teamHandicapLimit?: number | null;
    round: {
        id: string;
        roundNumber: number;
        date: Date | null;
        matchups: Matchup[];
    };
}

export default function RoundResultSummary({ round, tournamentName, teamHandicapLimit }: RoundResultSummaryProps) {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth <= 768);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const getRecord = (pts: number | null) => {
        if (pts === null) return '-';
        const wins = Math.floor(pts);
        const draws = (pts % 1) === 0.5 ? 1 : 0;
        const losses = 4 - (wins + draws);
        return `${wins}승${draws > 0 ? `${draws}무` : ''}${losses}패`;
    };

    // Sort matchups by lane number numerically
    const sortedMatchups = [...round.matchups].sort((a, b) => {
        const laneA = parseInt(a.lanes?.split('-')[0] || '0', 10);
        const laneB = parseInt(b.lanes?.split('-')[0] || '0', 10);
        return laneA - laneB;
    });

    return (
        <div style={{ backgroundColor: '#ffffff', color: '#000000', padding: isMobile ? '0.5rem' : '1rem', minHeight: '100vh', fontFamily: 'sans-serif' }}>
            {/* Report Title */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: isMobile ? '1rem' : '2rem', paddingTop: isMobile ? '0px' : '1rem' }}>
                <div style={{ border: '2px solid #000000', padding: isMobile ? '0.4rem 0.5rem' : '0.5rem 3rem', fontWeight: 900, fontSize: isMobile ? '1.1rem' : '1.5rem', letterSpacing: isMobile ? '0.05em' : '0.2em', backgroundColor: '#ffffff', textTransform: 'uppercase', textAlign: 'center' }}>
                    {tournamentName || '상주리그'} {round.roundNumber}주차 (팀 기록표)
                </div>
            </div>

            {/* Matchups Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(500px, 1fr))', gap: isMobile ? '1rem' : '2rem' }}>
                {sortedMatchups.map((m) => {
                    const laneA = m.lanes?.split('-')[0] || '??';
                    const laneB = m.lanes?.split('-')[1] || '??';

                    const renderTeamTable = (team: Team | null, teamId: string | null, squad: string | undefined | null, laneNum: string, points: number | null, isRight: boolean) => {
                        const teamScores = m.individualScores.filter(s => s.teamId === teamId && s.teamSquad === squad);
                        const rawHSum = teamScores.reduce((sum, s) => sum + (s.handicap || 0), 0);
                        const hLimit = teamHandicapLimit !== undefined && teamHandicapLimit !== null ? Number(teamHandicapLimit) : null;
                        const hSum = (hLimit !== null && rawHSum > hLimit) ? hLimit : rawHSum;

                        const excessH = Math.max(0, rawHSum - hSum);

                        const g1 = teamScores.reduce((sum, s) => sum + Math.min((s.score1 || 0) + (s.handicap || 0), 300), 0) - excessH;
                        const g2 = teamScores.reduce((sum, s) => sum + Math.min((s.score2 || 0) + (s.handicap || 0), 300), 0) - excessH;
                        const g3 = teamScores.reduce((sum, s) => sum + Math.min((s.score3 || 0) + (s.handicap || 0), 300), 0) - excessH;

                        const opponentId = isRight ? m.teamAId : m.teamBId;
                        const opponentSquad = isRight ? m.teamASquad : m.teamBSquad;
                        const opponentScores = m.individualScores.filter(s => s.teamId === opponentId && s.teamSquad === opponentSquad);
                        const rawOHSum = opponentScores.reduce((sum, s) => sum + (s.handicap || 0), 0);
                        const ohSum = (hLimit !== null && rawOHSum > hLimit) ? hLimit : rawOHSum;

                        const og1 = opponentScores.reduce((sum, s) => sum + (s.score1 || 0), 0);
                        const og2 = opponentScores.reduce((sum, s) => sum + (s.score2 || 0), 0);
                        const og3 = opponentScores.reduce((sum, s) => sum + (s.score3 || 0), 0);


                        const draws = points !== null && (points % 1) === 0.5 ? 1 : 0;
                        const isWinner = points !== null && points >= 3;

                        const getMarker = (a: number, b: number) => {
                            if (a > b) return 'O';
                            if (a < b) return 'X';
                            return draws > 0 && a === b ? '△' : '-';
                        };

                        const marks = [
                            getMarker(g1, og1),
                            getMarker(g2, og2),
                            getMarker(g3, og3)
                        ];

                        const baseCell: React.CSSProperties = {
                            border: '1px solid #000000',
                            padding: isMobile ? '2px 1px' : '6px 4px',
                            textAlign: 'center',
                            verticalAlign: 'middle',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                        };

                        const winStyle: React.CSSProperties = {
                            color: '#e11d48',
                            fontWeight: 900
                        };

                        return (
                            <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000000', fontSize: isMobile ? '9px' : '13px', fontWeight: 700, backgroundColor: '#ffffff', color: '#000000', tableLayout: 'fixed' }}>
                                <colgroup>
                                    <col style={{ width: '20%' }} />
                                    <col style={{ width: '12%' }} />
                                    <col style={{ width: '14%' }} />
                                    <col style={{ width: '14%' }} />
                                    <col style={{ width: '14%' }} />
                                    <col style={{ width: '26%' }} />
                                </colgroup>
                                <thead>
                                    {/* Lane & Team & Record Header Row */}
                                    <tr style={{ backgroundColor: '#e2e8f0', borderBottom: '2px solid #000000' }}>
                                        <th style={{ ...baseCell, fontSize: isMobile ? '10px' : '12px' }}>{laneNum.padStart(2, '0')}레인</th>
                                        <th style={{ ...baseCell, fontSize: isMobile ? '11px' : '14px' }} colSpan={4}>
                                            {team?.name || '부전승'}
                                            {(isRight ? m.teamBSquad : m.teamASquad) ? ` (${isRight ? m.teamBSquad : m.teamASquad})` : ''}
                                        </th>
                                        <th style={{ ...baseCell, fontSize: isMobile ? '10px' : 'inherit', color: isWinner ? '#e11d48' : '#000000' }}>
                                            {getRecord(points)}
                                        </th>
                                    </tr>
                                    {/* Column Labels */}
                                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #000000', fontSize: isMobile ? '8px' : '11px' }}>
                                        <th style={baseCell}>이름</th>
                                        <th style={baseCell}>핸디</th>
                                        <th style={baseCell}>1G</th>
                                        <th style={baseCell}>2G</th>
                                        <th style={baseCell}>3G</th>
                                        <th style={{ ...baseCell, fontStyle: 'italic' }}>합계</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Array.from({ length: 3 }).map((_, idx) => {
                                        const s = teamScores[idx];
                                        return (
                                            <tr key={idx} style={{ borderBottom: '1px solid #000000', height: isMobile ? '24px' : '32px' }}>
                                                <td style={{ ...baseCell }}>{s?.playerName || ''}</td>
                                                <td style={{ ...baseCell, fontWeight: 400, color: '#64748b' }}>{s?.handicap || ''}</td>
                                                <td style={baseCell}>{s ? Math.min(s.score1 + s.handicap, 300) : ''}</td>
                                                <td style={baseCell}>{s ? Math.min(s.score2 + s.handicap, 300) : ''}</td>
                                                <td style={baseCell}>{s ? Math.min(s.score3 + s.handicap, 300) : ''}</td>
                                                <td style={{ ...baseCell, backgroundColor: '#f8fafc', fontWeight: 400 }}>{s ? Math.min(s.score1 + s.handicap, 300) + Math.min(s.score2 + s.handicap, 300) + Math.min(s.score3 + s.handicap, 300) : ''}</td>
                                            </tr>
                                        );
                                    })}
                                    {/* Team Total Row */}
                                    <tr style={{ backgroundColor: '#d9ead3', borderBottom: '2px solid #000000', height: isMobile ? '24px' : '32px' }}>
                                        <td style={baseCell}>종합</td>
                                        <td style={{ ...baseCell, fontWeight: 400 }}>{hSum || '0'}</td>
                                        <td style={{ ...baseCell, ...(marks[0] === 'O' ? winStyle : {}) }}>{g1}</td>
                                        <td style={{ ...baseCell, ...(marks[1] === 'O' ? winStyle : {}) }}>{g2}</td>
                                        <td style={{ ...baseCell, ...(marks[2] === 'O' ? winStyle : {}) }}>{g3}</td>
                                        <td style={{ ...baseCell, backgroundColor: 'rgba(226, 232, 240, 0.5)', ...(isWinner ? winStyle : { fontWeight: 900 }) }}>{g1 + g2 + g3}</td>
                                    </tr>
                                    {/* Win/Loss Record */}
                                    <tr style={{ height: isMobile ? '28px' : '36px' }}>
                                        <td style={baseCell}>승패</td>
                                        <td style={baseCell}></td>
                                        <td style={{ ...baseCell, fontSize: isMobile ? '12px' : '18px', ...(marks[0] === 'O' ? winStyle : {}) }}>{marks[0]}</td>
                                        <td style={{ ...baseCell, fontSize: isMobile ? '12px' : '18px', ...(marks[1] === 'O' ? winStyle : {}) }}>{marks[1]}</td>
                                        <td style={{ ...baseCell, fontSize: isMobile ? '12px' : '18px', ...(marks[2] === 'O' ? winStyle : {}) }}>{marks[2]}</td>
                                        <td style={{ ...baseCell, fontSize: isMobile ? '12px' : '18px', fontStyle: 'italic', backgroundColor: '#f1f5f9', ...(isWinner ? winStyle : {}) }}>{getMarker(points || 0, 2)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        );
                    };

                    return (
                        <div key={m.id} style={{ display: 'flex', gap: isMobile ? '0.25rem' : '1rem', padding: '0.2rem', marginBottom: isMobile ? '0.5rem' : '1rem', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
                            {renderTeamTable(m.teamA, m.teamAId, m.teamASquad, laneA, m.pointsA, false)}
                            {renderTeamTable(m.teamB, m.teamBId, m.teamBSquad, laneB, m.pointsB, true)}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
