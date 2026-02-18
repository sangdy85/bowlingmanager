'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { joinCenter } from '@/app/actions/center-members';

interface Team {
    id: string;
    name: string;
}

interface JoinCenterSectionProps {
    centerId: string;
    centerName: string;
    teams: Team[];
    userId: string;
    userName: string;
    currentMember?: {
        id: string;
        teamId?: string | null;
        Team?: { name: string } | null;
    } | null;
}

export default function JoinCenterSection({
    centerId,
    centerName,
    teams,
    userId,
    userName,
    currentMember
}: JoinCenterSectionProps) {
    const router = useRouter();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedTeamId, setSelectedTeamId] = useState<string>(currentMember?.teamId || "");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleJoin = async () => {
        setIsSubmitting(true);
        setError(null);

        try {
            const result = await joinCenter(centerId, selectedTeamId || null, userName); // Use userName as alias by default
            if (result.success) {
                alert(currentMember ? "정보가 수정되었습니다." : "가입이 완료되었습니다.");
                setIsModalOpen(false);
                router.refresh();
            } else {
                setError(result.message);
            }
        } catch (e) {
            setError("처리 중 오류가 발생했습니다.");
            console.error(e);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="card p-6 bg-primary/5 border-primary/20 mb-6">
            <h3 className="font-bold mb-2 text-lg">
                {currentMember ? "소속 정보 관리" : "볼링장 가입하기"}
            </h3>
            {currentMember ? (
                <div className="mb-4">
                    <p className="text-sm text-secondary-foreground mb-1">현재 대표 소속:</p>
                    <p className="font-bold text-primary">
                        {currentMember.Team?.name || "개인 (소속 없음)"}
                    </p>
                </div>
            ) : (
                <p className="text-sm text-secondary-foreground mb-4">
                    {centerName}의 회원이 되어 활동해보세요! 소속된 팀(클럽)이 있다면 함께 등록할 수 있습니다.
                </p>
            )}
            <button
                onClick={() => setIsModalOpen(true)}
                className="btn btn-primary w-full py-3 text-base"
            >
                {currentMember ? "소속 팀 변경하기" : "센터 가입하기"}
            </button>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-background rounded-lg shadow-xl w-full max-w-md p-6 relative">
                        <button
                            onClick={() => setIsModalOpen(false)}
                            className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
                        >
                            ✕
                        </button>

                        <h2 className="text-xl font-bold mb-6">가입 정보 입력</h2>

                        {error && (
                            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded mb-4">
                                {error}
                            </div>
                        )}

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">이름</label>
                                <input
                                    type="text"
                                    value={userName}
                                    disabled
                                    className="input w-full bg-muted text-muted-foreground"
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    * 현재 로그인된 계정의 이름으로 가입됩니다.
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">소속 팀 (선택)</label>
                                <select
                                    value={selectedTeamId}
                                    onChange={(e) => setSelectedTeamId(e.target.value)}
                                    className="input w-full"
                                >
                                    <option value="">팀 선택 안함 (개인 회원)</option>
                                    {teams
                                        .filter(team => !team.name.endsWith(' A') && !team.name.endsWith(' B'))
                                        .map(team => (
                                            <option key={team.id} value={team.id}>
                                                {team.name}
                                            </option>
                                        ))}
                                </select>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-8">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="btn btn-secondary flex-1"
                                disabled={isSubmitting}
                            >
                                취소
                            </button>
                            <button
                                onClick={handleJoin}
                                className="btn btn-primary flex-1"
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? "가입 중..." : "가입 완료"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
