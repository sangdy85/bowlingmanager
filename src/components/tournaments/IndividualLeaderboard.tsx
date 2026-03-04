'use client';
import React, { useState, useEffect } from 'react';

interface Player {
    userId: string | null;
    name: string;
    teamName?: string;
    gamesCount: number;
    handicap: number;
    totalRawPins: number;
    highSeries: number;
    highGame: number;
    lastMatchRawScore: number;
    previousTotalRawPins: number;
    currentWeekPins?: number;
}

interface TeamData {
    teamId: string;
    teamName: string;
    players: Player[];
}

interface IndividualLeaderboardData {
    teams: TeamData[];
    metadata: {
        currentRound: number;
    };
}

export default function IndividualLeaderboard({ data, title }: { data: IndividualLeaderboardData, title: string }) {
    const { teams, metadata } = data;
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth <= 768);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Common Styles (Matching the report style)
    const containerStyle: React.CSSProperties = {
        backgroundColor: '#ffffff',
        color: '#000000',
        padding: '1rem',
        minHeight: '100vh',
        fontFamily: 'sans-serif'
    };

    const headerBoxStyle: React.CSSProperties = {
        border: '2px solid #374151',
        padding: isMobile ? '0.3rem 0.5rem' : '0.5rem 0.5rem',
        fontWeight: 900,
        fontSize: isMobile ? '1.1rem' : '1.5rem',
        letterSpacing: isMobile ? '0.05em' : '0.1em',
        backgroundColor: '#ffffff',
        textTransform: 'uppercase',
        textAlign: 'center',
        marginBottom: isMobile ? '1rem' : '2rem',
        boxShadow: isMobile ? '2px 2px 0px 0px rgba(0,0,0,1)' : '4px 4px 0px 0px rgba(0,0,0,1)'
    };

    const tableStyle: React.CSSProperties = {
        width: '100%',
        borderCollapse: 'collapse',
        border: '2px solid #374151',
        fontSize: isMobile ? '10px' : '12px',
        fontWeight: 700,
        textAlign: 'center',
        marginBottom: isMobile ? '0.5rem' : '1rem',
        tableLayout: 'fixed'
    };

    const thStyle: React.CSSProperties = {
        border: '1px solid #374151',
        padding: isMobile ? '4px 1px' : '6px 2px',
        backgroundColor: '#e5e7eb', // gray-200
        fontWeight: 900,
        whiteSpace: 'nowrap'
    };

    const tdStyle: React.CSSProperties = {
        border: '1px solid #374151',
        padding: isMobile ? '2px 1px' : '4px 2px',
        verticalAlign: 'middle',
        height: isMobile ? '24px' : '28px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
    };

    const teamHeaderStyle: React.CSSProperties = {
        backgroundColor: '#374151', // gray-700
        color: '#ffffff',
        padding: isMobile ? '6px 10px' : '8px 16px',
        fontWeight: 900,
        fontSize: isMobile ? '12px' : '14px',
        border: '2px solid #374151',
        borderBottom: 'none'
    };

    const topTableStyle: React.CSSProperties = {
        width: '100%',
        maxWidth: '800px',
        margin: '0 auto',
        borderCollapse: 'collapse',
        border: '2px solid #374151',
        fontSize: '14px',
        fontWeight: 700,
        textAlign: 'center',
        marginBottom: '2rem'
    };

    const topThStyle: React.CSSProperties = {
        ...thStyle,
        fontSize: '15px'
    };

    const topTdStyle: React.CSSProperties = {
        ...tdStyle,
        fontSize: '14px',
        height: '35px'
    };

    return (
        <div style={containerStyle}>
            {/* Title Header */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
                <div style={headerBoxStyle}>
                    {title} {metadata.currentRound}주차 개인 순위표
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(500px, 1fr))', gap: isMobile ? '1rem' : '2rem' }}>
                {teams.map((team) => (
                    <div key={team.teamId}>
                        <div style={teamHeaderStyle}>
                            팀명: {team.teamName}
                        </div>
                        <table style={tableStyle}>
                            <colgroup>
                                <col style={{ width: isMobile ? '25px' : '40px' }} />
                                <col style={{ width: isMobile ? '45px' : '80px' }} />
                                <col style={{ width: isMobile ? '35px' : '50px' }} />
                                <col style={{ width: isMobile ? '30px' : '50px' }} />
                                <col style={{ width: isMobile ? '50px' : '60px' }} />
                                <col style={{ width: isMobile ? '40px' : '50px' }} />
                                <col style={{ width: isMobile ? '45px' : '60px' }} />
                                <col style={{ width: isMobile ? '35px' : '50px' }} />
                                <col style={{ width: isMobile ? '45px' : '60px' }} />
                                <col style={{ width: isMobile ? '55px' : '70px' }} />
                            </colgroup>
                            <thead>
                                <tr>
                                    <th style={thStyle}>순위</th>
                                    <th style={thStyle}>이름</th>
                                    <th style={thStyle}>게임수</th>
                                    <th style={thStyle}>핸디</th>
                                    <th style={thStyle}>핀합계</th>
                                    <th style={thStyle}>평균</th>
                                    <th style={thStyle}>최고3G</th>
                                    <th style={thStyle}>단게임</th>
                                    <th style={thStyle}>이전게임</th>
                                    <th style={thStyle}>전주총합</th>
                                </tr>
                            </thead>
                            <tbody>
                                {team.players.map((p, index) => {
                                    const totalWithHandicap = p.totalRawPins + (p.handicap * p.gamesCount);
                                    const currentWeekWithHandicap = p.currentWeekPins || 0;
                                    const previousTotalWithHandicap = totalWithHandicap - currentWeekWithHandicap;

                                    return (
                                        <tr key={index} style={{ backgroundColor: index % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                                            <td style={{ ...tdStyle, color: '#dc2626', fontWeight: 900 }}>{index + 1}</td>
                                            <td style={{ ...tdStyle, fontWeight: 900 }}>{p.name}</td>
                                            <td style={tdStyle}>{p.gamesCount}</td>
                                            <td style={{ ...tdStyle, color: '#6b7280' }}>{p.handicap}</td>
                                            <td style={{ ...tdStyle, fontWeight: 900 }}>{totalWithHandicap.toLocaleString()}</td>
                                            <td style={{ ...tdStyle, backgroundColor: '#f3f4f6' }}>{(totalWithHandicap / (p.gamesCount || 1)).toFixed(1)}</td>
                                            <td style={tdStyle}>{p.highSeries}</td>
                                            <td style={tdStyle}>{p.highGame}</td>
                                            <td style={tdStyle}>{currentWeekWithHandicap.toLocaleString()}</td>
                                            <td style={tdStyle}>{previousTotalWithHandicap.toLocaleString()}</td>
                                        </tr>
                                    );
                                })}
                                {/* Fill empty rows if less than 3 players (optional but looks nice) */}
                                {Array.from({ length: Math.max(1, 3 - team.players.length) }).map((_, i) => (
                                    <tr key={`empty-${i}`} style={{ height: '28px' }}>
                                        <td style={tdStyle}>&nbsp;</td><td style={tdStyle}></td><td style={tdStyle}></td><td style={tdStyle}></td>
                                        <td style={tdStyle}></td><td style={tdStyle}></td><td style={tdStyle}></td><td style={tdStyle}></td>
                                        <td style={tdStyle}></td><td style={tdStyle}></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ))}
            </div>
        </div>
    );
}
