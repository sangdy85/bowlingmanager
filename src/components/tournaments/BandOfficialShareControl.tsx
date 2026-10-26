'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { getBandSharePreviewAction } from '@/app/actions/band-share-actions';
import type { BandShareInput, BandSharePreview } from '@/app/actions/band-share-actions';
import { buildBandShareLinks, openBandSharePopup, BAND_SHARE_URL_BUDGET } from '@/lib/band/official-share';
import { bandShareImageFiles, canShareBandImages, createAnnouncementImages, saveBandShareImage } from '@/lib/band/share-images';
import type { BandShareImage } from '@/lib/band/share-images';
import { combineBandShareText } from '@/lib/band/share-caption';
import styles from './BandPublishStatus.module.css';

export default function BandOfficialShareControl({ centerId, tournamentId, roundId, type, week, buttonLabel = 'BAND 공유하기', onBusyChange, onPrepareImages }: BandShareInput & {
    buttonLabel?: string; onBusyChange?: (busy: boolean) => void;
    onPrepareImages?: () => Promise<BandShareImage[]>;
}) {
    const titleId = useId();
    const dialogRef = useRef<HTMLDialogElement>(null);
    const sequence = useRef(0);
    const busyRef = useRef(false);
    const [preview, setPreview] = useState<BandSharePreview | null>(null);
    const [text, setText] = useState('');
    const [belowText, setBelowText] = useState('');
    const sharedText = combineBandShareText(text, belowText);
    const [approved, setApproved] = useState(false);
    const [copied, setCopied] = useState('');
    const [loading, setBusy] = useState(false);
    const [imageBusy, setImageBusy] = useState(false);
    const [images, setImages] = useState<BandShareImage[]>([]);
    const [files, setFiles] = useState<File[]>([]);
    const busy = loading || imageBusy;
    const [message, setMessage] = useState('');
    const [mobile, setMobile] = useState(false);
    let links: ReturnType<typeof buildBandShareLinks> | null = null;
    try { links = buildBandShareLinks(sharedText); } catch { /* Invalid unicode must be corrected before sharing. */ }

    useEffect(() => {
        setMobile(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
            (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1));
    }, []);
    useEffect(() => {
        const requests = sequence;
        const dialog = dialogRef.current;
        requests.current++;
        busyRef.current = false;
        setBusy(false); setPreview(null); setText(''); setApproved(false); setCopied(''); setMessage('');
        setBelowText('');
        setImageBusy(false); setImages([]); setFiles([]);
        dialog?.close();
        return () => { requests.current++; dialog?.close(); };
    }, [centerId, tournamentId, roundId, type, week]);
    useEffect(() => {
        const dialog = dialogRef.current;
        if (preview && dialog && !dialog.open) dialog.showModal();
        if (!preview && dialog?.open) dialog.close();
    }, [preview]);
    useEffect(() => {
        onBusyChange?.(busy);
        return () => onBusyChange?.(false);
    }, [busy, onBusyChange]);

    const close = () => {
        sequence.current++; busyRef.current = false; setBusy(false);
        setImageBusy(false); setImages([]); setFiles([]);
        setPreview(null); setApproved(false); dialogRef.current?.close();
    };
    const load = async () => {
        if (busyRef.current) return;
        busyRef.current = true;
        const request = ++sequence.current;
        setBusy(true); setMessage(''); setApproved(false); setCopied('');
        setImages([]); setFiles([]);
        try {
            const result = await getBandSharePreviewAction({ centerId, tournamentId, roundId, type, week });
            if (request !== sequence.current) return;
            if (result.success) { setPreview(result.preview); setText(result.preview.shareText); setBelowText(result.preview.belowImageText); }
            else { setPreview(null); setMessage(result.message); }
        } catch {
            if (request === sequence.current) { setPreview(null); setMessage('공지를 준비하지 못했습니다. 로그인과 관리 권한을 확인해주세요.'); }
        } finally {
            if (request === sequence.current) { busyRef.current = false; setBusy(false); }
        }
    };
    const prepareImages = async () => {
        if (busyRef.current || !preview) return;
        busyRef.current = true; setImageBusy(true); setMessage(''); setImages([]); setFiles([]);
        const request = ++sequence.current;
        try {
            // Recheck manager permission and current completion before preparing images.
            const latest = await getBandSharePreviewAction({ centerId, tournamentId, roundId, type, week });
            if (request !== sequence.current) return;
            if (!latest.success) { setMessage(latest.message); return; }
            if (latest.preview.content !== preview.content || latest.preview.shareText !== preview.shareText || latest.preview.belowImageText !== preview.belowImageText) {
                setPreview(latest.preview); setText(latest.preview.shareText); setBelowText(latest.preview.belowImageText); setApproved(false);
                setMessage('경기 기록 또는 기본 문구가 변경되었습니다. 최신 공지를 다시 확인한 뒤 사진을 준비해주세요.'); return;
            }
            // Keep full participant/lane/result data in the image, even though
            // the default external caption is deliberately short.
            const prepared = onPrepareImages ? await onPrepareImages() : await createAnnouncementImages(preview.content);
            if (request !== sequence.current) return;
            if (!prepared.length) throw new Error('No images');
            const preparedFiles = bandShareImageFiles(prepared);
            setImages(prepared); setFiles(preparedFiles);
            setMessage('사진이 준비되었습니다. 저장 후 BAND에 첨부하거나, 지원되는 기기에서는 문구+사진 함께 공유를 이용해주세요.');
        } catch {
            if (request === sequence.current) setMessage('사진을 준비하지 못했습니다. 다시 시도하거나 기존 결과표 다운로드를 이용해주세요.');
        } finally {
            if (request === sequence.current) { busyRef.current = false; setImageBusy(false); }
        }
    };
    const nativeShare = async () => {
        if (!canShare || !canShareBandImages(files, sharedText)) return;
        const request = sequence.current;
        busyRef.current = true; setImageBusy(true);
        try {
            // Files are already prepared: invoke within the original user click,
            // before any await, so the browser retains transient activation.
            await navigator.share({ files, text: sharedText });
            if (request === sequence.current) setMessage('기기 공유창으로 전달했습니다. BAND 선택·사진과 문구 첨부·최종 게시 여부를 직접 확인해주세요. 게시 성공으로 기록하지 않습니다.');
        } catch (error) {
            if (request === sequence.current) setMessage(error instanceof Error && error.name === 'AbortError'
                ? '공유가 취소되었습니다. 사진을 저장해서 직접 첨부할 수도 있습니다.'
                : '기기에서 사진 공유를 완료하지 못했습니다. 사진 저장 후 BAND에서 직접 첨부해주세요.');
        } finally {
            if (request === sequence.current) { busyRef.current = false; setImageBusy(false); }
        }
    };
    const copy = async () => {
        const request = sequence.current;
        const content = sharedText;
        try {
            await navigator.clipboard.writeText(content);
            if (request === sequence.current) { setCopied(content); setMessage('공지 문구를 복사했습니다. BAND에서 붙여넣을 수 있습니다.'); }
        } catch {
            if (request === sequence.current) {
                setMessage('자동 복사가 차단됐습니다. 공지 입력란에서 전체 선택 후 직접 복사해주세요.');
            }
        }
    };
    const canShare = Boolean(preview && approved && !busy && links && sharedText);
    const webShare = () => {
        if (!canShare) return;
        try {
            setMessage(openBandSharePopup(sharedText)
                ? 'BAND 공유 화면을 열었습니다. BAND에서 대상 밴드를 선택하고 최종 게시해주세요. 게시 완료 여부는 확인할 수 없습니다.'
                : '팝업이 차단됐습니다. 아래 ‘새 탭에서 BAND 열기’를 이용하거나 문구를 복사해주세요.');
        } catch { setMessage('공유 창을 열지 못했습니다. 새 탭에서 열기 또는 문구 복사를 이용해주세요.'); }
    };

    return <>
        <div className={styles.control}>
            <button type="button" className={styles.button} disabled={busy} onClick={load}>{busy ? '공유 문구 준비 중…' : buttonLabel}</button>
            {!preview && message && <p role="status" className={styles.feedback}>{message}</p>}
        </div>
        <dialog ref={dialogRef} className={`${styles.previewDialog} ${styles.shareDialog}`} aria-labelledby={titleId}
            onCancel={event => { event.preventDefault(); close(); }}>
            {preview && <>
                <div className={styles.previewHeader}>
                    <div><h3 id={titleId}>BAND 공식 공유하기</h3><p>공지 확인·수정 → BAND에서 밴드 선택 → 관리자가 최종 게시</p></div>
                    <button type="button" className={styles.close} onClick={close} aria-label="공유 미리보기 닫기">✕</button>
                </div>
                <div className={styles.previewBody}>
                    <p className={styles.previewNote}>서버 조회: {new Date(preview.generatedAt).toLocaleString('ko-KR')}{preview.week ? ` · ${preview.week}주차` : ''}. 아래 문구를 수정할 수 있습니다. 기록 변경 후에는 새로 불러와 확인해주세요.</p>
                    <label className={styles.shareLabel} htmlFor={`${titleId}-text`}>공유할 공지 문구</label>
                    <p className={styles.previewNote}>대회명·주차(회차)·항목명과 사진 위 기본 문구입니다. 이번 공지에만 내용을 추가하거나 수정할 수 있습니다.</p>
                    <textarea id={`${titleId}-text`} className={`${styles.previewText} ${styles.shareEditor} ${styles.captionEditor}`} value={text} disabled={busy}
                        onChange={event => { setText(event.target.value); setApproved(false); setCopied(''); setMessage(''); setImages([]); setFiles([]); }} />
                    <p className={styles.previewNote}>{links ? `${links.contentBytes.toLocaleString('ko-KR')} UTF-8 바이트` : '공유할 수 없는 문자가 있습니다. 문구를 다시 입력해주세요.'}</p>
                    {links?.tooLong && <p role="status" className={styles.previewWarning}>전체 공지가 공유 URL 안전 기준({BAND_SHARE_URL_BUDGET.toLocaleString('ko-KR')}자)을 넘었습니다. 내용은 자르지 않습니다. ‘공지 문구 복사’ 후 빈 BAND 공유 화면에 붙여넣어주세요.{copied === sharedText ? ' 전체 문구 복사 완료.' : ''}</p>}
                    <section className={styles.imageArea} aria-label="BAND 첨부 사진">
                        <h4>📷 사진으로 함께 올리기</h4>
                        <p className={styles.previewNote}>{onPrepareImages ? '선택 주차의 공식 결과표 4종을 기존 다운로드와 같은 형식으로 준비합니다.' : '선택한 항목의 전체 내용을 PNG로 만듭니다. 짧은 안내 문구와 별도로 기록 전체를 유지합니다.'}</p>
                        <button type="button" className={styles.cancelButton} disabled={busy} onClick={prepareImages}>
                            {imageBusy ? '사진 처리 중…' : onPrepareImages ? '선택 주차 결과표 4종 준비' : '이 공지를 사진으로 만들기'}
                        </button>
                        {images.length > 0 && <>
                            <div className={styles.imageList}>{images.map((image, index) => <figure key={image.name}>
                                {/* Generated local PNG previews; no external image request. */}
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={image.dataUrl} alt={`${index + 1}번 첨부 사진: ${image.name}`} />
                                <figcaption><button type="button" className={styles.cancelButton} onClick={() => saveBandShareImage(image)} disabled={busy}>{image.name} 저장</button></figcaption>
                            </figure>)}</div>
                            <button type="button" className={styles.confirmButton} disabled={!canShare || !canShareBandImages(files, sharedText)} onClick={nativeShare}>문구+사진 함께 공유</button>
                            {!canShareBandImages(files, sharedText) && <p className={styles.previewNote}>이 브라우저는 사진 파일 공유를 지원하지 않습니다. 위 사진을 각각 저장한 뒤 BAND 글쓰기에서 사진을 선택해주세요.</p>}
                        </>}
                        <p className={styles.previewNote}>BAND 공식 웹·앱 공유 링크는 사진을 자동 첨부하지 않습니다. 기기 공유창에 BAND가 없거나 문구가 빠지면 사진 저장·공지 문구 복사 후 직접 첨부해주세요.</p>
                    </section>
                    <label className={styles.shareLabel} htmlFor={`${titleId}-below`}>사진 아래에 쓰기</label>
                    <textarea id={`${titleId}-below`} className={styles.settingsEditor} rows={3} value={belowText} disabled={busy}
                        placeholder="이번 공지에 추가할 안내 문구를 입력해주세요."
                        onChange={event => { setBelowText(event.target.value); setApproved(false); setCopied(''); setMessage(''); setImages([]); setFiles([]); }} />
                    <p className={styles.previewNote}>위·아래 문구를 함께 복사·공유합니다. BAND가 사진과 문구의 배치를 자동으로 맞추지는 않으므로, BAND에서 사진 첨부 후 위치를 확인해주세요.</p>
                    <label className={styles.approval}>
                        <input type="checkbox" checked={approved} disabled={busy} onChange={event => setApproved(event.target.checked)} />
                        선수 이름·팀·경기 기록의 공유 범위와 수정 문구를 확인했습니다. 비공개 자료나 불필요한 개인정보는 포함하지 않습니다.
                    </label>
                    <p className={styles.previewNote}>공유 화면을 여는 것은 게시 완료가 아닙니다. 실제 BAND 게시 완료 여부·알림 발송은 볼링매니저에서 확인하거나 기록하지 않습니다. 결과 링크의 기존 접근 권한도 유지됩니다.</p>
                    {message && <p role="status" className={styles.previewWarning}>{message}</p>}
                </div>
                <div className={styles.previewActions}>
                    <button type="button" className={styles.cancelButton} onClick={close}>닫기</button>
                    <button type="button" className={styles.cancelButton} disabled={busy} onClick={load}>최신 공지 다시 불러오기</button>
                    <button type="button" className={styles.cancelButton} disabled={busy || !sharedText} onClick={copy}>공지 문구 복사</button>
                    {mobile && <a className={`${styles.confirmButton} ${!canShare ? styles.shareDisabled : ''}`}
                        href={canShare ? links?.appUrl : undefined} aria-disabled={!canShare}
                        onClick={event => {
                            if (!canShare) { event.preventDefault(); return; }
                            setMessage('BAND 앱이 열리지 않으면 ‘BAND 웹 공유’를 이용해주세요. 게시 완료 여부는 확인할 수 없습니다.');
                        }}>{links?.tooLong ? 'BAND 앱 열고 붙여넣기' : 'BAND 앱으로 공유'}</a>}
                    <button type="button" className={styles.confirmButton} disabled={!canShare} onClick={webShare}>
                        {links?.tooLong ? 'BAND 열고 붙여넣기' : mobile ? 'BAND 웹 공유' : 'BAND 공유 화면 열기'}
                    </button>
                    {canShare && <a href={links?.webUrl} target="_blank" rel="noopener noreferrer" className={styles.cancelButton}>새 탭에서 BAND 열기</a>}
                </div>
            </>}
        </dialog>
    </>;
}
