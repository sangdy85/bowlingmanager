'use client';

import React from 'react';

interface RoundResultData {
    roundNumber: number;
    tournamentType: string;
    gameCount: number;
    results: {
        id: string;
        name: string;
        team: string;
        lane: number | null;
        handicap: number;
        gameScores: Record<number, number>;
        total: number;
        playedG: number;
        isFemaleChamp?: boolean; // Added for manager view style
    }[];
}

export default function RoundResultLeaderboard({ data, title }: { data: RoundResultData, title: string }) {
    const { results, gameCount, roundNumber } = data;

    // Split logic matching manager view (27 rows per side)
    const leftColumn = results.slice(0, 27);
    const rightColumn = results.slice(27, 54);

    const TableComponent = ({ columnResults, startRank, isRight }: { columnResults: any[], startRank: number, isRight?: boolean }) => (
        <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            border: '1px solid black',
            fontSize: '11px',
            color: 'black',
            backgroundColor: 'white',
            borderLeft: isRight ? 'none' : '1px solid black',
            tableLayout: 'fixed'
        }}>
            <thead>
                <tr style={{ backgroundColor: '#E7E9EB', height: '32px' }}>
                    <th style={{ border: '1px solid black', padding: '4px', width: '35px' }}>순위</th>
                    <th style={{ border: '1px solid black', padding: '4px' }}>팀</th>
                    <th style={{ border: '1px solid black', padding: '4px', width: '70px' }}>성함</th>
                    {Array.from({ length: gameCount }).map((_, i) => (
                        <th key={i} style={{ border: '1px solid black', padding: '4px', width: '40px' }}>{i + 1}G</th>
                    ))}
                    <th style={{ border: '1px solid black', padding: '4px', width: '40px' }}>핸디</th>
                    <th style={{ border: '1px solid black', padding: '4px', width: '50px' }}>총점</th>
                </tr>
            </thead>
            <tbody>
                {Array.from({ length: 27 }).map((_, idx) => {
                    const res = columnResults[idx];
                    const rank = startRank + idx;
                    const isTop3 = rank <= 3;
                    const isFemaleChamp = res?.isFemaleChamp || false;
                    const shouldHighlight = res && (isTop3 || isFemaleChamp);

                    if (!res) {
                        return (
                            <tr key={`empty-${rank}`} style={{ height: '26px' }}>
                                <td style={{ border: '1px solid black', textAlign: 'center' }}>&nbsp;{rank}</td>
                                <td style={{ border: '1px solid black' }}>&nbsp;</td>
                                <td style={{ border: '1px solid black' }}>&nbsp;</td>
                                {Array.from({ length: gameCount }).map((_, i) => (
                                    <td key={i} style={{ border: '1px solid black' }}>&nbsp;</td>
                                ))}
                                <td style={{ border: '1px solid black' }}>&nbsp;</td>
                                <td style={{ border: '1px solid black' }}>&nbsp;</td>
                            </tr>
                        );
                    }

                    return (
                        <tr key={res.id} style={{ height: '26px', backgroundColor: shouldHighlight ? '#FFFF00' : 'white' }}>
                            <td style={{ border: '1px solid black', textAlign: 'center', fontWeight: 'bold' }}>{rank}</td>
                            <td style={{ border: '1px solid black', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', padding: '0 2px' }}>{res.team}</td>
                            <td style={{
                                border: '1px solid black',
                                textAlign: 'center',
                                fontWeight: 'bold',
                                padding: '0 4px'
                            }}>
                                {res.name}
                                {isFemaleChamp && <span style={{ color: '#E91E63', fontSize: '9px', marginLeft: '2px' }}>(여챔)</span>}
                            </td>
                            {Array.from({ length: gameCount }, (_, i) => i + 1).map(g => (
                                <td key={g} style={{ border: '1px solid black', textAlign: 'center' }}>
                                    {res.gameScores[g] > 0 ? res.gameScores[g] + res.handicap : ''}
                                </td>
                            ))}
                            <td style={{ border: '1px solid black', textAlign: 'center' }}>{res.handicap * res.playedG}</td>
                            <td style={{ border: '1px solid black', textAlign: 'center', fontWeight: '900' }}>
                                {res.total}
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );

    return (
        <div style={{ backgroundColor: 'white', padding: '0', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', border: '2px solid black' }}>
            <div style={{ width: '100%', padding: '0 0 20px 0' }}>
                <div style={{ backgroundColor: '#FFFF00', border: '1px solid black', borderBottomWidth: '2px', padding: '12px 20px', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <h2 style={{ textAlign: 'center', fontSize: '20px', fontWeight: '900', color: 'black', margin: '0' }}>
                        {title} {roundNumber}회차 결과
                    </h2>
                </div>

                <div className="flex flex-col md:flex-row w-full overflow-x-auto">
                    <div style={{ flex: 1, minWidth: '450px' }}>
                        <TableComponent columnResults={leftColumn} startRank={1} />
                    </div>
                    <div style={{ flex: 1, minWidth: '450px' }}>
                        <TableComponent columnResults={rightColumn} startRank={28} isRight={true} />
                    </div>
                </div>
            </div>
        </div>
    );
}
