'use client';

import { useState, useTransition } from 'react';
import LeagueScheduleExport from "./LeagueScheduleExport";
import RoundDateEditor from "./RoundDateEditor";
import { updateLeagueMatchup } from "@/app/actions/league-actions";
import { useRouter } from "next/navigation";

interface Participant {
    id: string;
    teamId?: string | null;
    guestName?: string | null;
    guestTeamName?: string | null;
    team?: { name: string } | null;
    user?: { name: string } | null;
}

interface Matchup {
    id: string;
    lanes: string;
    teamA: { id: string; name: string } | null;
    teamAId?: string | null;
    teamASquad?: string | null;
    teamB: { id: string; name: string } | null;
    teamBId?: string | null;
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
    participants?: Participant[];
}

export default function LeagueScheduleView({
    tournamentName,
    leagueRounds,
    isManager,
    participants = []
}: LeagueScheduleViewProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    const lanePairs = Array.from(new Set(leagueRounds.flatMap(r => r.matchups.map(m => m.lanes))))
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

    const handleUpdateMatchup = async (matchupId: string, field: string, value: string) => {
        startTransition(async () => {
            try {
                const updateData: any = {};
                if (field === 'teamA') updateData.teamAId = value || null;
                else if (field === 'teamB') updateData.teamBId = value || null;
                else if (field === 'squadA') updateData.teamASquad = value || null;
                else if (field === 'squadB') updateData.teamBSquad = value || null;

                await updateLeagueMatchup(matchupId, updateData);
                router.refresh();
            } catch (error) {
                console.error("Failed to update matchup:", error);
                alert("업데이트에 실패했습니다.");
            }
        });
    };

    const getParticipantDisplayName = (p: Participant) => {
        return p.guestTeamName || p.team?.name || p.guestName || p.user?.name || "알 수 없음";
    };

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
                    {isManager && (
                        <button
                            type="button"
                            onClick={() => setIsEditing(!isEditing)}
                            className={`btn text-xs h-9 px-4 font-bold border-2 border-black flex items-center gap-2 relative z-10 shadow-sm ${isEditing ? 'bg-red-500 text-white' : 'bg-white text-black'
                                }`}
                        >
                            {isEditing ? '✎ 수정 중...' : '✎ 대진표 편집'}
                        </button>
                    )}
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
                                        <th key={lane} className="font-bold w-[110px] text-center"
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
                                                const [start, end] = m.lanes.split('-').map(Number);
                                                return lane === start || lane === end;
                                            });

                                            if (!match) return (
                                                <td key={lane} className="p-1.5 text-center"
                                                    style={{ borderRight: '2px solid black', borderBottom: '2px solid black', width: '110px' }}>-</td>
                                            );

                                            const [start] = match.lanes.split('-').map(Number);
                                            const isTeamA = lane === start;
                                            const currentTeamId = isTeamA ? match.teamAId : match.teamBId;
                                            const currentSquad = isTeamA ? match.teamASquad : match.teamBSquad;
                                            const currentTeamName = isTeamA ? match.teamA?.name : match.teamB?.name;

                                            return (
                                                <td key={lane} className="p-1.5 text-center align-middle font-bold"
                                                    style={{ borderRight: '2px solid black', borderBottom: '2px solid black', color: 'black', width: '110px' }}>
                                                    {isEditing ? (
                                                        <div className="flex flex-col gap-1">
                                                            <select
                                                                className="text-[10px] p-1 border border-black rounded bg-white w-full"
                                                                value={currentTeamId || ""}
                                                                onChange={(e) => handleUpdateMatchup(match.id, isTeamA ? 'teamA' : 'teamB', e.target.value)}
                                                                disabled={isPending}
                                                            >
                                                                <option value="">부전승</option>
                                                                {participants.map(p => (
                                                                    <option key={p.id} value={p.teamId || ""}>
                                                                        {getParticipantDisplayName(p)}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                            <input
                                                                type="text"
                                                                placeholder="Squad(A/B)"
                                                                className="text-[10px] p-1 border border-black rounded w-full"
                                                                defaultValue={currentSquad || ""}
                                                                onBlur={(e) => {
                                                                    if (e.target.value !== (currentSquad || "")) {
                                                                        handleUpdateMatchup(match.id, isTeamA ? 'squadA' : 'squadB', e.target.value);
                                                                    }
                                                                }}
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div className="truncate">
                                                            {currentTeamName ? (currentSquad ? `${currentTeamName} (${currentSquad})` : currentTeamName) : "-"}
                                                        </div>
                                                    )}
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
