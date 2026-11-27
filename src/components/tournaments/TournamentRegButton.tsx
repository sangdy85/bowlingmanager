'use client';

import { registerForTournament, cancelRegistration } from "@/app/actions/tournament-reg";
import { useState } from "react";

interface RegButtonProps {
    tournament: any;
    isRegistered: boolean;
    canJoin: boolean;
}

interface TeamMember {
    name: string;
    teamName: string;
    handicap: number;
}

export default function TournamentRegButton({ tournament, isRegistered, canJoin }: RegButtonProps) {
    const tournamentId = tournament.id;
    const settings = tournament.settings ? JSON.parse(tournament.settings) : {};
    const gameMode = settings.gameMode || 'INDIVIDUAL';

    // Determine how many extra team members are needed
    const teamSize = gameMode.startsWith('TEAM_') ? (parseInt(gameMode.split('_')[1] || '1') || 1) : 1;
    const extraMemberCount = Math.max(0, teamSize - 1);

    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [handicap, setHandicap] = useState<number>(0);
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>(
        Array(extraMemberCount).fill({ name: '', teamName: '', handicap: 0 })
    );
    const [agreed, setAgreed] = useState(false);

    const handleRegister = async () => {
        if (!agreed) {
            alert("참가비 미입금 시 자동 취소 항목에 동의해 주세요.");
            return;
        }

        // Validate team members if any
        if (extraMemberCount > 0) {
            for (let i = 0; i < teamMembers.length; i++) {
                if (!teamMembers[i].name.trim()) {
                    alert(`팀원 ${i + 1}의 이름을 입력해 주세요.`);
                    return;
                }
            }
        }

        setLoading(true);
        try {
            const participants = [
                { handicap, isMe: true }, // The logged-in user
                ...teamMembers.map(m => ({ ...m, isMe: false }))
            ];

            const result = await registerForTournament(tournamentId, participants);

            if (result && result.success) {
                alert("참가 신청이 완료되었습니다!");
            }
            setIsModalOpen(false);
        } catch (error: any) {
            alert(error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = async () => {
        if (!confirm("참가 신청을 취소하시겠습니까?")) return;
        setLoading(true);
        try {
            await cancelRegistration(tournamentId);
            alert("참가 신청이 취소되었습니다.");
        } catch (error: any) {
            alert(error.message);
        } finally {
            setLoading(false);
        }
    };

    if (isRegistered) {
        return (
            <button
                onClick={handleCancel}
                disabled={loading}
                className="btn btn-primary bg-blue-600 hover:bg-blue-700 h-12 px-8 font-black shadow-lg shadow-blue-600/20"
            >
                {loading ? "처리 중..." : "신청 취소"}
            </button>
        );
    }

    if (!canJoin) return null;

    return (
        <>
            <button
                onClick={() => setIsModalOpen(true)}
                disabled={loading}
                className="btn btn-primary bg-blue-600 hover:bg-blue-700 text-white h-12 px-8 font-black shadow-lg shadow-blue-600/20"
            >
                참가 신청하기
            </button>

            {isModalOpen && (
                <div className="fixed inset-0 z-[10000] bg-black/90 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-950 w-full max-w-lg rounded-[2.5rem] border-4 border-blue-600 shadow-2xl p-6 md:p-10 relative overflow-hidden flex flex-col gap-6">
                        <div className="absolute top-0 left-0 w-full h-4 bg-blue-600"></div>

                        <div className="flex flex-col gap-1 mt-2">
                            <h3 className="text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                                <span className="text-4xl">🎳</span> 참가 신청
                            </h3>
                            <p className="text-sm font-bold text-slate-400">대회 참가를 위해 정보를 입력해 주세요.</p>
                        </div>

                        <div className="space-y-6 max-h-[60vh] overflow-y-auto px-1">
                            {/* My Info */}
                            <div className="flex flex-col gap-3">
                                <label className="text-lg font-black text-slate-700 dark:text-slate-300">내 정보 (신청자)</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={handicap}
                                        onChange={(e) => setHandicap(Number(e.target.value))}
                                        className="w-full h-16 bg-slate-100 dark:bg-slate-800 border-3 border-slate-200 dark:border-slate-700 rounded-2xl px-6 text-2xl font-black text-blue-600 focus:border-blue-600 outline-none transition-all shadow-inner"
                                        placeholder="0"
                                    />
                                    <span className="absolute right-6 top-1/2 -translate-y-1/2 text-lg font-black text-slate-400">핸디</span>
                                </div>
                            </div>

                            {/* Teammates Info */}
                            {teamMembers.map((member, idx) => (
                                <div key={idx} className="flex flex-col gap-4 p-5 bg-slate-50 dark:bg-slate-900 rounded-[2rem] border-2 border-slate-200 dark:border-slate-800">
                                    <h4 className="text-md font-black text-blue-600 flex items-center gap-2">
                                        👥 팀원 {idx + 1} 정보
                                    </h4>
                                    <div className="grid grid-cols-1 gap-4">
                                        <div className="flex flex-col gap-2">
                                            <label className="text-xs font-bold text-slate-500 ml-1">팀 (클럽) 명</label>
                                            <input
                                                type="text"
                                                value={member.teamName}
                                                onChange={(e) => {
                                                    const newMembers = [...teamMembers];
                                                    newMembers[idx] = { ...newMembers[idx], teamName: e.target.value };
                                                    setTeamMembers(newMembers);
                                                }}
                                                className="w-full h-12 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl px-4 text-sm font-bold focus:border-blue-500 outline-none transition-all"
                                                placeholder="팀명 입력"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="flex flex-col gap-2">
                                                <label className="text-xs font-bold text-slate-500 ml-1">이름</label>
                                                <input
                                                    type="text"
                                                    value={member.name}
                                                    onChange={(e) => {
                                                        const newMembers = [...teamMembers];
                                                        newMembers[idx] = { ...newMembers[idx], name: e.target.value };
                                                        setTeamMembers(newMembers);
                                                    }}
                                                    className="w-full h-12 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl px-4 text-sm font-bold focus:border-blue-500 outline-none transition-all"
                                                    placeholder="성함"
                                                />
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <label className="text-xs font-bold text-slate-500 ml-1">핸디</label>
                                                <input
                                                    type="number"
                                                    value={member.handicap}
                                                    onChange={(e) => {
                                                        const newMembers = [...teamMembers];
                                                        newMembers[idx] = { ...newMembers[idx], handicap: Number(e.target.value) };
                                                        setTeamMembers(newMembers);
                                                    }}
                                                    className="w-full h-12 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl px-4 text-sm font-bold focus:border-blue-500 outline-none transition-all"
                                                    placeholder="0"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            <p className="text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800/50 p-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 mt-2">
                                💡 모든 팀원의 정보를 정확하게 입력해 주세요. (미입력 시 0점 적용)
                            </p>

                            {/* Agreement Section */}
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-3xl border-2 border-blue-100 dark:border-blue-800 shadow-sm relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-2 opacity-10">
                                    <span className="text-5xl">📢</span>
                                </div>
                                <label className="flex items-start gap-4 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={agreed}
                                        onChange={(e) => setAgreed(e.target.checked)}
                                        className="w-8 h-8 rounded-lg border-2 border-blue-600 text-blue-600 focus:ring-blue-500 cursor-pointer mt-0.5"
                                    />
                                    <span className="text-sm font-black leading-snug group-hover:text-blue-700 transition-colors text-slate-800 dark:text-slate-200">
                                        접수 후 <span className="text-blue-600 dark:text-blue-400 underline underline-offset-4 decoration-2">72시간 내</span> 참가비 미입금 시 <span className="text-red-600 dark:text-red-400 underline underline-offset-4 decoration-2">자동 신청 취소</span>됨에 동의합니다.
                                    </span>
                                </label>
                            </div>

                            {/* Button Section */}
                            <div className="flex flex-col gap-4 pt-4 pb-2">
                                <button
                                    onClick={handleRegister}
                                    disabled={loading || !agreed}
                                    className="w-full h-20 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-3xl font-black text-2xl shadow-xl shadow-blue-600/30 active:scale-[0.98] transition-all outline-none flex items-center justify-center gap-3 border-b-8 border-blue-800"
                                >
                                    {loading ? "신청 중..." : "참가 신청 완료 🚀"}
                                </button>
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="w-full h-14 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-2xl font-black text-lg transition-all outline-none border-b-4 border-slate-300 dark:border-slate-900"
                                    disabled={loading}
                                >
                                    닫기
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
