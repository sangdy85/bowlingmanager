'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getBandPostPreviewAction, publishBandPostAction } from '@/app/actions/band-actions';
import type { BandPostPreview, BandPostType } from '@/lib/band/types';
import styles from './BandPublishStatus.module.css';

export default function BandPublishControl({
    centerId,
    tournamentId,
    roundId,
    type,
    connected,
    buttonLabel,
    week,
    onBusyChange,
    onSettled,
}: {
    centerId: string;
    tournamentId: string;
    roundId?: string | null;
    type: BandPostType;
    connected: boolean;
    buttonLabel: string;
    week?: number;
    onBusyChange?: (busy: boolean) => void;
    onSettled?: () => void;
}) {
    const router = useRouter();
    const titleId = useId();
    const dialogRef = useRef<HTMLDialogElement>(null);
    const busyRef = useRef(false);
    const requestSequence = useRef(0);
    const [busy, setBusy] = useState<'preview' | 'publish' | null>(null);
    const [preview, setPreview] = useState<BandPostPreview | null>(null);
    const [approved, setApproved] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;
        if (preview && !dialog.open) dialog.showModal();
        if (!preview && dialog.open) dialog.close();
    }, [preview]);

    useEffect(() => {
        const sequenceRef = requestSequence;
        const dialog = dialogRef.current;
        sequenceRef.current++;
        busyRef.current = false;
        setBusy(null);
        setPreview(null);
        setApproved(false);
        setMessage('');
        return () => {
            sequenceRef.current++;
            dialog?.close();
        };
    }, [centerId, tournamentId, roundId, type, week]);

    useEffect(() => {
        onBusyChange?.(busy !== null);
        return () => onBusyChange?.(false);
    }, [busy, onBusyChange]);

    const close = () => {
        if (busyRef.current) return;
        dialogRef.current?.close();
        setPreview(null);
        setApproved(false);
    };

    const openPreview = async (doPush?: boolean) => {
        if (busyRef.current || !connected) return;
        busyRef.current = true;
        const sequence = ++requestSequence.current;
        setBusy('preview');
        setPreview(null);
        setMessage('');
        setApproved(false);
        try {
            const result = await getBandPostPreviewAction({ centerId, tournamentId, roundId, type, week, doPush });
            if (sequence !== requestSequence.current) return;
            if (result.success && result.outcome?.preview) {
                setPreview(result.outcome.preview);
            } else {
                setMessage(result.message);
            }
        } catch {
            if (sequence !== requestSequence.current) return;
            setMessage('게시 미리보기를 준비하지 못했습니다. 잠시 후 다시 시도해주세요.');
        } finally {
            if (sequence === requestSequence.current) { busyRef.current = false; setBusy(null); }
        }
    };

    const publish = async () => {
        if (busyRef.current || !preview || !approved || ['PENDING', 'UNKNOWN'].includes(preview.latestStatus || '')) return;
        busyRef.current = true;
        const sequence = ++requestSequence.current;
        setBusy('publish');
        setMessage('');
        try {
            const result = await publishBandPostAction({
                centerId, tournamentId, roundId, type, week, doPush: preview.doPush, previewToken: preview.previewToken,
            });
            if (sequence !== requestSequence.current) return;
            onSettled?.();
            setMessage(result.message);
            // A second attempt always needs a new preview, including on API failures.
            setPreview(null);
            setApproved(false);
            if (result.success) router.refresh();
        } catch {
            if (sequence !== requestSequence.current) return;
            onSettled?.();
            setMessage('게시 결과를 확인하지 못했습니다. BAND 게시 이력을 확인한 뒤 다시 시도해주세요.');
            setPreview(null);
            setApproved(false);
        } finally {
            if (sequence === requestSequence.current) { busyRef.current = false; setBusy(null); }
        }
    };

    return <>
        <div className={styles.control}>
            <button
                type="button"
                className={styles.button}
                disabled={!connected || busy !== null}
                onClick={() => openPreview()}
            >
                {busy === 'preview' ? '미리보기 준비 중…' : busy === 'publish' ? '게시 중…' : buttonLabel}
            </button>
            {message && <p role="status" className={styles.feedback}>{message}</p>}
        </div>
        <dialog
            ref={dialogRef}
            className={styles.previewDialog}
            aria-labelledby={titleId}
            onCancel={event => { event.preventDefault(); close(); }}
        >
            {preview && <>
                <div className={styles.previewHeader}>
                    <div>
                        <h3 id={titleId}>NAVER BAND 게시 미리보기</h3>
                        <p>대상 밴드와 공지 내용을 확인한 후 게시해주세요.</p>
                    </div>
                    <button type="button" onClick={close} className={styles.close} disabled={busy !== null} aria-label="미리보기 닫기">✕</button>
                </div>
                <div className={styles.previewBody}>
                    <dl className={styles.previewDetails}>
                        <div><dt>게시 대상</dt><dd>{preview.bandName}</dd></div>
                        <div><dt>BAND Key</dt><dd className={styles.key}>{preview.bandKey}</dd></div>
                        <div><dt>게시 버전</dt><dd>v{preview.nextRevision}{preview.latestStatus ? ` · 이전: ${preview.latestStatus}` : ' · 첫 게시'}</dd></div>
                        <div><dt>알림 발송</dt><dd>{preview.doPush ? '사용' : '사용 안 함'}</dd></div>
                    </dl>
                    <label className={styles.approval}>
                        <input type="checkbox" checked={preview.doPush} disabled={busy !== null}
                            onChange={event => openPreview(event.target.checked)} />
                        이번 공지에 BAND 알림 발송 (변경 시 미리보기를 다시 확인합니다)
                    </label>
                    <h4>게시될 공지문 · {preview.contentBytes.toLocaleString('ko-KR')} / {preview.maxContentBytes.toLocaleString('ko-KR')} UTF-8 바이트</h4>
                    <pre className={styles.previewText}>{preview.content}</pre>
                    {['PENDING', 'UNKNOWN'].includes(preview.latestStatus || '') && (
                        <p className={styles.previewWarning} role="alert">이전 게시 결과를 확인할 수 없습니다. BAND에서 실제 게시 여부를 확인하기 전에는 재게시할 수 없습니다.</p>
                    )}
                    <label className={styles.approval}>
                        <input
                            type="checkbox"
                            checked={approved}
                            onChange={event => setApproved(event.target.checked)}
                            disabled={busy !== null || ['PENDING', 'UNKNOWN'].includes(preview.latestStatus || '')}
                        />
                        게시 대상과 본문을 확인했으며 BAND에 게시하는 데 동의합니다.
                    </label>
                    <p className={styles.previewNote}>미리보기 확인은 15분간 유효합니다. 참가자·점수·대상 밴드·게시 이력이 바뀌면 다시 미리보기를 요청합니다.</p>
                </div>
                <div className={styles.previewActions}>
                    <button type="button" className={styles.cancelButton} onClick={close} disabled={busy !== null}>취소</button>
                    <button
                        type="button"
                        className={styles.confirmButton}
                        disabled={!approved || busy !== null || ['PENDING', 'UNKNOWN'].includes(preview.latestStatus || '')}
                        onClick={publish}
                    >
                        {busy === 'publish' ? '게시 중…' : '확인 후 BAND 게시'}
                    </button>
                </div>
            </>}
        </dialog>
    </>;
}
