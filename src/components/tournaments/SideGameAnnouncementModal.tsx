'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    formatSideGameAnnouncement,
    splitSideGameAnnouncementRows,
    type SideGameAnnouncementRow,
} from '@/lib/side-game-announcement';
import ui from './ManagementUI.module.css';

function AnnouncementTable({ rows, label }: { rows: SideGameAnnouncementRow[]; label: string }) {
    return (
        <div className={ui.announcementTableWrap}>
            <table className={ui.announcementTable} aria-label={label}>
                <thead>
                    <tr>
                        <th>이름</th>
                        <th>사이드</th>
                        <th>번외</th>
                        <th>볼사이드</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.length ? rows.map(row => (
                        <tr key={row.regId}>
                            <td>{row.name}</td>
                            <td aria-label={`${row.name} 사이드 ${row.standard ? '참여' : '미참여'}`}>{row.standard ? 'O' : ''}</td>
                            <td aria-label={`${row.name} 번외 ${row.extra ? '참여' : '미참여'}`}>{row.extra ? 'O' : ''}</td>
                            <td aria-label={`${row.name} 볼사이드 ${row.ball ? '참여' : '미참여'}`}>{row.ball ? 'O' : ''}</td>
                        </tr>
                    )) : (
                        <tr>
                            <td colSpan={4} className={ui.announcementEmptyCell}>-</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}

export default function SideGameAnnouncementModal({ rows, roundNumber, onClose }: {
    rows: SideGameAnnouncementRow[];
    roundNumber?: number;
    onClose: () => void;
}) {
    const dialog = useRef<HTMLDialogElement>(null);
    const [feedback, setFeedback] = useState('');
    const [leftRows, rightRows] = splitSideGameAnnouncementRows(rows);

    useEffect(() => {
        const element = dialog.current;
        const opener = document.activeElement as HTMLElement | null;
        const previousOverflow = document.body.style.overflow;
        element?.showModal();
        document.body.style.overflow = 'hidden';
        return () => {
            element?.close();
            document.body.style.overflow = previousOverflow;
            opener?.focus();
        };
    }, []);

    return createPortal(
        <dialog
            ref={dialog}
            className={ui.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="side-announcement-title"
            aria-describedby="side-announcement-description"
            onCancel={event => {
                event.preventDefault();
                onClose();
            }}
        >
            <div className={ui.modalBody}>
                <div className={ui.header}>
                    <div>
                        <h2 id="side-announcement-title" className={ui.title}>사이드 게임 명단 발표</h2>
                        <p id="side-announcement-description" className={ui.subtitle}>
                            {roundNumber != null ? `${roundNumber}회차 · ` : ''}
                            사이드·번외·볼사이드 중 하나 이상 신청한 {rows.length}명을 표시합니다.
                        </p>
                    </div>
                    <button type="button" className={ui.button} onClick={onClose} aria-label="명단 발표 닫기">✕</button>
                </div>

                {rows.length ? (
                    <div className={ui.announcementSplit}>
                        <AnnouncementTable rows={leftRows} label="사이드 게임 명단 왼쪽 표" />
                        <AnnouncementTable rows={rightRows} label="사이드 게임 명단 오른쪽 표" />
                    </div>
                ) : (
                    <p className={ui.empty}>사이드 참가자가 없습니다.</p>
                )}
            </div>

            <footer className={ui.modalFooter}>
                <p className={ui.feedback} role="status">{feedback}</p>
                <button
                    type="button"
                    className={`${ui.button} ${ui.primary}`}
                    onClick={async () => {
                        try {
                            await navigator.clipboard.writeText(formatSideGameAnnouncement(rows, roundNumber));
                            setFeedback('사이드 게임 명단을 복사했습니다.');
                        } catch {
                            setFeedback('명단을 복사하지 못했습니다. 브라우저의 클립보드 권한을 확인해주세요.');
                        }
                    }}
                >
                    명단 복사하기
                </button>
                <button type="button" className={ui.button} onClick={onClose}>닫기</button>
            </footer>
        </dialog>,
        document.body,
    );
}
