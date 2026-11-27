'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { joinCenter } from '@/app/actions/center-members';
import styles from './JoinCenterSection.module.css';

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
        <div className={`card ${styles.card}`}>
            <h3 className={styles.title}>
                {currentMember ? "소속 정보 관리" : "볼링장 가입하기"}
            </h3>
            {currentMember ? (
                <div className={styles.current}>
                    <p className={styles.currentLabel}>현재 대표 소속:</p>
                    <p className={styles.currentTeam}>
                        {currentMember.Team?.name || "개인 (소속 없음)"}
                    </p>
                </div>
            ) : (
                <p className={styles.description}>
                    {centerName}의 회원이 되어 활동해보세요! 소속된 팀(클럽)이 있다면 함께 등록할 수 있습니다.
                </p>
            )}
            <button
                onClick={() => setIsModalOpen(true)}
                className={`btn btn-primary ${styles.openButton}`}
            >
                {currentMember ? "소속 팀 변경하기" : "센터 가입하기"}
            </button>

            {isModalOpen && (
                <div className={styles.overlay}>
                    <div className={styles.modal}>
                        <button
                            onClick={() => setIsModalOpen(false)}
                            className={styles.close}
                        >
                            ✕
                        </button>

                        <h2 className={styles.modalTitle}>가입 정보 입력</h2>

                        {error && (
                            <div className={styles.error}>
                                {error}
                            </div>
                        )}

                        <div className={styles.fields}>
                            <div className={styles.field}>
                                <label>이름</label>
                                <input
                                    type="text"
                                    value={userName}
                                    disabled
                                    className="input w-full bg-muted text-muted-foreground"
                                />
                                <p className={styles.help}>
                                    * 현재 로그인된 계정의 이름으로 가입됩니다.
                                </p>
                            </div>

                            <div className={styles.field}>
                                <label>소속 팀 (선택)</label>
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

                        <div className={styles.actions}>
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
