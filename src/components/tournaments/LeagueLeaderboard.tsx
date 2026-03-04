'use client';
import React, { useState, useEffect } from 'react';

interface LeaderboardData {
    teamStandings: {
        id: string;
        name: string;
        wins: number;
        losses: number;
        draws: number;
        points: number;
        totalPinfall: number;
        gamesPlayed: number;
        highSeries: number;
        highGame: number;
        lastRoundScore: number;
        previousTotal: number;
    }[];
    awards: {
        team: {
            average: any[];
            highSeries: any[];
            highGame: any[];
        };
        individual: {
            average: any[];
            highSeries: any[];
            highGame: any[];
        };
    };
    metadata: {
        currentRound: number;
        reportNotice?: string | null;
    };
}

export default function LeagueLeaderboard({ data, title }: { data: LeaderboardData, title: string }) {
    const { teamStandings, awards, metadata } = data;
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth <= 768);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Common Styles
    const containerStyle: React.CSSProperties = {
        backgroundColor: '#ffffff',
        color: '#000000',
        padding: '1rem',
        minHeight: '100vh',
        fontFamily: 'sans-serif'
    };

    const headerBoxStyle: React.CSSProperties = {
        border: '2px solid #000000',
        padding: isMobile ? '0.3rem 0.5rem' : '0.5rem 1rem',
        fontWeight: 900,
        fontSize: isMobile ? '1.1rem' : 'clamp(1rem, 4vw, 1.5rem)',
        letterSpacing: isMobile ? '0.05em' : '0.05em',
        backgroundColor: '#ffffff',
        textTransform: 'uppercase',
        textAlign: 'center',
        marginBottom: isMobile ? '1rem' : '1.5rem',
        boxShadow: isMobile ? '2px 2px 0px 0px rgba(0,0,0,1)' : '4px 4px 0px 0px rgba(0,0,0,1)',
        width: 'fit-content',
        margin: isMobile ? '0 auto 1rem auto' : '0 auto 1.5rem auto'
    };

    const tableStyle: React.CSSProperties = {
        width: '100%',
        borderCollapse: 'collapse',
        border: '2px solid #000000',
        fontSize: isMobile ? '10px' : '13px',
        fontWeight: 700,
        textAlign: 'center',
        marginBottom: isMobile ? '1rem' : '2rem'
    };

    const thStyle: React.CSSProperties = {
        border: '1px solid #000000',
        padding: isMobile ? '4px 1px' : '8px 4px',
        backgroundColor: '#e5e7eb', // gray-200
        fontWeight: 900,
        whiteSpace: 'nowrap'
    };

    const tdStyle: React.CSSProperties = {
        border: '1px solid #000000',
        padding: isMobile ? '2px 1px' : '6px 4px',
        verticalAlign: 'middle',
        height: isMobile ? '24px' : '32px'
    };

    const rankStyle: React.CSSProperties = {
        ...tdStyle,
        color: '#dc2626', // red-600
        fontWeight: 900
    };

    const awardHeaderStyle: React.CSSProperties = {
        backgroundColor: '#d1d5db', // gray-300
        fontWeight: 900,
        textAlign: 'center',
        padding: isMobile ? '6px' : '8px',
        fontSize: isMobile ? '12px' : 'inherit',
        border: '1px solid #000000',
        borderBottom: '2px solid #000000'
    };

    return (
        <div style={containerStyle}>
            {/* Title Header */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
                <div style={headerBoxStyle}>
                    {title} {metadata.currentRound}주차 순위표
                </div>
            </div>

            {/* 1. Team Standings Table */}
            <div className="table-responsive">
                <table style={tableStyle}>
                    <thead>
                        <tr style={{ backgroundColor: '#d1d5db', borderBottom: '2px solid #000000' }}>
                            <th style={{ ...thStyle, width: isMobile ? '30px' : '50px' }}>순위</th>
                            <th style={{ ...thStyle, minWidth: isMobile ? '60px' : '150px' }}>팀명</th>
                            <th style={{ ...thStyle, width: isMobile ? '25px' : '50px' }}>승</th>
                            <th style={{ ...thStyle, width: isMobile ? '25px' : '50px' }}>패</th>
                            <th style={{ ...thStyle, width: isMobile ? '25px' : '50px' }}>핸디</th>
                            <th style={{ ...thStyle, width: isMobile ? '30px' : '60px' }}>점수</th>
                            <th style={{ ...thStyle, width: isMobile ? '50px' : 'auto' }}>총핀합계</th>
                            <th style={{ ...thStyle, width: isMobile ? '40px' : 'auto' }}>평균</th>
                            {!isMobile && <th style={thStyle}>팀단게임</th>}
                            {!isMobile && <th style={thStyle}>팀하이게임</th>}
                            {!isMobile && <th style={thStyle}>{metadata.currentRound}주차</th>}
                            {!isMobile && <th style={thStyle}>전주총합</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {teamStandings.map((team, index) => (
                            <tr key={team.id} style={{ backgroundColor: index % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                                <td style={rankStyle}>{index + 1}</td>
                                <td style={{ ...tdStyle, fontWeight: 900, textAlign: 'left', paddingLeft: isMobile ? '4px' : '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{team.name}</td>
                                <td style={tdStyle}>{team.wins}</td>
                                <td style={tdStyle}>{team.losses}</td>
                                <td style={{ ...tdStyle, color: '#6b7280' }}>0</td>
                                <td style={{ ...tdStyle, backgroundColor: '#f3f4f6', fontWeight: 900 }}>{team.wins * 3}</td>
                                <td style={tdStyle}>{team.totalPinfall.toLocaleString()}</td>
                                <td style={tdStyle}>{(team.totalPinfall / team.gamesPlayed || 0).toFixed(1)}</td>
                                {!isMobile && <td style={tdStyle}>{team.highGame}</td>}
                                {!isMobile && <td style={tdStyle}>{team.highSeries}</td>}
                                {!isMobile && <td style={tdStyle}>{team.lastRoundScore}</td>}
                                {!isMobile && <td style={tdStyle}>{team.previousTotal.toLocaleString()}</td>}
                            </tr>
                        ))}
                    </tbody>
                    <tfoot style={{ backgroundColor: '#e5e7eb', borderTop: '2px solid #000000', fontWeight: 900 }}>
                        <tr>
                            <td colSpan={2} style={{ ...tdStyle, textAlign: 'center' }}>합계</td>
                            <td style={{ ...tdStyle, color: '#2563eb' }}>{teamStandings.reduce((a, b) => a + b.wins, 0)}</td>
                            <td style={{ ...tdStyle, color: '#dc2626' }}>{teamStandings.reduce((a, b) => a + b.losses, 0)}</td>
                            <td colSpan={isMobile ? 4 : 8} style={tdStyle}></td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            {/* 2. Awards Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))',
                gap: '0',
                border: '2px solid #000000'
            }}>
                {/* Left Column: Team Awards */}
                <div style={{ borderRight: isMobile ? 'none' : '2px solid #000000' }}>
                    {/* Team Average */}
                    <div style={awardHeaderStyle}>팀 에버</div>
                    <div className="table-responsive" style={{ marginBottom: 0 }}>
                        <table style={{ ...tableStyle, border: 'none', marginBottom: 0 }}>
                            <thead>
                                <tr>
                                    <th style={{ ...thStyle, width: isMobile ? '35px' : '50px' }}>순위</th>
                                    <th style={thStyle}>팀명</th>
                                    <th style={{ ...thStyle, width: isMobile ? '55px' : '80px' }}>평균</th>
                                </tr>
                            </thead>
                            <tbody>
                                {awards.team.average?.map((t: any, i: number) => (
                                    <tr key={i} style={{ borderBottom: '1px solid #000000' }}>
                                        <td style={tdStyle}>{i + 1}</td>
                                        <td style={{ ...tdStyle, fontWeight: 900 }}>{t.name}</td>
                                        <td style={tdStyle}>{(t.totalPinfall / t.gamesPlayed || 0).toFixed(1)}</td>
                                    </tr>
                                ))}
                                {Array.from({ length: Math.max(0, 3 - (awards.team.average?.length || 0)) }).map((_, i) => (
                                    <tr key={`empty-avg-${i}`} style={{ borderBottom: '1px solid #000000' }}><td style={tdStyle}>&nbsp;</td><td style={tdStyle}></td><td style={tdStyle}></td></tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Team High Series */}
                    <div style={{ ...awardHeaderStyle, borderTop: '2px solid #000000' }}>팀 하이게임 (3명 x 3게임)</div>
                    <div className="table-responsive" style={{ marginBottom: 0 }}>
                        <table style={{ ...tableStyle, border: 'none', marginBottom: 0 }}>
                            <thead>
                                <tr>
                                    <th style={{ ...thStyle, width: isMobile ? '35px' : '50px' }}>순위</th>
                                    <th style={thStyle}>팀명</th>
                                    <th style={{ ...thStyle, width: isMobile ? '55px' : '80px' }}>점수</th>
                                </tr>
                            </thead>
                            <tbody>
                                {awards.team.highSeries.map((t, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid #000000' }}>
                                        <td style={tdStyle}>{i + 1}</td>
                                        <td style={{ ...tdStyle, fontWeight: 900 }}>{t.name}</td>
                                        <td style={tdStyle}>{t.highSeries}</td>
                                    </tr>
                                ))}
                                {Array.from({ length: Math.max(0, 3 - awards.team.highSeries.length) }).map((_, i) => (
                                    <tr key={`empty-${i}`} style={{ borderBottom: '1px solid #000000' }}><td style={tdStyle}>&nbsp;</td><td style={tdStyle}></td><td style={tdStyle}></td></tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Team Single Game */}
                    <div style={{ ...awardHeaderStyle, borderTop: '2px solid #000000' }}>팀 단게임 (3명 x 1게임)</div>
                    <div className="table-responsive" style={{ marginBottom: 0 }}>
                        <table style={{ ...tableStyle, border: 'none', marginBottom: 0 }}>
                            <thead>
                                <tr>
                                    <th style={{ ...thStyle, width: isMobile ? '35px' : '50px' }}>순위</th>
                                    <th style={thStyle}>팀명</th>
                                    <th style={{ ...thStyle, width: isMobile ? '55px' : '80px' }}>점수</th>
                                </tr>
                            </thead>
                            <tbody>
                                {awards.team.highGame.map((t, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid #000000' }}>
                                        <td style={tdStyle}>{i + 1}</td>
                                        <td style={{ ...tdStyle, fontWeight: 900 }}>{t.name}</td>
                                        <td style={tdStyle}>{t.highGame}</td>
                                    </tr>
                                ))}
                                {Array.from({ length: Math.max(0, 3 - awards.team.highGame.length) }).map((_, i) => (
                                    <tr key={`empty-${i}`} style={{ borderBottom: '1px solid #000000' }}><td style={tdStyle}>&nbsp;</td><td style={tdStyle}></td><td style={tdStyle}></td></tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Right Column: Individual Awards */}
                <div style={{ borderTop: '2px solid #000000' }}>
                    {/* Individual Average */}
                    <div style={awardHeaderStyle}>개인 에버</div>
                    <div className="table-responsive" style={{ marginBottom: 0 }}>
                        <table style={{ ...tableStyle, border: 'none', marginBottom: 0 }}>
                            <thead>
                                <tr>
                                    <th style={{ ...thStyle, width: isMobile ? '35px' : '50px' }}>순위</th>
                                    <th style={{ ...thStyle, width: isMobile ? '65px' : '90px' }}>선수명</th>
                                    <th style={{ ...thStyle, width: isMobile ? '80px' : '110px' }}>팀명</th>
                                    <th style={{ ...thStyle, width: isMobile ? '55px' : '80px' }}>평균</th>
                                </tr>
                            </thead>
                            <tbody>
                                {awards.individual.average.map((p, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid #000000' }}>
                                        <td style={tdStyle}>{i + 1}</td>
                                        <td style={{ ...tdStyle, fontWeight: 900 }}>{p.playerName}</td>
                                        <td style={{ ...tdStyle, color: '#4b5563', fontSize: '11px' }}>{p.teamName}</td>
                                        <td style={tdStyle}>{(p.totalPinfall / p.totalGames || 0).toFixed(2)}</td>
                                    </tr>
                                ))}
                                {Array.from({ length: Math.max(0, 3 - awards.individual.average.length) }).map((_, i) => (
                                    <tr key={`empty-${i}`} style={{ borderBottom: '1px solid #000000' }}><td style={tdStyle}>&nbsp;</td><td style={tdStyle}></td><td style={tdStyle}></td><td style={tdStyle}></td></tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Individual Series */}
                    <div style={{ ...awardHeaderStyle, borderTop: '2px solid #000000' }}>개인 시리즈</div>
                    <div className="table-responsive" style={{ marginBottom: 0 }}>
                        <table style={{ ...tableStyle, border: 'none', marginBottom: 0 }}>
                            <thead>
                                <tr>
                                    <th style={{ ...thStyle, width: isMobile ? '35px' : '50px' }}>순위</th>
                                    <th style={{ ...thStyle, width: isMobile ? '65px' : '90px' }}>선수명</th>
                                    <th style={{ ...thStyle, width: isMobile ? '80px' : '110px' }}>팀명</th>
                                    <th style={{ ...thStyle, width: isMobile ? '55px' : '80px' }}>총점</th>
                                </tr>
                            </thead>
                            <tbody>
                                {awards.individual.highSeries.map((p, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid #000000' }}>
                                        <td style={tdStyle}>{i + 1}</td>
                                        <td style={{ ...tdStyle, fontWeight: 900 }}>{p.playerName}</td>
                                        <td style={{ ...tdStyle, color: '#4b5563', fontSize: '11px' }}>{p.teamName}</td>
                                        <td style={tdStyle}>{p.highSeries}</td>
                                    </tr>
                                ))}
                                {Array.from({ length: Math.max(0, 3 - awards.individual.highSeries.length) }).map((_, i) => (
                                    <tr key={`empty-${i}`} style={{ borderBottom: '1px solid #000000' }}><td style={tdStyle}>&nbsp;</td><td style={tdStyle}></td><td style={tdStyle}></td><td style={tdStyle}></td></tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Individual Single */}
                    <div style={{ ...awardHeaderStyle, borderTop: '2px solid #000000' }}>개인 단게임</div>
                    <div className="table-responsive" style={{ marginBottom: 0 }}>
                        <table style={{ ...tableStyle, border: 'none', marginBottom: 0 }}>
                            <thead>
                                <tr>
                                    <th style={{ ...thStyle, width: isMobile ? '35px' : '50px' }}>순위</th>
                                    <th style={{ ...thStyle, width: isMobile ? '65px' : '90px' }}>선수명</th>
                                    <th style={{ ...thStyle, width: isMobile ? '80px' : '110px' }}>팀명</th>
                                    <th style={{ ...thStyle, width: isMobile ? '55px' : '80px' }}>점수</th>
                                </tr>
                            </thead>
                            <tbody>
                                {awards.individual.highGame.map((p, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid #000000' }}>
                                        <td style={tdStyle}>{i + 1}</td>
                                        <td style={{ ...tdStyle, fontWeight: 900 }}>{p.playerName}</td>
                                        <td style={{ ...tdStyle, color: '#4b5563', fontSize: '11px' }}>{p.teamName}</td>
                                        <td style={tdStyle}>{p.highGame}</td>
                                    </tr>
                                ))}
                                {Array.from({ length: Math.max(0, 3 - awards.individual.highGame.length) }).map((_, i) => (
                                    <tr key={`empty-${i}`} style={{ borderBottom: '1px solid #000000' }}><td style={tdStyle}>&nbsp;</td><td style={tdStyle}></td><td style={tdStyle}></td><td style={tdStyle}></td></tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {metadata.reportNotice ? (
                <div style={{ marginTop: '1.5rem', whiteSpace: 'pre-wrap', textAlign: 'center', fontSize: '0.85rem', fontWeight: 800, color: '#dc2626', lineHeight: 1.6, padding: '1rem', border: '1px solid #fee2e2', borderRadius: '0.5rem', backgroundColor: '#fffafb' }}>
                    {metadata.reportNotice}
                </div>
            ) : (
                <div style={{ marginTop: '1rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: 700, color: '#dc2626', lineHeight: 1.5 }}>
                    <p>* 개인 에버 / 개인 시리즈 / 단게임은 12주(36게임) 이상 참여자 대상</p>
                    <p>* 개인 하이, 개인 단게임은 핸디 비포함(Raw Score) 우선</p>
                    <p>* 단체전은 중복시상 가능하나 개인전은 중복시상 불가 (에버 {'>'} 시리즈 {'>'} 단게임)</p>
                </div>
            )}
        </div>
    );
}
