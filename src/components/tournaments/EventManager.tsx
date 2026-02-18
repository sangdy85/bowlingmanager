'use client';

import Link from 'next/link';
import { useState } from 'react';
import { updateTournamentBasicInfo } from '@/app/actions/tournament-center';

interface EventManagerProps {
    tournament: any;
    centerId: string;
    isManager: boolean;
}

export default function EventManager({ tournament, centerId, isManager }: EventManagerProps) {
    const [showEditModal, setShowEditModal] = useState(false);
    const [loading, setLoading] = useState(false);

    if (!tournament.leagueRounds || tournament.leagueRounds.length === 0) {
        return <div className="p-4 border rounded">생성된 이벤트가 없습니다.</div>;
    }

    // Single Round for Event Match
    const round = tournament.leagueRounds[0];
    let settings: any = {};
    try {
        if (tournament.settings) settings = JSON.parse(tournament.settings);
    } catch (e) {
        console.error("Failed to parse settings in EventManager", e);
    }

    const menuItems = [
        {
            label: '대회 설정',
            href: `/centers/${centerId}/tournaments/${tournament.id}/rounds/${round.id}?tab=settings`,
            icon: '⚙️',
            desc: '레인 이동 설정 등을 관리합니다.',
            color: 'bg-slate-700'
        },
        {
            label: '참가자 관리',
            href: `/centers/${centerId}/tournaments/${tournament.id}/rounds/${round.id}?tab=participants`,
            icon: '👥',
            desc: '참가자 명단을 확인하고 관리합니다.',
            color: 'bg-blue-600'
        },
        {
            label: '레인 배정',
            href: `/centers/${centerId}/tournaments/${tournament.id}/rounds/${round.id}?tab=lanes`,
            icon: 'Bowling',
            desc: '참가자들의 레인을 배정합니다.',
            color: 'bg-indigo-600'
        },
        {
            label: '점수 입력/집계',
            href: `/centers/${centerId}/tournaments/${tournament.id}/rounds/${round.id}?tab=scoring`,
            icon: '📝',
            desc: '경기 점수를 입력하고 순위를 확인합니다.',
            color: 'bg-green-600'
        },
        {
            label: '사이드 게임',
            href: `/centers/${centerId}/tournaments/${tournament.id}/rounds/${round.id}?tab=sideGame`,
            icon: '🎯',
            desc: '사이드 게임(나인핀 등) 결과를 관리합니다.',
            color: 'bg-amber-600'
        },
        {
            label: '행운권 추첨',
            href: `/centers/${centerId}/tournaments/${tournament.id}/rounds/${round.id}?tab=luckyDraw`,
            icon: '🍀',
            desc: '참가자를 대상으로 행운권을 추첨합니다.',
            color: 'bg-pink-600'
        },
    ];

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        const formData = new FormData(e.currentTarget);
        try {
            await updateTournamentBasicInfo(tournament.id, formData);
            alert("대회 정보가 수정되었습니다.");
            setShowEditModal(false);
        } catch (error: any) {
            alert(error.message);
        } finally {
            setLoading(false);
        }
    };

    const formatDateForInput = (dateString: string) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-slate-800 p-6 rounded-2xl shadow-lg border-b-4 border-primary">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center text-2xl">
                        📊
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-white">이벤트 대회 관리 대시보드</h3>
                        <p className="text-slate-400 text-sm font-bold">대회의 모든 운영 요소를 이곳에서 제어할 수 있습니다.</p>
                    </div>
                </div>
                <button
                    onClick={() => setShowEditModal(true)}
                    className="px-6 py-3 bg-white hover:bg-slate-100 text-slate-900 font-black rounded-xl text-sm transition-all shadow-md active:scale-95"
                >
                    🔧 대회 정보 수정
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {menuItems.map((item) => (
                    <Link
                        key={item.href}
                        href={item.href}
                        className="group relative overflow-hidden rounded-2xl border-2 border-slate-100 bg-white p-8 hover:border-primary/30 hover:shadow-2xl transition-all duration-300"
                    >
                        <div className={`absolute -top-4 -right-4 p-8 opacity-5 group-hover:opacity-10 transition-opacity`}>
                            <span className="text-8xl">{item.icon === 'Bowling' ? '🎳' : item.icon}</span>
                        </div>
                        <div className="relative z-10">
                            <div className={`w-14 h-14 rounded-2xl ${item.color} flex items-center justify-center text-white text-3xl mb-6 shadow-lg group-hover:scale-110 transition-transform`}>
                                {item.icon === 'Bowling' ? '🎳' : item.icon}
                            </div>
                            <h4 className="font-black text-xl mb-2 group-hover:text-primary transition-colors">{item.label}</h4>
                            <p className="text-sm text-slate-500 font-bold leading-relaxed">{item.desc}</p>
                        </div>
                    </Link>
                ))}
            </div>

            {/* Edit Modal */}
            {showEditModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-white/20">
                        <div className="p-8">
                            <div className="flex justify-between items-center mb-8 pb-4 border-b border-gray-100">
                                <h3 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                                    <span className="p-2 bg-slate-100 rounded-lg">🔨</span> 대회 기본 정보 수정
                                </h3>
                                <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                                    <span className="text-3xl">&times;</span>
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest block ml-1">진행 모드</label>
                                    <select name="gameMode" defaultValue={settings.gameMode} className="input h-14 bg-gray-50 border-gray-200 focus:bg-white transition-all text-sm font-bold">
                                        <option value="INDIVIDUAL">개인전</option>
                                        <option value="TEAM_2">2인조 전</option>
                                        <option value="TEAM_3">3인조 전</option>
                                        <option value="TEAM_4">4인조 전</option>
                                        <option value="TEAM_5">5인조 전</option>
                                        <option value="TEAM_6">6인조 전</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest block ml-1">대회 명칭</label>
                                    <input name="name" type="text" defaultValue={tournament.name} className="input h-14 bg-gray-50 border-gray-200 focus:bg-white transition-all text-sm font-bold" required />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest block ml-1">대회 시작 일시</label>
                                        <input name="startDate" type="datetime-local" defaultValue={formatDateForInput(tournament.startDate)} className="input h-14 bg-gray-50 border-gray-200 focus:bg-white transition-all text-sm font-bold" required />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest block ml-1">접수 시작 일시</label>
                                        <input name="registrationStart" type="datetime-local" defaultValue={formatDateForInput(settings.registrationStart)} className="input h-14 bg-gray-50 border-gray-200 focus:bg-white transition-all text-sm font-bold" required />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest block ml-1">경기 방식 (게임 수)</label>
                                        <select name="gameCount" defaultValue={settings.gameCount} className="input h-14 bg-gray-50 border-gray-200 focus:bg-white transition-all text-sm font-bold">
                                            {[1, 2, 3, 4, 5].map(n => (
                                                <option key={n} value={n}>{n}게임</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest block ml-1">참가 정원 (명)</label>
                                        <input name="maxParticipants" type="number" defaultValue={tournament.maxParticipants} className="input h-14 bg-gray-50 border-gray-200 focus:bg-white transition-all text-sm font-bold" required />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest block ml-1">참가 대상</label>
                                        <input name="target" type="text" defaultValue={settings.target} className="input h-14 bg-gray-50 border-gray-200 focus:bg-white transition-all text-sm font-bold" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest block ml-1">참가비</label>
                                        <input name="entryFeeText" type="text" defaultValue={settings.entryFeeText} className="input h-14 bg-gray-50 border-gray-200 focus:bg-white transition-all text-sm font-bold" />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest block ml-1">입금 계좌</label>
                                    <input name="bankAccount" type="text" defaultValue={settings.bankAccount} className="input h-14 bg-gray-50 border-gray-200 focus:bg-white transition-all text-sm font-bold" />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest block ml-1">핸디 적용 안내</label>
                                        <input name="handicapInfo" type="text" defaultValue={settings.handicapInfo} className="input h-14 bg-gray-50 border-gray-200 focus:bg-white transition-all text-sm font-bold" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest block ml-1">대회 패턴 (정비)</label>
                                        <input name="pattern" type="text" defaultValue={settings.pattern} className="input h-14 bg-gray-50 border-gray-200 focus:bg-white transition-all text-sm font-bold" />
                                    </div>
                                </div>

                                <div className="flex gap-4 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowEditModal(false)}
                                        className="flex-1 h-14 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black rounded-2xl transition-all active:scale-95"
                                    >
                                        취소
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="flex-1 h-14 bg-primary hover:bg-primary/90 text-white font-black rounded-2xl transition-all shadow-lg shadow-primary/30 active:scale-95 disabled:opacity-50 disabled:active:scale-100"
                                    >
                                        {loading ? "저장 중..." : "수정 완료"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
