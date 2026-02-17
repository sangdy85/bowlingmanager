import React from 'react';

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
}

interface Top30LeaderboardData {
    top30: Player[];
    metadata: {
        currentRound: number;
        avgMinParticipationPct?: number;
        reportNotice?: string | null;
    };
}

export default function Top30Leaderboard({ data, title }: { data: Top30LeaderboardData, title: string }) {
    const { top30, metadata } = data;

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
        padding: '0.5rem 0.5rem',
        fontWeight: 900,
        fontSize: '1.5rem',
        letterSpacing: '0.1em',
        backgroundColor: '#ffffff',
        textTransform: 'uppercase',
        textAlign: 'center',
        marginBottom: '2rem',
        boxShadow: '4px 4px 0px 0px rgba(0,0,0,1)'
    };

    const thStyle: React.CSSProperties = {
        border: '1px solid #374151',
        padding: '6px 2px',
        backgroundColor: '#e5e7eb', // gray-200
        fontWeight: 900,
        whiteSpace: 'nowrap'
    };

    const tdStyle: React.CSSProperties = {
        border: '1px solid #374151',
        padding: '4px 2px',
        verticalAlign: 'middle',
        height: '28px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
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
                    {title} {metadata.currentRound}주차 개인 평균 Top 30
                </div>
            </div>

            {/* Top 30 Section */}
            <div style={{ marginTop: '1rem' }}>
                <table style={topTableStyle}>
                    <colgroup>
                        <col style={{ width: '80px' }} />
                        <col style={{ width: '200px' }} />
                        <col style={{ width: '250px' }} />
                        <col style={{ width: '150px' }} />
                    </colgroup>
                    <thead>
                        <tr>
                            <th style={topThStyle}>순위</th>
                            <th style={topThStyle}>이름</th>
                            <th style={topThStyle}>팀명</th>
                            <th style={topThStyle}>에버</th>
                        </tr>
                    </thead>
                    <tbody>
                        {top30.map((p, index) => (
                            <tr key={index} style={{ backgroundColor: index % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                                <td style={{ ...topTdStyle, fontWeight: 900, color: index < 3 ? '#dc2626' : '#000000' }}>{index + 1}</td>
                                <td style={{ ...topTdStyle, fontWeight: 900 }}>{p.name}</td>
                                <td style={topTdStyle}>{p.teamName}</td>
                                <td style={{ ...topTdStyle, backgroundColor: '#f3f4f6', fontWeight: index < 3 ? 900 : 700 }}>
                                    {(p.totalRawPins / (p.gamesCount || 1)).toFixed(2)}
                                </td>
                            </tr>
                        ))}
                        {/* Placeholder rows if data is sparse */}
                        {Array.from({ length: Math.max(0, 30 - top30.length) }).map((_, i) => (
                            <tr key={`empty-${i}`} style={{ height: '35px' }}>
                                <td style={topTdStyle}>&nbsp;</td>
                                <td style={topTdStyle}></td>
                                <td style={topTdStyle}></td>
                                <td style={topTdStyle}></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div style={{ marginTop: '2rem', textAlign: 'right', fontSize: '12px', fontWeight: 800, color: '#dc2626', maxWidth: '800px', margin: '2rem auto', fontStyle: 'italic', lineHeight: 1.6 }}>
                <p>* 참여율 기준은 {metadata.avgMinParticipationPct || 0}% 입니다.</p>
                {metadata.reportNotice && metadata.reportNotice.split('\n').filter(l => l.trim() !== '').map((line, i) => (
                    <p key={i}>{line.startsWith('*') ? line : `* ${line}`}</p>
                ))}
            </div>
        </div>
    );
}
