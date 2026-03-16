'use client';

import { useState } from 'react';
import LeagueScheduleExport from "./LeagueScheduleExport";
import RoundDateEditor from "./RoundDateEditor";

interface Participant {
    id: string;
    name: string;
}

interface Matchup {
    id: string;
    lanes: string;
    teamA: Participant | null;
    teamASquad?: string | null;
    teamB: Participant | null;
    teamBSquad?: string | null;
}

interface LeagueRound {
    id: string;
    roundNumber: number;
    date: Date | null;
    matchups: Matchup[];
}

interface LeagueScheduleViewProps {
    tournamentName: string;
    leagueRounds: LeagueRound[];
    isManager: boolean;
}

export default function LeagueScheduleView({
    tournamentName,
    leagueRounds,
    isManager
}: LeagueScheduleViewProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    const lanePairs = Array.from(new Set(leagueRounds.flatMap(r => r.matchups.map(m => m.lanes).filter((l): l is string => !!l))))
        .sort((a, b) => {
            const aNum = parseInt(a.split('-')[0]);
            const bNum = parseInt(b.split('-')[0]);
            return aNum - bNum;
        });

    const individualLanes: number[] = [];
    lanePairs.forEach(pair => {
        const [start, end] = pair.split('-').map(Number);
        individualLanes.push(start, end);
    });

    return (
        <section className="card p-0 overflow-hidden shadow-2xl border-2 border-black">
            <div className="p-4 bg-secondary/5 border-b-2 border-black flex flex-wrap justify-between items-center gap-4">
                <div className="flex-1">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        🗓️ 리그 공식 일자별 대진표
                    </h2>
                    <p className="text-[10px] text-secondary-foreground mt-0.5 font-medium">실제 경기 일정과 레인 배정표입니다.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="btn btn-primary text-xs h-9 px-4 font-bold border-2 border-black flex items-center gap-2 relative z-10 shadow-sm"
                    >
                        {isExpanded ? (
                            <><span>▲</span> 대진표 접기</>
                        ) : (
                            <><span>▼</span> 대진표 전체보기</>
                        )}
                    </button>
                    <LeagueScheduleExport
                        tournamentName={tournamentName}
                        leagueRounds={leagueRounds}
                    />
                </div>
            </div>

            {isExpanded && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="overflow-x-auto border-t-2 border-black">
                        <table className="w-full text-[11px] border-collapse min-w-max" style={{ backgroundColor: 'white', color: 'black' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#FFCC00' }}>
                                    <th className="sticky left-0 z-20 w-[100px] font-bold text-center"
                                        style={{ backgroundColor: '#FFCC00', borderBottom: '2px solid black', borderRight: '2px solid black', padding: '6px' }}>
                                        회차 / 일자
                                    </th>
                                    {individualLanes.map(lane => (
                                        <th key={lane} className="font-bold w-[90px] text-center"
                                            style={{ borderBottom: '2px solid black', borderRight: '2px solid black', padding: '6px' }}>
                                            {lane}레인
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {leagueRounds.map((round) => (
                                    <tr key={round.id}>
                                        <td className="sticky left-0 z-10 p-0 text-center align-middle"
                                            style={{ backgroundColor: 'white', borderRight: '2px solid black', borderBottom: '2px solid black', width: '100px' }}>
                                            <div className="py-1.5 font-bold" style={{ borderBottom: '2px solid black' }}>{round.roundNumber}주차</div>
                                            <RoundDateEditor
                                                roundId={round.id}
                                                initialDate={round.date}
                                                isManager={isManager}
                                            />
                                        </td>
                                        {individualLanes.map(lane => {
                                            const match = round.matchups.find(m => {
                                                if (!m.lanes) return false;
                                                const [start, end] = m.lanes.split('-').map(Number);
                                                return lane === start || lane === end;
                                            });

                                            if (!match) return (
                                                <td key={lane} className="p-1.5 text-center"
                                                    style={{ borderRight: '2px solid black', borderBottom: '2px solid black', width: '90px' }}>-</td>
                                            );

                                            const [start] = match.lanes?.split('-').map(Number) || [0];
                                            const team = lane === start ? match.teamA?.name : match.teamB?.name;
                                            const squad = lane === start ? match.teamASquad : match.teamBSquad;

                                            return (
                                                <td key={lane} className="p-1.5 text-center align-middle font-bold"
                                                    style={{ borderRight: '2px solid black', borderBottom: '2px solid black', color: 'black', width: '90px' }}>
                                                    {team ? (squad ? `${team} (${squad})` : team) : "-"}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </section>
    );
}
