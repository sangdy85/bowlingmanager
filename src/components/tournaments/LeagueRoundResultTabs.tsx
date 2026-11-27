'use client';

import { useState } from 'react';
import RoundResultSummary from './RoundResultSummary';
import SideGameManager from './SideGameManager';
import RoundBulkResultEditor from './RoundBulkResultEditor';

interface LeagueRoundResultTabsProps {
    round: any;
    tournamentName: string;
    teamHandicapLimit: number | null;
    isManager?: boolean;
    centerId: string;
    tournamentId: string;
}

export default function LeagueRoundResultTabs({
    round,
    tournamentName,
    teamHandicapLimit,
    isManager = false,
    centerId,
    tournamentId
}: LeagueRoundResultTabsProps) {
    const [activeTab, setActiveTab] = useState<'results' | 'scoring' | 'sideGame'>(isManager ? 'scoring' : 'results');

    return (
        <div className="space-y-6">
            <div className="flex border-b bg-white rounded-t-xl overflow-hidden shadow-sm">
                <button
                    onClick={() => setActiveTab('results')}
                    className={`flex-1 py-4 text-center font-black transition-all ${activeTab === 'results'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-500 hover:bg-gray-50'
                        }`}
                >
                    🎳 경기 결과
                </button>
                {isManager && (
                    <button
                        onClick={() => setActiveTab('scoring')}
                        className={`flex-1 py-4 text-center font-black transition-all ${activeTab === 'scoring'
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-gray-500 hover:bg-gray-50'
                            }`}
                    >
                        📝 점수 입력
                    </button>
                )}
                <button
                    onClick={() => setActiveTab('sideGame')}
                    className={`flex-1 py-4 text-center font-black transition-all ${activeTab === 'sideGame'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-500 hover:bg-gray-50'
                        }`}
                >
                    💰 사이드게임
                </button>
            </div>

            <div className="bg-white rounded-b-xl shadow-xl overflow-hidden min-h-[500px]">
                {activeTab === 'results' ? (
                    <RoundResultSummary
                        round={round}
                        tournamentName={tournamentName}
                        teamHandicapLimit={teamHandicapLimit}
                    />
                ) : activeTab === 'scoring' ? (
                    <div className="p-4 md:p-8">
                        <RoundBulkResultEditor
                            centerId={centerId}
                            tournamentId={tournamentId}
                            round={round}
                            teamHandicapLimit={teamHandicapLimit}
                        />
                    </div>
                ) : (
                    <div className="p-4 md:p-8 bg-slate-100/50">
                        <SideGameManager
                            matchups={round.matchups}
                            participants={round.participants}
                            allIndividualScores={round.matchups.flatMap((m: any) => m.individualScores)}
                            roundId={round.id}
                            isManager={isManager}
                            tournamentType="LEAGUE"
                            gameCount={3}
                            tournamentRegistrations={round.tournamentRegistrations}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
