'use client';

import { useState } from "react";
import Link from "next/link";
import { createResidentTeam, deleteResidentTeam, mergePlaceholderTeam } from "@/app/actions/team-actions";
import styles from "./CenterTeamsManager.module.css";

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
        <div className={styles.page}>
            <Link href={`/centers/${centerId}`} className={styles.back}>
                <span className={styles.backIcon} aria-hidden="true">←</span>
                <span>볼링장 정보로 돌아가기</span>
            </Link>

            <header className={styles.hero}>
                <div>
                    <h1 className={styles.title}>상주 클럽 관리</h1>
                    <p className={styles.subtitle}>{center.name} 소속 클럽을 등록·연동하고 임시 클럽 기록을 정리합니다.</p>
                </div>
                <div className={styles.count}>
                    <span className={styles.countLabel}>등록 클럽</span>
                    <strong className={styles.countValue}>{center.teams?.length || 0}개</strong>
                </div>
            </header>

            <div className={styles.layout}>
                <section className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <h2 className={styles.sectionTitle}>등록된 클럽</h2>
                        <p className={styles.sectionHint}>정식 팀과 관리용 임시 클럽을 한곳에서 확인합니다.</p>
                    </div>
                    <div className={styles.sectionBody}>
                        {!center.teams || center.teams.length === 0 ? (
                            <div className={styles.empty}>등록된 상주 클럽이 없습니다. 오른쪽에서 새 클럽을 추가해주세요.</div>
                        ) : (
                            <div className={styles.list}>
                                {center.teams.map((team) => {
                                    const isMergingCurrent = mergingTeamId === team.id;
                                    const isPlaceholder = !team.ownerId;

                                    return (
                                        <article key={team.id} className={styles.teamCard}>
                                            <div className={styles.teamTop}>
                                                <div>
                                                    <div className={styles.teamName}>
                                                        {team.name}
                                                        {!isPlaceholder && <span className="badge badge-primary badge-sm ml-2">Official</span>}
                                                    </div>
                                                    <div className={styles.teamMeta}>팀 코드 · {team.code}</div>
                                                </div>

                                                <div className={styles.actions}>
                                                    {isPlaceholder && !isMergingCurrent && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setMergingTeamId(team.id)}
                                                            className={`btn btn-secondary ${styles.smallButton}`}
                                                        >
                                                            정식 팀과 합치기
                                                        </button>
                                                    )}
                                                    <form action={async () => {
                                                        if (confirm(isPlaceholder ? "정말 삭제하시겠습니까?" : "연동을 해제하시겠습니까?")) {
                                                            await deleteResidentTeam(centerId, team.id);
                                                        }
                                                    }}>
                                                        <button className={`btn btn-secondary ${styles.smallButton}`}>
                                                            {isPlaceholder ? "삭제" : "연동 해제"}
                                                        </button>
                                                    </form>
                                                </div>
                                            </div>

                                            {isMergingCurrent && (
                                                <form action={handleMerge} className={styles.mergeBox}>
                                                    <div className={styles.mergeTitle}>{team.name} 데이터를 정식 팀으로 합치기</div>
                                                    <div className={styles.mergeRow}>
                                                        <input
                                                            name="realCode"
                                                            type="text"
                                                            placeholder="정식 팀 6자리 코드"
                                                            className="input flex-1 font-black uppercase"
                                                            required
                                                            disabled={loading}
                                                        />
                                                        <button type="submit" className="btn btn-primary" disabled={loading}>
                                                            {loading ? "처리 중..." : "합치기 확인"}
                                                        </button>
                                                        <button type="button" onClick={() => setMergingTeamId(null)} className="btn btn-secondary" disabled={loading}>
                                                            취소
                                                        </button>
                                                    </div>
                                                    <p className={styles.mergeHelp}>
                                                        합치면 임시 팀의 대회 성적과 점수 기록이 정식 팀으로 이전되고 임시 팀은 삭제됩니다.
                                                    </p>
                                                </form>
                                            )}
                                        </article>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </section>

                <aside className={styles.sidebar}>
                    <section className={styles.section}>
                        <div className={styles.sectionHeader}>
                            <h2 className={styles.sectionTitle}>클럽 등록 · 연동</h2>
                            <p className={styles.sectionHint}>신규 생성 또는 기존 팀 코드를 연결합니다.</p>
                        </div>
                        <div className={styles.sectionBody}>
                            <form action={createResidentTeam.bind(null, centerId)} className={styles.form}>
                                <div className={styles.option}>
                                    <label className="label"><span className={styles.optionTitle}>1. 새 클럽 직접 생성</span></label>
                                    <input name="name" type="text" className="input" placeholder="클럽 이름을 입력하세요" />
                                    <p className={styles.help}>가입된 팀이 없는 경우 관리용 클럽을 새로 만듭니다.</p>
                                </div>

                                <div className={styles.divider}>또는</div>

                                <div className={styles.option}>
                                    <label className="label"><span className={styles.optionTitle}>2. 가입된 팀 연동 · 권장</span></label>
                                    <input name="existingCode" type="text" className="input" placeholder="6자리 팀 코드를 입력하세요" />
                                    <p className={styles.help}>기존 팀 코드를 입력하면 회원 정보가 자동으로 연결됩니다.</p>
                                </div>

                                <button type="submit" className="btn btn-primary w-full">클럽 등록 · 연동하기</button>
                            </form>
                        </div>
                    </section>
                </aside>
            </div>
        </div>
    );
}
