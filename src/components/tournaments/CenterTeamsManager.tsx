'use client';

import { useState } from "react";
import Link from "next/link";
import { createResidentTeam, deleteResidentTeam, mergePlaceholderTeam } from "@/app/actions/team-actions";

interface Team {
    id: string;
    name: string;
    code: string;
    ownerId: string | null;
}

interface CenterTeamsManagerProps {
    center: {
        id: string;
        name: string;
        teams: Team[];
    };
    centerId: string;
}

export default function CenterTeamsManager({ center, centerId }: CenterTeamsManagerProps) {
    const [mergingTeamId, setMergingTeamId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleMerge = async (formData: FormData) => {
        setLoading(true);
        try {
            const teamId = mergingTeamId;
            if (!teamId) return;
            const res = await mergePlaceholderTeam(centerId, teamId, formData);
            if (res.success) {
                setMergingTeamId(null);
            }
        } catch (error: any) {
            alert(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto py-8 px-4">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold">상주 클럽 관리</h1>
                    <p className="text-secondary-foreground">{center.name} 소속 클럽 목록</p>
                </div>
                <Link href={`/centers/${centerId}`} className="btn btn-secondary text-sm h-10">볼링장으로 돌아가기</Link>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                    <section className="card p-6">
                        <h2 className="text-xl font-bold mb-6">등록된 클럽 ({center.teams?.length || 0})</h2>

                        {!center.teams || center.teams.length === 0 ? (
                            <p className="text-center py-12 text-secondary-foreground border-2 border-dashed rounded-lg">
                                등록된 상주 클럽이 없습니다. 오른쪽에 새 클럽을 추가해주세요.
                            </p>
                        ) : (
                            <div className="space-y-4">
                                {center.teams.map((team) => {
                                    const isMergingCurrent = mergingTeamId === team.id;
                                    const isPlaceholder = !team.ownerId;

                                    return (
                                        <div key={team.id} className="p-4 bg-secondary/5 rounded-lg border border-border/50">
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-lg">{team.name}</span>
                                                        {!isPlaceholder && (
                                                            <span className="badge badge-primary badge-sm text-[8px] font-black uppercase">Official</span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-secondary-foreground">코드: {team.code}</div>
                                                </div>
                                                <div className="flex gap-2">
                                                    {isPlaceholder && !isMergingCurrent && (
                                                        <button
                                                            onClick={() => setMergingTeamId(team.id)}
                                                            className="btn btn-ghost btn-xs text-blue-600 font-black h-8 px-3 border-blue-200 hover:bg-blue-50"
                                                        >
                                                            정식 팀과 합치기
                                                        </button>
                                                    )}
                                                    <form action={async (fd) => {
                                                        if (confirm(isPlaceholder ? "정말 삭제하시겠습니까?" : "연동을 해제하시겠습니까?")) {
                                                            await deleteResidentTeam(centerId, team.id);
                                                        }
                                                    }}>
                                                        <button className="btn btn-secondary text-destructive text-xs h-8 px-3">
                                                            {isPlaceholder ? "삭제" : "연동 해제"}
                                                        </button>
                                                    </form>
                                                </div>
                                            </div>

                                            {isMergingCurrent && (
                                                <form action={handleMerge} className="mt-4 p-4 bg-blue-50/50 rounded-xl border border-blue-200 space-y-3 animate-in fade-in slide-in-from-top-2">
                                                    <div className="text-xs font-black text-blue-800">{team.name} 데이터를 정식 팀으로 합치기</div>
                                                    <div className="flex gap-2">
                                                        <input
                                                            name="realCode"
                                                            type="text"
                                                            placeholder="정식 팀 6자리 코드"
                                                            className="input input-sm flex-1 font-black uppercase"
                                                            required
                                                            disabled={loading}
                                                        />
                                                        <button
                                                            type="submit"
                                                            className="btn btn-primary btn-sm px-4 font-black"
                                                            disabled={loading}
                                                        >
                                                            {loading ? "처리 중..." : "합치기 확인"}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setMergingTeamId(null)}
                                                            className="btn btn-ghost btn-sm px-4 font-black"
                                                            disabled={loading}
                                                        >
                                                            취소
                                                        </button>
                                                    </div>
                                                    <p className="text-[10px] text-blue-600 leading-tight">
                                                        * 합치기를 하면 임시 팀의 <strong>모든 대회 성적, 점수 기록</strong>이 정식 팀으로 이전되고 임시 팀은 사라집니다.
                                                    </p>
                                                </form>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                </div>

                <div>
                    <section className="card p-6 sticky top-8">
                        <h2 className="text-xl font-bold mb-6">클럽 등록 / 연동</h2>
                        <form action={createResidentTeam.bind(null, centerId)} className="space-y-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="label py-1">
                                        <span className="label-text font-black text-primary">1. 새 클럽 직접 생성</span>
                                    </label>
                                    <input
                                        name="name"
                                        type="text"
                                        className="input h-10 w-full"
                                        placeholder="클럽 이름을 입력하세요"
                                    />
                                    <p className="text-[10px] text-secondary-foreground mt-1 ml-1 leading-tight">
                                        볼링장에서 관리용으로 새 클럽을 만듭니다.<br />
                                        가입된 팀이 없는 경우에 사용하세요.
                                    </p>
                                </div>

                                <div className="divider text-[10px] uppercase font-black opacity-50">OR</div>

                                <div>
                                    <label className="label py-1">
                                        <span className="label-text font-black text-blue-600">2. 가입된 팀 연동 (권장)</span>
                                    </label>
                                    <input
                                        name="existingCode"
                                        type="text"
                                        className="input h-10 w-full border-blue-200 focus:border-blue-500"
                                        placeholder="6자리 팀 코드를 입력하세요"
                                    />
                                    <p className="text-[10px] text-secondary-foreground mt-1 ml-1 leading-tight">
                                        팀이 이미 가입되어 있다면 팀 코드를 입력하세요.<br />
                                        <strong className="text-blue-600">팀의 회원 정보가 자동으로 연동됩니다.</strong>
                                    </p>
                                </div>
                            </div>

                            <div className="pt-2">
                                <button type="submit" className="btn btn-primary w-full h-11 font-black">클럽 등록/연동하기</button>
                            </div>
                        </form>
                    </section>
                </div>
            </div>
        </div>
    );
}
