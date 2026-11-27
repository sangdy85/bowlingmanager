'use client';

import { useState } from 'react';

interface GrandFinaleQualifiersStatusProps {
    rounds: any[];
    registrations: any[];
    qualifierIds: string[];
    onClose: () => void;
}

export default function GrandFinaleQualifiersStatus({ rounds, registrations, qualifierIds, onClose }: GrandFinaleQualifiersStatusProps) {
    // Map registration IDs to objects for easy lookup
    const registrationMap = registrations.reduce((acc: any, reg: any) => {
        acc[String(reg.id)] = reg;
        return acc;
    }, {});

    // For each qualifier ID, find which rounds they participated in
    // and group them by the "earliest" round or simply by participation 
    // In a typical scenario, we might want to know which round they "qualified" from.
    // Here we'll group by rounds to show who qualified from which round.

    const resultsByRound = rounds.map(round => {
        const roundParticipantIds = new Set(
            (round.participants || []).map((p: any) => String(p.registrationId))
        );

        // Add those who participated in this round AND are in qualifierIds
        const qualifiersInRound = qualifierIds.filter(id => roundParticipantIds.has(String(id)));

        return {
            roundNumber: round.roundNumber,
            qualifiers: qualifiersInRound.map(id => registrationMap[id]).filter(Boolean)
        };
    }).filter(r => r.qualifiers.length > 0);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200">
                <div className="bg-slate-900 px-8 py-6 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-black text-white flex items-center gap-2">
                            🏆 왕중왕전 진출자 현황
                        </h2>
                        <p className="text-slate-400 text-xs font-bold mt-1 uppercase tracking-wider">Grand Finale Qualifiers Status</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-all text-2xl font-light"
                    >
                        ×
                    </button>
                </div>

                <div className="p-8 max-h-[70vh] overflow-y-auto no-scrollbar">
                    {resultsByRound.length === 0 ? (
                        <div className="text-center py-20">
                            <div className="text-5xl mb-4">⌛</div>
                            <p className="text-slate-500 font-bold">아직 선발된 진출자가 없습니다.</p>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            {resultsByRound.map((roundData) => (
                                <div key={roundData.roundNumber} className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="h-[2px] flex-1 bg-slate-100"></div>
                                        <span className="px-4 py-1.5 bg-slate-100 rounded-full text-xs font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">
                                            ROUND {roundData.roundNumber} 명단
                                        </span>
                                        <div className="h-[2px] flex-1 bg-slate-100"></div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {roundData.qualifiers.map((reg: any) => (
                                            <div
                                                key={reg.id}
                                                className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200 hover:border-primary/30 transition-all group"
                                            >
                                                <div className="w-10 h-10 rounded-full bg-white border-2 border-slate-200 flex items-center justify-center font-black text-slate-400 group-hover:text-primary group-hover:border-primary/30 transition-colors">
                                                    {reg.user?.name?.[0] || reg.guestName?.[0] || '?'}
                                                </div>
                                                <div>
                                                    <div className="font-black text-slate-800 text-sm">
                                                        {reg.user?.name || reg.guestName || '익명'}
                                                    </div>
                                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                                                        {reg.team?.name || reg.guestTeamName || '개인'}
                                                    </div>
                                                </div>
                                                <div className="ml-auto">
                                                    <span className="text-[10px] font-black px-2 py-0.5 bg-blue-100 text-blue-600 rounded-md">QUALIFIED</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="bg-slate-50 p-6 border-t border-slate-100 flex justify-center">
                    <button
                        onClick={onClose}
                        className="px-10 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm shadow-xl shadow-slate-900/20 hover:scale-105 active:scale-95 transition-all"
                    >
                        닫기
                    </button>
                </div>
            </div>
        </div>
    );
}
