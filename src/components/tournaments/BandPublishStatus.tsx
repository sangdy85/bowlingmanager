'use client';

import BandPublishControl from './BandPublishControl';
import BandOfficialShareControl from './BandOfficialShareControl';
import BandUncertainResolution from './BandUncertainResolution';
import type { BandPostType } from '@/lib/band/types';
import styles from './BandPublishStatus.module.css';

type History = {
    id: string;
    type: string;
    status: string;
    revision: number;
    createdAt: string;
    postedAt: string | null;
    errorMessage: string | null;
};

export default function BandPublishStatus({ centerId, tournamentId, roundId, connected, posts, configured }: {
    centerId: string;
    tournamentId: string;
    roundId?: string | null;
    connected: boolean;
    configured: boolean;
    posts: History[];
}) {
    const items: { type: BandPostType; label: string }[] = roundId
        ? [
            { type: 'RECRUITMENT', label: '회차 모집 안내' },
            { type: 'PARTICIPANTS', label: '참가자 명단' },
            { type: 'LANE_ASSIGNMENT', label: '레인 배정' },
            { type: 'FINAL_RESULT', label: '최종 결과' },
        ]
        : [
            { type: 'RECRUITMENT', label: '모집 안내' },
            { type: 'FINAL_RESULT', label: '최종 결과' },
        ];

    return <section className={styles.panel} aria-label="BAND 게시 상태">
        <h3 className={styles.title}>NAVER BAND 공유 및 게시</h3>
        <p className={styles.hint}>
            BAND 공유하기: 사용 가능 · 자동 게시: {configured ? (connected ? '연결됨' : 'BAND 연결 필요') : 'API 승인 필요'}. 공지를 확인·수정한 뒤 BAND에서 직접 게시합니다.
        </p>
        <div className={styles.list}>{items.map(item => {
            const latest = posts.find(post => post.type === item.type);
            return <div className={styles.item} key={item.type}>
                <div className={styles.meta}>
                    <span className={styles.name}>{item.label}</span>
                    {latest
                        ? <><span className={`${styles.badge} ${styles[latest.status] || ''}`}>{latest.status}</span>
                            v{latest.revision} · {new Date(latest.postedAt || latest.createdAt).toLocaleString('ko-KR')}
                            {latest.errorMessage ? ` · ${latest.errorMessage}` : ''}</>
                        : 'API 게시 이력 없음'}
                </div>
                <BandOfficialShareControl centerId={centerId} tournamentId={tournamentId} roundId={roundId} type={item.type} buttonLabel={item.label + ' · BAND 공유하기'} />
                <details className={styles.apiDetails}>
                    <summary>공식 API 게시 · {configured ? '기존 연결 기능' : 'API 승인 필요'}</summary>
                <BandPublishControl
                    centerId={centerId}
                    tournamentId={tournamentId}
                    roundId={roundId}
                    type={item.type}
                    connected={configured && connected}
                    buttonLabel={latest ? '미리보기 · 다시 게시' : '미리보기 · BAND 게시'}
                />
                </details>
                {latest && <BandUncertainResolution centerId={centerId} post={latest} />}
            </div>;
        })}</div>
    </section>;
}
