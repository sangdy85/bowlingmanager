'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { previewBandPostAction, publishBandPostAction } from '@/app/actions/band-actions';
import type { BandPostPreview, BandPostType } from '@/lib/band/types';
import styles from './BandShareButton.module.css';

export default function BandShareButton({
    centerId,
    tournamentId,
    roundId,
    type,
    label = 'BAND에 공유',
    connected,
    bandName,
}: {
    centerId: string;
    tournamentId: string;
    roundId?: string | null;
    type: BandPostType;
    label?: string;
    connected: boolean;
    bandName?: string | null;
}) {
    const router = useRouter();
    const [preview, setPreview] = useState<BandPostPreview | null>(null);
    const [busy, setBusy] = useState<'preview' | 'publish' | null>(null);
    const [message, setMessage] = useState('');
    const [isError, setIsError] = useState(false);

    const loadPreview = async () => {
        if (!connected || busy) return;
        setBusy('preview');
        setMessage('');
        setIsError(false);
        try {
            const result = await previewBandPostAction({
                centerId,
                tournamentId,
                roundId,
                type,
            });
            if (!result.success || !result.preview) {
                setMessage(result.message);
                setIsError(true);
                return;
            }
            setPreview(result.preview);
        } catch {
            setMessage('BAND 게시 미리보기를 만들지 못했습니다.');
            setIsError(true);
        } finally {
            setBusy(null);
        }
    };

    const publish = async () => {
        if (!preview || busy) return;
        setBusy('publish');
        setMessage('');
        setIsError(false);
        try {
            const result = await publishBandPostAction({
                centerId,
                tournamentId,
                roundId,
                type,
                previewContent: preview.content,
            });
            setMessage(result.message);
            setIsError(!result.success);
            if (result.success) {
                router.refresh();
            } else if (result.message.includes('미리보기')) {
                setPreview(null);
            }
        } catch {
            setMessage('BAND 게시 요청을 처리하지 못했습니다.');
            setIsError(true);
        } finally {
            setBusy(null);
        }
    };

    const close = () => {
        if (busy === 'publish') return;
        setPreview(null);
        setMessage('');
        setIsError(false);
    };

    return (
        <div className={styles.wrapper}>
            <button
                type="button"
                className={styles.shareButton}
                onClick={loadPreview}
                disabled={!connected || busy !== null}
                title={connected ? `${bandName || '선택한 BAND'} 게시 미리보기` : '볼링장 설정에서 NAVER BAND를 먼저 연결해주세요.'}
            >
                <span aria-hidden="true">📣</span>
                {busy === 'preview' ? '미리보기 생성 중…' : label}
            </button>
            {!connected && <span className={styles.disconnected}>BAND 연결 필요</span>}
            {message && !preview && (
                <span className={`${styles.inlineMessage} ${isError ? styles.error : ''}`} role="status">
                    {message}
                </span>
            )}

            {preview && (
                <div className={styles.backdrop} role="presentation" onMouseDown={event => {
                    if (event.target === event.currentTarget) close();
                }}>
                    <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="band-preview-title">
                        <header className={styles.header}>
                            <div>
                                <p className={styles.eyebrow}>NAVER BAND PREVIEW</p>
                                <h2 id="band-preview-title">게시 미리보기</h2>
                                <p>{bandName || '선택한 BAND'} · {preview.label}</p>
                            </div>
                            <button type="button" className={styles.closeButton} onClick={close} aria-label="미리보기 닫기">×</button>
                        </header>

                        <div className={styles.notice}>
                            게시 버튼을 누를 때 최신 DB를 다시 확인합니다. 내용이 바뀌었으면 게시하지 않고 새 미리보기를 요청합니다.
                        </div>

                        <textarea
                            className={styles.preview}
                            value={preview.content}
                            readOnly
                            aria-label="BAND 게시 본문 미리보기"
                        />

                        {message && (
                            <p className={`${styles.message} ${isError ? styles.error : ''}`} role="status">
                                {message}
                            </p>
                        )}

                        <footer className={styles.actions}>
                            <button type="button" className={styles.secondary} onClick={close} disabled={busy === 'publish'}>
                                취소
                            </button>
                            <button type="button" className={styles.secondary} onClick={loadPreview} disabled={busy !== null}>
                                최신 내용 다시 불러오기
                            </button>
                            <button type="button" className={styles.primary} onClick={publish} disabled={busy !== null}>
                                {busy === 'publish' ? '게시 중…' : '이 내용으로 BAND에 게시'}
                            </button>
                        </footer>
                    </section>
                </div>
            )}
        </div>
    );
}
