'use client';

import { useState } from 'react';
import { updateGrandFinaleSettings } from '@/app/actions/tournament-center';

interface GrandFinalePointSettingsProps {
    tournamentId: string;
    initialPoints: Record<string, number>;
}

export default function GrandFinalePointSettings({ tournamentId, initialPoints }: GrandFinalePointSettingsProps) {
    const [points, setPoints] = useState<Record<string, string>>(() => {
        const p: Record<string, string> = {};
        for (let i = 1; i <= 54; i++) {
            p[i.toString()] = initialPoints[i.toString()]?.toString() || '';
        }
        p['female'] = initialPoints['female']?.toString() || '';
        return p;
    });
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const numericPoints: Record<string, number> = {};
            Object.entries(points).forEach(([k, v]) => {
                const val = parseInt(v);
                if (!isNaN(val)) numericPoints[k] = val;
            });

            const res = await updateGrandFinaleSettings(tournamentId, { grandFinalePoints: numericPoints });
            if (res.success) {
                alert('포인트 설정이 저장되었습니다.');
            }
        } catch (e: any) {
            alert('저장 실패: ' + e.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
            {/* Sticky Header */}
            <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-slate-100 p-6 md:p-8 flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="space-y-1">
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <span className="p-2 bg-primary/10 rounded-xl text-xl">⚙️</span>
                        회차별 포인트 룰 설정
                    </h3>
                    <p className="text-sm font-bold text-slate-400 italic">각 대회의 최종 순위에 따른 지급 포인트를 설정합니다.</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="group relative btn btn-primary h-14 px-10 font-black shadow-lg hover:shadow-primary/20 transition-all border-2 border-black/5 rounded-2xl overflow-hidden"
                >
                    <span className="relative z-10 flex items-center gap-2">
                        {isSaving ? (
                            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        ) : (
                            <span className="text-lg">💾</span>
                        )}
                        {isSaving ? '저장 중...' : '설정 저장하기'}
                    </span>
                </button>
            </div>

            <div className="p-6 md:p-10">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                    {/* Female Champ Special Rank */}
                    <div className="relative group flex flex-col gap-3 p-5 rounded-3xl bg-pink-50/50 border-2 border-pink-200/50 shadow-sm hover:shadow-md hover:border-pink-300 transition-all">
                        <div className="absolute -top-3 left-4 px-3 py-1 bg-pink-500 text-[10px] font-black text-white rounded-full uppercase tracking-widest shadow-sm">
                            SPECIAL
                        </div>
                        <label className="text-sm font-black text-pink-600 uppercase pt-2">여성 챔프</label>
                        <div className="relative">
                            <input
                                type="number"
                                value={points['female']}
                                onChange={(e) => setPoints(prev => ({ ...prev, female: e.target.value }))}
                                className="w-full h-12 bg-white border-2 border-pink-200 rounded-xl px-4 text-center font-black text-pink-600 text-lg outline-none focus:border-pink-500 focus:ring-4 focus:ring-pink-500/10 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                placeholder="0"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-pink-300 uppercase">pts</span>
                        </div>
                    </div>

                    {/* Standard Ranks 1-54 */}
                    {Array.from({ length: 54 }, (_, i) => i + 1).map(rank => (
                        <div
                            key={rank}
                            className="flex flex-col gap-3 p-5 rounded-3xl bg-slate-50 border border-slate-100 hover:border-slate-300 hover:shadow-sm transition-all group"
                        >
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                                RANK {rank}
                            </label>
                            <div className="relative">
                                <input
                                    type="number"
                                    value={points[rank.toString()]}
                                    onChange={(e) => setPoints(prev => ({ ...prev, [rank.toString()]: e.target.value }))}
                                    className="w-full h-12 bg-white border-2 border-slate-200 rounded-xl px-4 text-center font-black text-slate-900 group-hover:border-slate-400 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    placeholder="0"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-300 uppercase italic">pt</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
