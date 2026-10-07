'use client';

import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { getLaneAnnouncement, type LaneAnnouncementParticipant } from '@/lib/lane-announcement';
import { formatLane } from '@/lib/tournament-utils';
import ui from './ManagementUI.module.css';
import styles from './LotteryAndLane.module.css';

export default function LaneAssignmentModal({ participants, roundNumber, onClose }: {
    participants: LaneAnnouncementParticipant[]; roundNumber?: number; onClose: () => void;
}) {
    const dialog = useRef<HTMLDialogElement>(null);
    const titleId = useId();
    const { assigned, unassigned } = getLaneAnnouncement(participants);
    useEffect(() => {
        const element = dialog.current;
        const opener = document.activeElement as HTMLElement | null;
        const overflow = document.body.style.overflow;
        element?.showModal();
        document.body.style.overflow = 'hidden';
        return () => { element?.close(); document.body.style.overflow = overflow; opener?.focus(); };
    }, []);
    const table = (rows: typeof assigned, label: string) => <table className={styles.laneTable} aria-label={label}>
        <thead><tr><th>팀명</th><th>이름</th><th>레인</th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.id}><td>{row.team}</td><td>{row.name}</td><td>{row.lane === null ? '미배정' : formatLane(row.lane)}</td></tr>)}</tbody>
    </table>;
    return createPortal(<dialog ref={dialog} className={ui.modal} aria-labelledby={titleId}
        onCancel={event => { event.preventDefault(); onClose(); }}>
        <div className={ui.modalBody}>
            <div className={styles.modalHeader}><div><h2 id={titleId} className={ui.title}>레인 배정 안내</h2>
                <p className={ui.subtitle}>{roundNumber != null ? `${roundNumber}회차 · ` : ''}팀명 · 이름 · 레인(레인-자리) 순서로 확인하세요.</p></div>
                <button type="button" className={ui.button} onClick={onClose} aria-label="레인 배정 보기 닫기">✕</button></div>
            <section><h3 className={styles.sectionTitle}>배정 완료 <span className={ui.badge}>{assigned.length}명</span></h3>
                {assigned.length ? table(assigned, '레인 배정 명단') : <p className={ui.empty}>배정된 레인이 없습니다.</p>}</section>
            {unassigned.length > 0 && <section className={styles.unassigned}><h3 className={styles.sectionTitle}>미배정 <span className={ui.badge}>{unassigned.length}명</span></h3>{table(unassigned, '레인 미배정 명단')}</section>}
        </div>
        <footer className={ui.modalFooter}><button type="button" className={`${ui.button} ${ui.primary}`} onClick={onClose}>닫기</button></footer>
    </dialog>, document.body);
}
