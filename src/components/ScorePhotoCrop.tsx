'use client';

import { useEffect, useRef, useState } from 'react';
import type { ScoreImageCrop } from '@/lib/score-image-crop';
import styles from './ScorePhotoCrop.module.css';

export default function ScorePhotoCrop({ file, value, disabled, onChange }: {
    file: File; value?: ScoreImageCrop; disabled: boolean; onChange: (value?: ScoreImageCrop) => void;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const start = useRef<{ x: number; y: number } | null>(null);
    const [image, setImage] = useState<HTMLImageElement | null>(null);
    const [draft, setDraft] = useState<ScoreImageCrop | undefined>();
    const [failed, setFailed] = useState(false);
    const [selecting, setSelecting] = useState(false);
    useEffect(() => {
        setImage(null); setDraft(undefined); setSelecting(false);
        const url = URL.createObjectURL(file), next = new window.Image();
        let active = true;
        next.onload = () => { if (active) { setImage(next); setFailed(false); } };
        next.onerror = () => { if (active) setFailed(true); };
        next.src = url;
        return () => { active = false; URL.revokeObjectURL(url); };
    }, [file]);
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !image) return;
        const width = Math.min(image.naturalWidth, 1100), height = Math.round(width * image.naturalHeight / image.naturalWidth);
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(image, 0, 0, width, height);
        const selected = draft ?? value;
        if (!selected) return;
        const x = selected.x * width, y = selected.y * height, w = selected.width * width, h = selected.height * height;
        ctx.fillStyle = 'rgba(0,0,0,0.46)';
        ctx.fillRect(0,0,width,y); ctx.fillRect(0,y,x,h); ctx.fillRect(x+w,y,width-x-w,h); ctx.fillRect(0,y+h,width,height-y-h);
        ctx.strokeStyle = '#14b8a6'; ctx.lineWidth = 3; ctx.strokeRect(x,y,w,h);
    }, [image, draft, value]);
    const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        return { x: Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width)), y: Math.max(0,Math.min(1,(e.clientY-rect.top)/rect.height)) };
    };
    const selection = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const from = start.current!, to = point(e);
        return { x: Math.min(from.x,to.x), y: Math.min(from.y,to.y), width: Math.abs(from.x-to.x), height: Math.abs(from.y-to.y) };
    };
    return <section className={styles.root} aria-label="점수 사진 영역 선택">
        <div className={styles.instructions}><strong>원본 사진</strong><span>이름·게임 제목·점수 칸이 함께 들어가도록 드래그하면 그 영역만 분석합니다.</span>
            <button type="button" className="btn btn-secondary" disabled={disabled || !image} onClick={() => { setSelecting(!selecting); setDraft(undefined); }}>{selecting ? '선택 취소' : '영역 선택'}</button>
            {image && <a className="btn btn-secondary" href={image.src} target="_blank" rel="noreferrer">원본 확대</a>}
            <button type="button" className="btn btn-secondary" disabled={disabled || !value} onClick={() => { setDraft(undefined); onChange(undefined); }}>전체 사진 사용</button>
        </div>
        {failed ? <p role="alert">미리보기를 읽지 못했습니다. JPEG 또는 PNG 사진을 선택해주세요.</p> : <div className={styles.viewport}>
            <canvas ref={canvasRef} aria-label="드래그하여 점수표 영역 선택" className={styles.canvas} style={{touchAction:selecting?'none':'pan-y',cursor:selecting?'crosshair':'default'}}
                onPointerDown={e => { if (disabled || !image || !selecting) return; start.current=point(e); e.currentTarget.setPointerCapture(e.pointerId); }}
                onPointerMove={e => { if (start.current && !disabled && selecting) setDraft(selection(e)); }}
                onPointerUp={e => { if (!start.current || disabled || !selecting) return; const next=selection(e); start.current=null; setDraft(undefined); if(next.width>=0.02&&next.height>=0.02){onChange(next);setSelecting(false);} }}
                onPointerCancel={() => { start.current=null; setDraft(undefined); }} />
        </div>}
        {value && <p className={styles.note}>선택한 영역으로 분석합니다. 원본 파일은 유지됩니다.</p>}
    </section>;
}
