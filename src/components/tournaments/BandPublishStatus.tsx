'use client';

import { useState } from 'react';
import { publishBandPostAction } from '@/app/actions/band-actions';
import type { BandPostType } from '@/lib/band/types';
import styles from './BandPublishStatus.module.css';

type History = { id: string; type: string; status: string; revision: number; createdAt: string; postedAt: string | null; errorMessage: string | null };

export default function BandPublishStatus({ centerId, tournamentId, roundId, connected, posts }: {
    centerId: string; tournamentId: string; roundId?: string | null; connected: boolean; posts: History[];
}) {
    const [busy, setBusy] = useState<string | null>(null);
    const [message, setMessage] = useState('');
    const items: { type: BandPostType; label: string }[] = [
        { type: 'RECRUITMENT', label: '모집 안내' }, { type: 'FINAL_RESULT', label: '최종 결과' },
    ];
    return <section className={styles.panel} aria-label="BAND 게시 상태">
        <h3 className={styles.title}>NAVER BAND 게시</h3>
        <p className={styles.hint}>{connected ? '자동 게시 이력과 수동 재게시를 관리합니다.' : '볼링장 설정에서 BAND를 연결하고 게시 대상을 선택해주세요.'}</p>
        {message && <p className={styles.hint}>{message}</p>}
        <div className={styles.list}>{items.map(item => {
            const latest = posts.find(post => post.type === item.type);
            return <div className={styles.item} key={item.type}>
                <div className={styles.meta}><span className={styles.name}>{item.label}</span>
                    {latest ? <><span className={`${styles.badge} ${styles[latest.status] || ''}`}>{latest.status}</span>v{latest.revision} · {new Date(latest.postedAt || latest.createdAt).toLocaleString('ko-KR')}{latest.errorMessage ? ` · ${latest.errorMessage}` : ''}</> : '게시 이력 없음'}
                </div>
                <button className={styles.button} disabled={!connected || busy === item.type} onClick={async () => {
                    setBusy(item.type);
                    try {
                        const result = await publishBandPostAction({ centerId, tournamentId, roundId, type: item.type });
                        setMessage(result.message);
                    } catch {
                        setMessage('BAND 게시 요청을 처리하지 못했습니다. 로그인과 관리 권한을 확인해주세요.');
                    } finally {
                        setBusy(null);
                    }
                }}>{latest ? '다시 게시' : 'BAND 게시'}</button>
            </div>;
        })}</div>
    </section>;
}
