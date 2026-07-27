'use client';

import React, { useState, useRef } from 'react';
import { toPng } from 'html-to-image';
import { getLeagueLeaderboard, getIndividualLeaderboard } from '@/app/actions/league-leaderboard';

interface WeeklyResultDownloaderProps {
    tournamentId: string;
    tournamentName: string;
    rounds: any[];
    teamHandicapLimit?: number | null;
    awardMinGames?: number;
    reportNotice?: string | null;
}
export default function WeeklyResultDownloader({
    tournamentId,
    tournamentName,
    rounds,
    teamHandicapLimit,
    awardMinGames = 36, // Default to 36 games (12 weeks)
    reportNotice
}: WeeklyResultDownloaderProps) {
    // Find the latest round that has entered scores or is not pending
    const getLatestActiveRound = () => {
        if (!rounds || rounds.length === 0) return 1;

        // Reverse search for the first round that has any scores or non-pending status
        const latestActive = [...rounds].reverse().find(r =>
            r.matchups?.some((m: any) => m.status !== 'PENDING' || m.scoreA1 !== null)
        );

        return latestActive ? latestActive.roundNumber : rounds[0].roundNumber;
    };

    const [selectedRound, setSelectedRound] = useState<number>(getLatestActiveRound());
    const [isGenerating, setIsGenerating] = useState<string | null>(null);

    // Refs for different templates
    const teamStandingsRef = useRef<HTMLDivElement>(null);
    const individualByTeamRef = useRef<HTMLDivElement>(null);
    const matchRecordRef = useRef<HTMLDivElement>(null);
    const top30Ref = useRef<HTMLDivElement>(null);

    const [templateData, setTemplateData] = useState<any>(null);

    const handleDownload = async (type: 'TEAM_STANDINGS' | 'INDIVIDUAL_BY_TEAM' | 'MATCH_RECORD' | 'TOP_30') => {
        setIsGenerating(type);
        try {
            // 1. Fetch data for the specified week (Always fetch roundInfo for the selected round to avoid caching issues)
            const [leaderboard, individual] = await Promise.all([
                getLeagueLeaderboard(tournamentId, selectedRound),
                getIndividualLeaderboard(tournamentId, selectedRound)
            ]);

            const roundInfo = rounds.find(r => r.roundNumber === selectedRound);
            if (!roundInfo) throw new Error("주차 정보를 찾을 수 없습니다.");

            const currentData = { leaderboard, individual, roundInfo };
            setTemplateData(currentData);

            // Wait longer for complex grid rendering (1000ms)
            await new Promise(resolve => setTimeout(resolve, 1000));

            // 2. Capture and download
            let targetRef: React.RefObject<HTMLDivElement | null> | null = null;
            let fileName = "";

            switch (type) {
                case 'TEAM_STANDINGS': targetRef = teamStandingsRef; fileName = "팀순위표"; break;
                case 'INDIVIDUAL_BY_TEAM': targetRef = individualByTeamRef; fileName = "개인순위표_팀별"; break;
                case 'MATCH_RECORD': targetRef = matchRecordRef; fileName = "팀기록표"; break;
                case 'TOP_30': targetRef = top30Ref; fileName = "개인평균TOP30"; break;
            }

            if (targetRef?.current) {
                const dataUrl = await toPng(targetRef.current, {
                    quality: 1,
                    backgroundColor: '#ffffff',
                    pixelRatio: 2,
                });

                const link = document.createElement('a');
                link.download = `${tournamentName}_${selectedRound}주차_${fileName}.png`;
                link.href = dataUrl;
                link.click();
            }
            setIsGenerating(null);
        } catch (error) {
            console.error('Download error:', error);
            alert('이미지 생성 중 오류가 발생했습니다.');
            setIsGenerating(null);
        }
    };

    const handleDownloadAll = async () => {
        setIsGenerating('ALL');
        try {
            // 1. Ensure data is fetched
            const [leaderboard, individual] = await Promise.all([
                getLeagueLeaderboard(tournamentId, selectedRound),
                getIndividualLeaderboard(tournamentId, selectedRound)
            ]);
            const roundInfo = rounds.find(r => r.roundNumber === selectedRound);
            if (!roundInfo) throw new Error("주차 정보를 찾을 수 없습니다.");

            const data = { leaderboard, individual, roundInfo };
            setTemplateData(data);

            // Wait for re-render (1000ms for large batch)
            await new Promise(resolve => setTimeout(resolve, 1000));

            const tasks = [
                { ref: teamStandingsRef, name: "팀순위표" },
                { ref: individualByTeamRef, name: "개인순위표_팀별" },
                { ref: matchRecordRef, name: "팀기록표" },
                { ref: top30Ref, name: "개인평균TOP30" }
            ];

            for (const task of tasks) {
                if (task.ref.current) {
                    const dataUrl = await toPng(task.ref.current, {
                        quality: 1,
                        backgroundColor: '#ffffff',
                        pixelRatio: 2,
                    });
                    const link = document.createElement('a');
                    link.download = `${tournamentName}_${selectedRound}주차_${task.name}.png`;
                    link.href = dataUrl;
                    link.click();
                    // Slight delay between downloads to avoid browser issues
                    await new Promise(resolve => setTimeout(resolve, 300));
                }
            }
        } catch (error) {
            console.error('Download All error:', error);
            alert('전체 다운로드 중 오류가 발생했습니다.');
        } finally {
            setIsGenerating(null);
        }
    };

    const getBtnLabel = (type: string, base: string) => {
        return isGenerating === type ? "생성 중..." : base;
    };

    const noticeLines = (reportNotice || `* 개인 에버 / 개인 하이 / 단게임은 ${Math.ceil(awardMinGames / 3)}주(${awardMinGames}게임) 이상 참여자 대상\n* 모든 개인 기록(에버, 하이, 단게임)은 핸디캡 포함 기준입니다.\n* 단체전은 중복시상 가능하나 개인전은 중복시상 불가 (에버 1,2 > 하이 1 > 에버 3 > 단게임 1 ... 순)`).split('\n').filter(l => l.trim() !== '');

    // Style Constants matching LeagueLeaderboard.tsx
    const containerStyle: React.CSSProperties = {
        backgroundColor: '#ffffff',
        color: '#000000',
        padding: '2rem',
        width: '1000px',
        fontFamily: 'sans-serif'
    };

    const headerBoxStyle: React.CSSProperties = {
        border: '3px solid #000000',
        padding: '0.75rem 3rem',
        fontWeight: 900,
        fontSize: '2rem',
        letterSpacing: '0.1em',
        backgroundColor: '#ffffff',
        textTransform: 'uppercase',
        textAlign: 'center',
        marginBottom: '2.5rem',
        boxShadow: '6px 6px 0px 0px rgba(0,0,0,1)',
        display: 'inline-block'
    };

    const tableStyle: React.CSSProperties = {
        width: '100%',
        borderCollapse: 'collapse',
        border: '3px solid #000000',
        fontSize: '14px',
        fontWeight: 700,
        textAlign: 'center',
        marginBottom: '2.5rem'
    };

    const thStyle: React.CSSProperties = {
        border: '1px solid #000000',
        padding: '12px 6px',
        backgroundColor: '#e5e7eb',
        fontWeight: 900,
        whiteSpace: 'nowrap'
    };

    const tdStyle: React.CSSProperties = {
        border: '1px solid #000000',
        padding: '8px 6px',
        verticalAlign: 'middle'
    };

    const rankStyle: React.CSSProperties = {
        ...tdStyle,
        color: '#dc2626',
        fontWeight: 900
    };

    const awardHeaderStyle: React.CSSProperties = {
        backgroundColor: '#d1d5db',
        fontWeight: 900,
        textAlign: 'center',
        padding: '10px',
        border: '1px solid #000000',
        borderBottom: '3px solid #000000',
        fontSize: '16px'
    };

    return (
        <section className="card p-8 border-2 border-black bg-white shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <div>
                    <h2 className="text-2xl font-black flex items-center gap-2 mb-2">
                        📊 주차별 공식 결과표 다운로드
                    </h2>
                    <p className="text-sm text-secondary-foreground font-medium">공식 SNS 공유 및 공지용 고품질 리포트 이미지 4종을 생성합니다.</p>
                </div>

                <div className="flex items-center gap-4 bg-zinc-100 p-3 rounded-xl border border-zinc-200">
                    <span className="text-sm font-black text-zinc-600">주차 선택:</span>
                    <select
                        value={selectedRound}
                        onChange={(e) => {
                            setSelectedRound(Number(e.target.value));
                            setTemplateData(null); // Clear cached data when round changes
                        }}
                        className="bg-white border-2 border-zinc-300 rounded-lg px-4 py-2 text-sm font-black focus:outline-none focus:border-primary transition-colors cursor-pointer"
                    >
                        {Array.from({ length: rounds[rounds.length - 1]?.roundNumber || 0 }, (_, i) => i + 1).map(r => (
                            <option key={r} value={r}>{r}회차 (Week {r})</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <button
                    onClick={() => handleDownload('TEAM_STANDINGS')}
                    disabled={isGenerating !== null}
                    className="btn btn-primary h-14 font-black flex items-center justify-center gap-2 shadow-md border-2 border-black"
                >
                    {isGenerating === 'TEAM_STANDINGS' ? '생성 중...' : '🏆 팀 순위 & 시상'}
                </button>
                <button
                    onClick={() => handleDownload('INDIVIDUAL_BY_TEAM')}
                    disabled={isGenerating !== null}
                    className="btn btn-primary h-14 font-black flex items-center justify-center gap-2 shadow-md border-2 border-black"
                >
                    {isGenerating === 'INDIVIDUAL_BY_TEAM' ? '생성 중...' : '👥 팀별 개인 순위'}
                </button>
                <button
                    onClick={() => handleDownload('MATCH_RECORD')}
                    disabled={isGenerating !== null}
                    className="btn btn-primary h-14 font-black flex items-center justify-center gap-2 shadow-md border-2 border-black"
                >
                    {isGenerating === 'MATCH_RECORD' ? '생성 중...' : '📝 매치 기록표'}
                </button>
                <button
                    onClick={() => handleDownload('TOP_30')}
                    disabled={isGenerating !== null}
                    className="btn btn-primary h-14 font-black flex items-center justify-center gap-2 shadow-md border-2 border-black"
                >
                    {isGenerating === 'TOP_30' ? '생성 중...' : '🔥 개인 평균 TOP 30'}
                </button>
                <button
                    onClick={handleDownloadAll}
                    disabled={isGenerating !== null}
                    className="btn h-14 font-black flex items-center justify-center gap-2 shadow-md border-2 border-black bg-zinc-800 text-white hover:bg-zinc-700"
                >
                    {isGenerating === 'ALL' ? '전체 생성 중...' : '📥 4종 전체 다운로드'}
                </button>
            </div>

            {/* Hidden Templates for Image Generation */}
            <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', pointerEvents: 'none' }}>
                {templateData && (
                    <div style={{ backgroundColor: '#ffffff' }}>

                        {/* 1. Team Standings & Awards */}
                        <div ref={teamStandingsRef} style={containerStyle}>
                            <div style={{ display: 'flex', justifyContent: 'center' }}>
                                <div style={headerBoxStyle}>
                                    {tournamentName} {selectedRound}주차 순위표
                                </div>
                            </div>

                            <table style={tableStyle}>
                                <thead>
                                    <tr style={{ backgroundColor: '#d1d5db', borderBottom: '3px solid #000000' }}>
                                        <th style={{ ...thStyle, width: '60px' }}>순위</th>
                                        <th style={{ ...thStyle, textAlign: 'center', width: '200px' }}>팀명</th>
                                        <th style={{ ...thStyle, width: '45px' }}>승</th>
                                        <th style={{ ...thStyle, width: '45px' }}>패</th>
                                        <th style={{ ...thStyle, width: '45px' }}>핸디</th>
                                        <th style={{ ...thStyle, width: '60px' }}>점수</th>
                                        <th style={{ ...thStyle, width: '100px' }}>총핀합계</th>
                                        <th style={{ ...thStyle, width: '80px' }}>평균</th>
                                        <th style={{ ...thStyle, width: '90px' }}>팀단게임</th>
                                        <th style={{ ...thStyle, width: '90px' }}>팀하이게임</th>
                                        <th style={{ ...thStyle, width: '90px' }}>{selectedRound}주차</th>
                                        <th style={{ ...thStyle, width: '90px' }}>전주총합</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {templateData.leaderboard.teamStandings.map((team: any, idx: number) => (
                                        <tr key={team.id} style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                                            <td style={rankStyle}>{idx + 1}</td>
                                            <td style={{ ...tdStyle, fontWeight: 900, textAlign: 'left', paddingLeft: '12px' }}>{team.name}</td>
                                            <td style={tdStyle}>{team.wins}</td>
                                            <td style={tdStyle}>{team.losses}</td>
                                            <td style={{ ...tdStyle, color: '#6b7280' }}>0</td>
                                            <td style={{ ...tdStyle, backgroundColor: '#f3f4f6', fontWeight: 900 }}>{team.wins * 3}</td>
                                            <td style={tdStyle}>{team.totalPinfall.toLocaleString()}</td>
                                            <td style={tdStyle}>{(team.totalPinfall / (team.gamesPlayed || 1)).toFixed(1)}</td>
                                            <td style={tdStyle}>{team.highGame}</td>
                                            <td style={tdStyle}>{team.highSeries}</td>
                                            <td style={tdStyle}>{team.currentWeekScore.toLocaleString()}</td>
                                            <td style={tdStyle}>{team.previousTotal.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot style={{ backgroundColor: '#e5e7eb', borderTop: '3px solid #000000', fontWeight: 900 }}>
                                    <tr style={{ height: '40px' }}>
                                        <td colSpan={2} style={{ ...tdStyle, textAlign: 'center' }}>합계</td>
                                        <td style={{ ...tdStyle, color: '#2563eb' }}>
                                            {templateData.leaderboard.teamStandings.reduce((sum: number, t: any) => sum + t.wins, 0)}
                                        </td>
                                        <td style={{ ...tdStyle, color: '#dc2626' }}>
                                            {templateData.leaderboard.teamStandings.reduce((sum: number, t: any) => sum + t.losses, 0)}
                                        </td>
                                        <td colSpan={8} style={tdStyle}></td>
                                    </tr>
                                </tfoot>
                            </table>

                            {/* Award Info Grid Section */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', border: '3px solid #000000' }}>
                                {/* Left: Team Awards */}
                                <div style={{ borderRight: '1.5px solid #000000' }}>
                                    <div style={awardHeaderStyle}>팀 에버</div>
                                    <table style={{ ...tableStyle, border: 'none', marginBottom: 0 }}>
                                        <thead style={{ backgroundColor: '#f9fafb', borderBottom: '1.5px solid #000000' }}>
                                            <tr><th style={{ ...thStyle, border: 'none', width: '50px' }}>순위</th><th style={{ ...thStyle, border: 'none' }}>팀명</th><th style={{ ...thStyle, border: 'none', width: '80px' }}>평균</th></tr>
                                        </thead>
                                        <tbody style={{ fontWeight: 800 }}>
                                            {templateData.leaderboard.awards.team.average.map((t: any, i: number) => (
                                                <tr key={i} style={{ borderBottom: '1px solid #e5e7eb', height: '36px' }}>
                                                    <td style={{ ...tdStyle, border: 'none' }}>{i + 1}</td>
                                                    <td style={{ ...tdStyle, border: 'none', fontWeight: 900 }}>{t.name}</td>
                                                    <td style={{ ...tdStyle, border: 'none' }}>{(t.totalPinfall / (t.gamesPlayed || 1)).toFixed(1)}</td>
                                                </tr>
                                            ))}
                                            {Array.from({ length: Math.max(0, 3 - templateData.leaderboard.awards.team.average.length) }).map((_, i) => (
                                                <tr key={`empty-avg-${i}`} style={{ height: '36px' }}><td colSpan={3}>&nbsp;</td></tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    <div style={{ ...awardHeaderStyle, borderTop: '3px solid #000000' }}>팀 하이게임 (3명 x 3게임)</div>
                                    <table style={{ ...tableStyle, border: 'none', marginBottom: 0 }}>
                                        <tbody style={{ fontWeight: 800 }}>
                                            {templateData.leaderboard.awards.team.highSeries.map((t: any, i: number) => (
                                                <tr key={i} style={{ borderBottom: '1px solid #e5e7eb', height: '36px' }}>
                                                    <td style={{ ...tdStyle, border: 'none', width: '50px' }}>{i + 1}</td>
                                                    <td style={{ ...tdStyle, border: 'none', fontWeight: 900 }}>{t.name}</td>
                                                    <td style={{ ...tdStyle, border: 'none', width: '80px' }}>{t.highSeries}</td>
                                                </tr>
                                            ))}
                                            {Array.from({ length: Math.max(0, 3 - templateData.leaderboard.awards.team.highSeries.length) }).map((_, i) => (
                                                <tr key={`empty-series-${i}`} style={{ height: '36px' }}><td colSpan={3}>&nbsp;</td></tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    <div style={{ ...awardHeaderStyle, borderTop: '3px solid #000000' }}>팀 단게임 (3명 x 1게임)</div>
                                    <table style={{ ...tableStyle, border: 'none', marginBottom: 0 }}>
                                        <tbody style={{ fontWeight: 800 }}>
                                            {templateData.leaderboard.awards.team.highGame.map((t: any, i: number) => (
                                                <tr key={i} style={{ borderBottom: '1px solid #e5e7eb', height: '36px' }}>
                                                    <td style={{ ...tdStyle, border: 'none', width: '50px' }}>{i + 1}</td>
                                                    <td style={{ ...tdStyle, border: 'none', fontWeight: 900 }}>{t.name}</td>
                                                    <td style={{ ...tdStyle, border: 'none', width: '80px' }}>{t.highGame}</td>
                                                </tr>
                                            ))}
                                            {Array.from({ length: Math.max(0, 3 - templateData.leaderboard.awards.team.highGame.length) }).map((_, i) => (
                                                <tr key={`empty-game-${i}`} style={{ height: '36px' }}><td colSpan={3}>&nbsp;</td></tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {/* Right: Individual Awards */}
                                <div style={{ borderLeft: '1.5px solid #000000' }}>
                                    <div style={awardHeaderStyle}>개인 에버 ({Math.ceil(awardMinGames / 3)}주 이상)</div>
                                    <table style={{ ...tableStyle, border: 'none', marginBottom: 0 }}>
                                        <thead style={{ backgroundColor: '#f9fafb', borderBottom: '1.5px solid #000000' }}>
                                            <tr>
                                                <th style={{ ...thStyle, border: 'none', width: '45px' }}>순위</th>
                                                <th style={{ ...thStyle, border: 'none', width: '80px' }}>선수명</th>
                                                <th style={{ ...thStyle, border: 'none', width: '100px' }}>팀명</th>
                                                <th style={{ ...thStyle, border: 'none', width: '70px' }}>평균</th>
                                            </tr>
                                        </thead>
                                        <tbody style={{ fontWeight: 800 }}>
                                            {templateData.leaderboard.awards.individual.average.map((p: any, i: number) => (
                                                <tr key={i} style={{ borderBottom: '1px solid #e5e7eb', height: '36px' }}>
                                                    <td style={{ ...tdStyle, border: 'none', width: '45px' }}>{i + 1}</td>
                                                    <td style={{ ...tdStyle, border: 'none', fontWeight: 900, width: '80px' }}>{p.playerName}</td>
                                                    <td style={{ ...tdStyle, border: 'none', fontWeight: 900, width: '100px' }}>{p.teamName}</td>
                                                    <td style={{ ...tdStyle, border: 'none', width: '70px' }}>{(p.totalPinfall / (p.totalGames || 1)).toFixed(2)}</td>
                                                </tr>
                                            ))}
                                            {Array.from({ length: Math.max(0, 3 - templateData.leaderboard.awards.individual.average.length) }).map((_, i) => (
                                                <tr key={`empty-indavg-${i}`} style={{ height: '36px' }}><td colSpan={4}>&nbsp;</td></tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    <div style={{ ...awardHeaderStyle, borderTop: '3px solid #000000' }}>개인 시리즈 (1명 x 3게임)</div>
                                    <table style={{ ...tableStyle, border: 'none', marginBottom: 0 }}>
                                        <thead style={{ backgroundColor: '#f9fafb', borderBottom: '1.5px solid #000000' }}>
                                            <tr>
                                                <th style={{ ...thStyle, border: 'none', width: '45px' }}>순위</th>
                                                <th style={{ ...thStyle, border: 'none', width: '80px' }}>선수명</th>
                                                <th style={{ ...thStyle, border: 'none', width: '100px' }}>팀명</th>
                                                <th style={{ ...thStyle, border: 'none', width: '70px' }}>총점</th>
                                            </tr>
                                        </thead>
                                        <tbody style={{ fontWeight: 800 }}>
                                            {templateData.leaderboard.awards.individual.highSeries.map((p: any, i: number) => (
                                                <tr key={i} style={{ borderBottom: '1px solid #e5e7eb', height: '36px' }}>
                                                    <td style={{ ...tdStyle, border: 'none', width: '45px' }}>{i + 1}</td>
                                                    <td style={{ ...tdStyle, border: 'none', fontWeight: 900, width: '80px' }}>{p.playerName}</td>
                                                    <td style={{ ...tdStyle, border: 'none', fontWeight: 900, width: '100px' }}>{p.teamName}</td>
                                                    <td style={{ ...tdStyle, border: 'none', width: '70px' }}>{p.highSeries}</td>
                                                </tr>
                                            ))}
                                            {Array.from({ length: Math.max(0, 3 - templateData.leaderboard.awards.individual.highSeries.length) }).map((_, i) => (
                                                <tr key={`empty-indser-${i}`} style={{ height: '36px' }}><td colSpan={4}>&nbsp;</td></tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    <div style={{ ...awardHeaderStyle, borderTop: '3px solid #000000' }}>개인 단게임</div>
                                    <table style={{ ...tableStyle, border: 'none', marginBottom: 0 }}>
                                        <thead style={{ backgroundColor: '#f9fafb', borderBottom: '1.5px solid #000000' }}>
                                            <tr>
                                                <th style={{ ...thStyle, border: 'none', width: '45px' }}>순위</th>
                                                <th style={{ ...thStyle, border: 'none', width: '80px' }}>선수명</th>
                                                <th style={{ ...thStyle, border: 'none', width: '100px' }}>팀명</th>
                                                <th style={{ ...thStyle, border: 'none', width: '70px' }}>점수</th>
                                            </tr>
                                        </thead>
                                        <tbody style={{ fontWeight: 800 }}>
                                            {templateData.leaderboard.awards.individual.highGame.map((p: any, i: number) => (
                                                <tr key={i} style={{ borderBottom: '1px solid #e5e7eb', height: '36px' }}>
                                                    <td style={{ ...tdStyle, border: 'none', width: '45px' }}>{i + 1}</td>
                                                    <td style={{ ...tdStyle, border: 'none', fontWeight: 900, width: '80px' }}>{p.playerName}</td>
                                                    <td style={{ ...tdStyle, border: 'none', fontWeight: 900, width: '100px' }}>{p.teamName}</td>
                                                    <td style={{ ...tdStyle, border: 'none', width: '70px' }}>{p.highGame}</td>
                                                </tr>
                                            ))}
                                            {Array.from({ length: Math.max(0, 3 - templateData.leaderboard.awards.individual.highGame.length) }).map((_, i) => (
                                                <tr key={`empty-indgame-${i}`} style={{ height: '36px' }}><td colSpan={4}>&nbsp;</td></tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div style={{ marginTop: '1.5rem', textAlign: 'right', fontSize: '12px', fontWeight: 800, color: '#dc2626', lineHeight: 1.6, fontStyle: 'italic' }}>
                                {noticeLines.map((line, i) => (
                                    <p key={i}>{line.startsWith('*') ? line : `* ${line}`}</p>
                                ))}
                            </div>
                        </div>

                        {/* 2. Individual Standings by Team */}
                        <div ref={individualByTeamRef} style={containerStyle}>
                            <div style={{ display: 'flex', justifyContent: 'center' }}>
                                <div style={headerBoxStyle}>
                                    {tournamentName} {selectedRound}주차 팀별 개인순위
                                </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                                {templateData.individual.teams.map((team: any) => (
                                    <div key={team.teamId} style={{ border: '3px solid #000000' }}>
                                        <div style={{ backgroundColor: '#18181b', color: '#ffffff', padding: '10px 20px', fontWeight: 900, fontSize: '16px' }}>팀명: {team.teamName}</div>
                                        <table style={{ ...tableStyle, marginBottom: 0, border: 'none' }}>
                                            <thead>
                                                <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '2px solid #000000' }}>
                                                    <th style={{ ...thStyle, width: '50px' }}>순위</th>
                                                    <th style={{ ...thStyle, width: '180px' }}>이름</th>
                                                    <th style={{ ...thStyle, width: '60px' }}>게임수</th>
                                                    <th style={{ ...thStyle, width: '60px' }}>핸디</th>
                                                    <th style={{ ...thStyle, width: '90px' }}>핀합계</th>
                                                    <th style={{ ...thStyle, width: '80px' }}>평균</th>
                                                    <th style={{ ...thStyle, width: '90px' }}>최고3G</th>
                                                    <th style={{ ...thStyle, width: '90px' }}>단게임</th>
                                                    <th style={{ ...thStyle, color: '#2563eb', width: '90px' }}>{selectedRound}주차</th>
                                                    <th style={thStyle}>전주총합</th>
                                                </tr>
                                            </thead>
                                            <tbody style={{ fontWeight: 800 }}>
                                                {team.players.map((p: any, idx: number) => {
                                                    const totalWithHandicap = p.totalRawPins + (p.handicap * p.gamesCount);
                                                    const currentWeekWithHandicap = p.currentWeekPins || 0;
                                                    const previousTotalWithHandicap = totalWithHandicap - currentWeekWithHandicap;

                                                    return (
                                                        <tr key={idx} style={{ borderBottom: '1px solid #000000', height: '36px' }}>
                                                            <td style={rankStyle}>{idx + 1}</td>
                                                            <td style={{ ...tdStyle, fontWeight: 900, textAlign: 'left', paddingLeft: '15px' }}>{p.name}</td>
                                                            <td style={tdStyle}>{p.gamesCount}</td>
                                                            <td style={{ ...tdStyle, color: '#9ca3af' }}>{p.handicap}</td>
                                                            <td style={tdStyle}>{totalWithHandicap.toLocaleString()}</td>
                                                            <td style={tdStyle}>{(totalWithHandicap / (p.gamesCount || 1)).toFixed(1)}</td>
                                                            <td style={tdStyle}>{p.highSeries}</td>
                                            <td style={tdStyle}>{p.highGame}</td>
                                                            <td style={{ ...tdStyle, backgroundColor: '#eff6ff' }}>{currentWeekWithHandicap.toLocaleString()}</td>
                                                            <td style={tdStyle}>{previousTotalWithHandicap.toLocaleString()}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 3. Match Record Sheet */}
                        <div ref={matchRecordRef} style={{ ...containerStyle, width: '1100px' }}>
                            <div style={{ display: 'flex', justifyContent: 'center' }}>
                                <div style={headerBoxStyle}>
                                    {tournamentName} {selectedRound}주차 (팀 기록표)
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2.5rem 1.5rem' }}>
                                {templateData.roundInfo.matchups.map((match: any, matchIdx: number) => {
                                    const renderTeamBox = (
                                        teamId: string | null,
                                        teamName: string,
                                        squad: string | undefined | null,
                                        lanes: string,
                                        points: number | null,
                                        isA: boolean
                                    ) => {
                                        const scores = match.individualScores?.filter((s: any) => s.teamId === teamId && s.teamSquad === squad) || [];
                                        const oppId = isA ? match.teamBId : match.teamAId;
                                        const oppSquad = isA ? match.teamBSquad : match.teamASquad;
                                        const oppScores = match.individualScores?.filter((s: any) => s.teamId === oppId && s.teamSquad === oppSquad) || [];

                                        const rawHandiSum = scores.reduce((sum: number, s: any) => sum + (s.handicap || 0), 0);
                                        const oppRawHandiSum = oppScores.reduce((sum: number, s: any) => sum + (s.handicap || 0), 0);

                                        const hLimit = teamHandicapLimit !== undefined && teamHandicapLimit !== null ? Number(teamHandicapLimit) : null;
                                        const handiSum = (hLimit !== null && rawHandiSum > hLimit) ? hLimit : rawHandiSum;
                                        const oppHandiSum = (hLimit !== null && oppRawHandiSum > hLimit) ? hLimit : oppRawHandiSum;

                                        const excessH = Math.max(0, rawHandiSum - handiSum);
                                        const oppExcessH = Math.max(0, oppRawHandiSum - oppHandiSum);

                                        const g1 = scores.reduce((sum: number, s: any) => sum + Math.min((s.score1 || 0) + (s.handicap || 0), 300), 0) - excessH;
                                        const g2 = scores.reduce((sum: number, s: any) => sum + Math.min((s.score2 || 0) + (s.handicap || 0), 300), 0) - excessH;
                                        const g3 = scores.reduce((sum: number, s: any) => sum + Math.min((s.score3 || 0) + (s.handicap || 0), 300), 0) - excessH;

                                        const oppG1 = oppScores.reduce((sum: number, s: any) => sum + Math.min((s.score1 || 0) + (s.handicap || 0), 300), 0) - oppExcessH;
                                        const oppG2 = oppScores.reduce((sum: number, s: any) => sum + Math.min((s.score2 || 0) + (s.handicap || 0), 300), 0) - oppExcessH;
                                        const oppG3 = oppScores.reduce((sum: number, s: any) => sum + Math.min((s.score3 || 0) + (s.handicap || 0), 300), 0) - oppExcessH;

                                        const total = g1 + g2 + g3;
                                        const oppTotal = oppG1 + oppG2 + oppG3;

                                        const draws = points !== null && (points % 1) === 0.5 ? 1 : 0;
                                        const isWinner = points !== null && points >= 3;

                                        const getHiLow = (sList: any[], gameNum: number) => {
                                            const gs = sList.map(s => s[`score${gameNum}`] || 0);
                                            if (gs.length === 0) return 0;
                                            return Math.max(...gs) - Math.min(...gs);
                                        };

                                        const getMarker = (valA: number, valB: number, hA: number, hB: number, hlA: number, hlB: number) => {
                                            if (valA > valB) return 'O';
                                            if (valA < valB) return 'X';
                                            if (hA < hB) return 'O';
                                            if (hB < hA) return 'X';
                                            if (hlA < hlB) return 'O';
                                            if (hlB < hlA) return 'X';
                                            return draws > 0 && valA === valB ? '△' : '-';
                                        };

                                        const markers = [
                                            getMarker(g1, oppG1, handiSum, oppHandiSum, getHiLow(scores, 1), getHiLow(oppScores, 1)),
                                            getMarker(g2, oppG2, handiSum, oppHandiSum, getHiLow(scores, 2), getHiLow(oppScores, 2)),
                                            getMarker(g3, oppG3, handiSum, oppHandiSum, getHiLow(scores, 3), getHiLow(oppScores, 3))
                                        ];

                                        const getSeriesTotalRaw = (sList: any[], gameNum: number) => {
                                            return sList.reduce((sum, s) => sum + (s[`score${gameNum}`] || 0), 0);
                                        };

                                        const getSeriesHiLow = (sList: any[]) => {
                                            if (sList.length === 0) return 0;
                                            const rg1 = getSeriesTotalRaw(sList, 1);
                                            const rg2 = getSeriesTotalRaw(sList, 2);
                                            const rg3 = getSeriesTotalRaw(sList, 3);
                                            return Math.max(rg1, rg2, rg3) - Math.min(rg1, rg2, rg3);
                                        };

                                        const totalMark = getMarker(
                                            total,
                                            oppTotal,
                                            handiSum,
                                            oppHandiSum,
                                            getSeriesHiLow(scores),
                                            getSeriesHiLow(oppScores)
                                        );

                                        const baseCell: React.CSSProperties = {
                                            border: '1px solid #000000',
                                            padding: '8px 4px',
                                            textAlign: 'center',
                                            verticalAlign: 'middle',
                                        };

                                        const winStyle: React.CSSProperties = {
                                            color: '#e11d48',
                                            fontWeight: 900
                                        };

                                        return (
                                            <div key={isA ? 'A' : 'B'} style={{ border: '3px solid #000000', backgroundColor: '#ffffff', display: 'flex', flexDirection: 'column' }}>
                                                <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 100px', borderBottom: '3px solid #000000', fontWeight: 900, height: '40px' }}>
                                                    <div style={{ backgroundColor: '#18181b', color: '#ffffff', textAlign: 'center', lineHeight: '40px', borderRight: '2px solid #000000' }}>{lanes.padStart(2, '0')}레인</div>
                                                    <div style={{ textAlign: 'center', lineHeight: '40px', fontSize: '16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 8px' }}>
                                                        {teamName}{squad ? ` (${squad})` : ''}
                                                    </div>
                                                    <div style={{ backgroundColor: '#f3f4f6', textAlign: 'center', lineHeight: '40px', borderLeft: '2px solid #000000', color: isWinner ? '#e11d48' : '#000000' }}>
                                                        {points !== null ? `${Math.floor(points)}승${(points % 1) === 0.5 ? '1무' : ''}${4 - Math.ceil(points)}패` : '-'}
                                                    </div>
                                                </div>
                                                <table style={{ ...tableStyle, marginBottom: 0, border: 'none', fontSize: '13px' }}>
                                                    <thead>
                                                        <tr style={{ backgroundColor: '#e5e7eb', borderBottom: '2px solid #000000', fontWeight: 900 }}>
                                                            <th style={{ ...baseCell, width: '120px' }}>이름</th>
                                                            <th style={{ ...baseCell, width: '50px' }}>핸디</th>
                                                            <th style={{ ...baseCell, width: '60px' }}>1G</th>
                                                            <th style={{ ...baseCell, width: '60px' }}>2G</th>
                                                            <th style={{ ...baseCell, width: '60px' }}>3G</th>
                                                            <th style={{ ...baseCell, fontStyle: 'italic' }}>합계</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody style={{ fontWeight: 800 }}>
                                                        {[0, 1, 2].map(pIdx => {
                                                            const s = scores[pIdx];
                                                            return (
                                                                <tr key={pIdx} style={{ borderBottom: '1px solid #000000', height: '36px' }}>
                                                                    <td style={{ ...baseCell, textAlign: 'left', paddingLeft: '10px' }}>{s?.playerName || s?.User?.name || ""}</td>
                                                                    <td style={{ ...baseCell, color: '#9ca3af', fontWeight: 400 }}>{s?.handicap || ""}</td>
                                                                    <td style={{ ...baseCell }}>{s ? Math.min(s.score1 + s.handicap, 300) : ""}</td>
                                                                    <td style={{ ...baseCell }}>{s ? Math.min(s.score2 + s.handicap, 300) : ""}</td>
                                                                    <td style={{ ...baseCell }}>{s ? Math.min(s.score3 + s.handicap, 300) : ""}</td>
                                                                    <td style={{ ...baseCell, backgroundColor: '#f9fafb', fontWeight: 400 }}>{s ? Math.min(s.score1 + s.handicap, 300) + Math.min(s.score2 + s.handicap, 300) + Math.min(s.score3 + s.handicap, 300) : ""}</td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                    <tfoot style={{ fontWeight: 900, borderTop: '2px solid #000000' }}>
                                                        <tr style={{ height: '36px', backgroundColor: '#d9ead3' }}>
                                                            <td style={{ ...baseCell }}>종합</td>
                                                            <td style={{ ...baseCell, fontWeight: 400 }}>{handiSum || 0}</td>
                                                            <td style={{ ...baseCell, ...(markers[0] === 'O' ? winStyle : {}) }}>{g1}</td>
                                                            <td style={{ ...baseCell, ...(markers[1] === 'O' ? winStyle : {}) }}>{g2}</td>
                                                            <td style={{ ...baseCell, ...(markers[2] === 'O' ? winStyle : {}) }}>{g3}</td>
                                                            <td style={{ ...baseCell, backgroundColor: 'rgba(226, 232, 240, 0.5)', ...(isWinner ? winStyle : { fontWeight: 900 }) }}>{g1 + g2 + g3}</td>
                                                        </tr>
                                                        <tr style={{ height: '40px' }}>
                                                            <td style={{ ...baseCell }}>승패</td>
                                                            <td style={{ ...baseCell }}></td>
                                                            <td style={{ ...baseCell, fontSize: '18px', ...(markers[0] === 'O' ? winStyle : {}) }}>{markers[0]}</td>
                                                            <td style={{ ...baseCell, fontSize: '18px', ...(markers[1] === 'O' ? winStyle : {}) }}>{markers[1]}</td>
                                                            <td style={{ ...baseCell, fontSize: '18px', ...(markers[2] === 'O' ? winStyle : {}) }}>{markers[2]}</td>
                                                            <td style={{ ...baseCell, fontSize: '18px', fontStyle: 'italic', backgroundColor: '#f1f5f9', ...(isWinner ? winStyle : {}) }}>{totalMark}</td>
                                                        </tr>
                                                    </tfoot>
                                                </table>
                                            </div>
                                        );
                                    };

                                    return (
                                        <React.Fragment key={matchIdx}>
                                            {renderTeamBox(match.teamAId, match.teamA?.name || "부전승", match.teamASquad, match.lanes?.split('-')[0] || "1", match.pointsA, true)}
                                            {renderTeamBox(match.teamBId, match.teamB?.name || "부전승", match.teamBSquad, match.lanes?.split('-')[1] || "2", match.pointsB, false)}
                                        </React.Fragment>
                                    );
                                })}
                            </div>
                        </div>

                        {/* 4. Individual TOP 30 Averagist */}
                        <div ref={top30Ref} style={containerStyle}>
                            <div style={{ display: 'flex', justifyContent: 'center' }}>
                                <div style={headerBoxStyle}>
                                    {tournamentName} 개인 평균 TOP 30
                                </div>
                            </div>

                            <table style={{ ...tableStyle, width: '800px', margin: '0 auto' }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#18181b', color: '#ffffff', borderBottom: '3px solid #000000', height: '60px', fontSize: '18px' }}>
                                        <th style={{ ...thStyle, backgroundColor: 'transparent', border: 'none', width: '100px' }}>순위</th>
                                        <th style={{ ...thStyle, backgroundColor: 'transparent', border: 'none' }}>선수명</th>
                                        <th style={{ ...thStyle, backgroundColor: 'transparent', border: 'none' }}>팀명</th>
                                        <th style={{ ...thStyle, backgroundColor: 'transparent', border: 'none', width: '160px' }}>에버리지</th>
                                    </tr>
                                </thead>
                                <tbody style={{ fontWeight: 800 }}>
                                    {templateData.individual.top30.map((p: any, idx: number) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid #000000', height: '55px' }}>
                                            <td style={{ ...rankStyle, borderBottom: 'none', fontSize: '18px' }}>{idx + 1}</td>
                                            <td style={{ ...tdStyle, fontWeight: 900, textAlign: 'center', fontSize: '20px', borderBottom: 'none' }}>{p.name}</td>
                                            <td style={{ ...tdStyle, color: '#4b5563', fontSize: '18px', borderBottom: 'none' }}>{p.teamName}</td>
                                            <td style={{ ...tdStyle, color: '#2563eb', fontSize: '26px', fontWeight: 900, fontStyle: 'italic', borderBottom: 'none' }}>{(p.totalHandicappedPins / (p.gamesCount || 1)).toFixed(2)}</td>
                                        </tr>
                                    ))}
                                    {Array.from({ length: Math.max(0, 30 - templateData.individual.top30.length) }).map((_, i) => (
                                        <tr key={i} style={{ height: '45px', borderBottom: '1px solid #e5e7eb', opacity: 0.2 }}>
                                            <td colSpan={4}>&nbsp;</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div style={{ width: '800px', margin: '1rem auto 0', textAlign: 'right', fontSize: '14px', fontWeight: 800, color: '#dc2626', lineHeight: 1.6, fontStyle: 'italic' }}>
                                {noticeLines.map((line, i) => (
                                    <p key={i}>{line.startsWith('*') ? line : `* ${line}`}</p>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}
