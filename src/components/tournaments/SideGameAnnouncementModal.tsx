'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatSideGameAnnouncement, type AnnouncementGroup } from '@/lib/side-game-announcement';
import ui from './ManagementUI.module.css';

export default function SideGameAnnouncementModal({ groups, roundNumber, onClose }: {
    groups: AnnouncementGroup[]; roundNumber?: number; onClose: () => void;
}) {
    const dialog = useRef<HTMLDialogElement>(null);
    const [feedback, setFeedback] = useState('');
    useEffect(() => {
        const element = dialog.current;
        const opener = document.activeElement as HTMLElement | null;
        const previousOverflow = document.body.style.overflow;
        element?.showModal();
        document.body.style.overflow = 'hidden';
        return () => { element?.close(); document.body.style.overflow = previousOverflow; opener?.focus(); };
    }, []);
    return createPortal(<dialog ref={dialog} className={ui.modal} role="dialog" aria-modal="true" aria-labelledby="side-announcement-title" aria-describedby="side-announcement-description" onCancel={event => { event.preventDefault(); onClose(); }}>
        <div className={ui.modalBody}>
            <div className={ui.header}>
                <div><h2 id="side-announcement-title" className={ui.title}>사이드 게임 명단 발표</h2><p id="side-announcement-description" className={ui.subtitle}>{roundNumber != null ? `${roundNumber}회차 · ` : ''}현재 선택한 명단입니다. 저장 전 변경 사항도 포함됩니다.</p></div>
                <button type="button" className={ui.button} onClick={onClose} aria-label="명단 발표 닫기">✕</button>
            </div>
            <div className={ui.announcementGroups}>{groups.map(group => <section key={group.category} className={ui.announcementGroup}>
                <h3>{group.label}<span className={ui.badge}>{group.names.length}명</span></h3>
                {group.names.length ? <ul className={ui.names}>{group.names.map((name, index) => <li key={index}>{name}</li>)}</ul> : <p className={ui.empty}>참여자가 없습니다.</p>}
            </section>)}</div>
        </div>
        <footer className={ui.modalFooter}>
            <p className={ui.feedback} role="status">{feedback}</p>
            <button type="button" className={`${ui.button} ${ui.primary}`} onClick={async () => {
                try { await navigator.clipboard.writeText(formatSideGameAnnouncement(groups, roundNumber)); setFeedback('사이드 게임 명단을 복사했습니다.'); }
                catch { setFeedback('명단을 복사하지 못했습니다. 브라우저의 클립보드 권한을 확인해주세요.'); }
            }}>명단 복사하기</button>
            <button type="button" className={ui.button} onClick={onClose}>닫기</button>
        </footer>
    </dialog>, document.body);
}
