'use client';

import { useState } from 'react';
import Link from 'next/link';
import { calculateTournamentStatus } from '@/lib/tournament-utils';

import styles from './TournamentListManager.module.css';

interface TournamentSummary {
    id: string;
    name: string;
    type: string;
    status: string;
    startDate: string;
    endDate: string;
    isGrouped?: boolean;
    leagueRounds?: { id: string }[];
}

export default function TournamentListManager({
    tournaments,
    centerId,
    isManager = false
}: {
    tournaments: TournamentSummary[],
    centerId: string,
    isManager?: boolean
}) {
    const [mainTab, setMainTab] = useState<'ONGOING' | 'FINISHED'>('ONGOING');
    const [subTab, setSubTab] = useState<'LEAGUE' | 'CHAMP' | 'EVENT' | 'CUSTOM'>('LEAGUE');

    const typeMap: Record<string, { label: string, styleClass: string }> = {
        LEAGUE: { label: "상주리그", styleClass: styles.typeLeague },
        CHAMP: { label: "챔프전", styleClass: styles.typeChamp },
        EVENT: { label: "이벤트전", styleClass: styles.typeEvent },
    };

    const filteredTournaments = tournaments.filter(t => {
        // Sub Tab Filter
        if (t.type !== subTab) return false;

        // Main Tab Filter
        if (mainTab === 'ONGOING' && t.status === 'FINISHED') return false;
        if (mainTab === 'FINISHED' && t.status !== 'FINISHED') return false;

        return true;
    });

    return (
        <div className={styles.container}>
            {/* Header / Main Tabs */}
            <div className={styles.tabContainer}>
                <button
                    onClick={() => setMainTab('ONGOING')}
                    className={`${styles.tabButton} ${mainTab === 'ONGOING' ? styles.tabButtonActive : styles.tabButtonInactive}`}
                >
                    진 행 중
                </button>
                <button
                    onClick={() => setMainTab('FINISHED')}
                    className={`${styles.tabButton} ${mainTab === 'FINISHED' ? styles.tabButtonActive : styles.tabButtonInactive}`}
                >
                    종 료 됨
                </button>
            </div>

            {/* Sub Tabs (Filters) */}
            <div className={styles.filterContainer}>
                {(['LEAGUE', 'CHAMP', 'EVENT'] as const).map((type) => {
                    const isActive = subTab === type;
                    const mapItem = typeMap[type];
                    let className = styles.filterButton;
                    if (isActive) {
                        className += ` ${styles.filterButtonActive} ${mapItem.styleClass}`;
                    }

                    return (
                        <button
                            key={type}
                            onClick={() => setSubTab(type)}
                            className={className}
                        >
                            {mapItem.label}
                        </button>
                    );
                })}
            </div>

            {/* List */}
            <div className={styles.listContainer}>
                {filteredTournaments.length === 0 && (
                    <div className={styles.emptyState}>
                        <div className={styles.emptyIcon}>📭</div>
                        <p className={styles.emptyText}>해당하는 대회가 없습니다.</p>
                    </div>
                )}
                {filteredTournaments.length > 0 && (
                    <div className={styles.list}>
                        {filteredTournaments.map(t => {
                            const mapItem = typeMap[t.type] || typeMap['LEAGUE'];
                            return (
                                <Link
                                    key={t.id}
                                    href={isManager && t.type === 'EVENT' && t.leagueRounds?.[0]?.id
                                        ? `/centers/${centerId}/tournaments/${t.id}/rounds/${t.leagueRounds[0].id}`
                                        : (t.type === 'CHAMP'
                                            ? `/centers/${centerId}/tournaments/${t.id}?mode=results`
                                            : `/centers/${centerId}/tournaments/${t.id}`)}
                                    className={styles.card}
                                >
                                    {/* Left Accent Bar */}
                                    <div className={`${styles.accentBar} ${mapItem.styleClass}`} />

                                    <div className={styles.cardContent}>
                                        <div className={styles.cardHeader}>
                                            {/* Badge & Date */}
                                            <div className={styles.badges}>
                                                <span className={`${styles.typeBadge} ${mapItem.styleClass}`}>
                                                    {mapItem.label}{t.isGrouped ? ' 시리즈' : ''}
                                                </span>
                                                <span className={styles.date}>
                                                    📅 {t.startDate} ~ {t.endDate}
                                                </span>
                                                {t.type !== 'LEAGUE' && (
                                                    <span className={`${styles.statusBadge} ${t.status === 'FINISHED' ? styles.statusFinished : styles.statusActive}`}>
                                                        {t.isGrouped && t.status !== 'FINISHED' ? '시리즈 진행 중' : (t.status === 'FINISHED' ? '종료' : (t.status === 'ONGOING' ? '진행 중' : (t.status === 'OPEN' ? '모집 중' : (t.status === 'CLOSED' ? '마감' : '예정'))))}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Title */}
                                            <h3 className={styles.title}>
                                                {t.name}
                                            </h3>
                                        </div>

                                        {/* Action Icon */}
                                        <div className={`${styles.arrowIcon} ${mapItem.styleClass}`}>
                                            ➜
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
