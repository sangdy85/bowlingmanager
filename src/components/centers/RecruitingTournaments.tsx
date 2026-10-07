'use client';

import Link from 'next/link';
import styles from './RecruitingTournaments.module.css';

interface Props {
    centerId: string;
    tournaments: {
        id: string;
        name: string;
        startDateLabel: string;
        type: string;
        status: string; // Pre-calculated: UPCOMING, OPEN, CLOSED, ONGOING, FINISHED
        maxParticipants: number;
        participantCount: number;
        isRegistered: boolean;
        roundId?: string;
    }[];
    isManager?: boolean;
}

export default function ActiveTournaments({ tournaments, centerId, isManager = false }: Props) {
    if (tournaments.length === 0) return null;

    return (
        <section className={styles.section}>
            <div className={styles.sectionHeader}>
                <span className={styles.sectionIcon} aria-hidden="true">🔥</span>
                <h2 className={styles.sectionTitle}>모집 중인 대회</h2>
            </div>

            <div className={styles.grid}>
                {tournaments.map(t => {
                    let buttonText = '참가 신청';
                    let buttonColor = '#2563eb';

                    if (isManager) {
                        buttonText = '대회 관리';
                    } else if (t.isRegistered) {
                        buttonText = '신청 완료';
                        buttonColor = '#16a34a';
                    } else if (t.status === 'ONGOING') {
                        buttonText = '대회 진행중';
                    } else if (t.status === 'CLOSED') {
                        buttonText = '접수 마감';
                        buttonColor = '#64748b';
                    }

                    let href = `/centers/${centerId}/tournaments/${t.id}`;
                    if (t.type === 'CHAMP' && t.roundId) {
                        href = `/centers/${centerId}/tournaments/${t.id}?mode=recruit`;
                    }

                    const typeLabel = t.type === 'LEAGUE'
                        ? '상주리그'
                        : t.type === 'CHAMP'
                            ? '챔프전'
                            : '이벤트';

                    return (
                        <article key={t.id} className={styles.card}>
                            <div className={styles.content}>
                                <p className={styles.type}>{typeLabel}</p>
                                <h3 className={styles.title} title={t.name}>{t.name}</h3>
                                <p className={styles.subline}>📅 {t.startDateLabel}</p>
                            </div>

                            <div className={styles.actions}>
                                <div className={styles.count}>
                                    <span className={styles.countLabel}>신청 인원</span>
                                    <span className={styles.countValue}>{t.participantCount}</span>
                                    <span className={styles.countMax}>/ {t.maxParticipants}</span>
                                </div>
                                <Link
                                    href={href}
                                    className={`btn ${styles.actionButton}`}
                                    style={{ backgroundColor: buttonColor, color: 'white' }}
                                >
                                    {buttonText}
                                </Link>
                            </div>
                        </article>
                    );
                })}
            </div>
        </section>
}
