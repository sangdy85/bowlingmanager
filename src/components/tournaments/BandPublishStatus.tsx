'use client';

import BandPublishControl from './BandPublishControl';
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

export default function BandPublishStatus({ centerId, tournamentId, roundId, connected, posts }: {
    centerId: string;
    tournamentId: string;
    roundId?: string | null;
    connected: boolean;
    posts: History[];
}) {
    const items: { type: BandPostType; label: string }[] = roundId
        ? [
            { type: 'PARTICIPANTS', label: '참가자 명단' },
            { type: 'LANE_ASSIGNMENT', label: '레인 배정' },
            { type: 'FINAL_RESULT', label: '최종 결과' },
        ]
        : [
            { type: 'RECRUITMENT', label: '모집 안내' },
            { type: 'FINAL_RESULT', label: '최종 결과' },
        ];

    return <section className={styles.panel} aria-label="BAND 게시 상태">
        <h3 className={styles.title}>NAVER BAND 게시</h3>
        <p className={styles.hint}>
            {connected
                ? '게시할 대상 밴드와 공지 내용을 미리 확인한 후 게시할 수 있습니다.'
                : '볼링장 설정에서 BAND를 연결하고 게시 대상을 선택해주세요.'}
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
                        : '게시 이력 없음'}
                </div>
                <BandPublishControl
                    centerId={centerId}
                    tournamentId={tournamentId}
                    roundId={roundId}
                    type={item.type}
                    connected={connected}
                    buttonLabel={latest ? '미리보기 · 다시 게시' : '미리보기 · BAND 게시'}
                />
                {latest && <BandUncertainResolution centerId={centerId} post={latest} />}
            </div>;
        })}</div>
    </section>;
}
