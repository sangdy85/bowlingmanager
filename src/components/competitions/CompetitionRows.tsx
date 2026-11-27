import Link from 'next/link';
import type { CompetitionNotice } from '@prisma/client';
import { noticeDateRange, noticePhase } from '@/lib/competition-notices';
import styles from './Competitions.module.css';

export default function CompetitionRows({rows, manage = false}: {rows: CompetitionNotice[]; manage?: boolean}) {
    return <div className={styles.board}>
        <div className={styles.boardHead} aria-hidden="true"><span>대회 · 주관사 · 장소</span><span>대회일자</span><span>접수일자</span><span>참가비</span></div>
        {rows.map(row => <Link key={row.id} className={styles.row} href={manage ? `/competitions/${row.id}/edit` : `/competitions/${row.id}`}>
            <div className={styles.rowTitle}><div className={styles.badges}><span className={styles.badge}>{manage && !row.published ? '비공개' : noticePhase(row)}</span><span className={`${styles.badge} ${styles.format}`}>{row.format}</span></div><h2>{row.title}</h2><p>{row.organizer} · {row.venue}</p></div>
            <div className={styles.date}><span className={styles.label}>대회</span>{noticeDateRange(row.startDate, row.endDate)}<p>{row.eventTime}</p></div>
            <div className={styles.date}><span className={styles.label}>접수</span>{noticeDateRange(row.registrationStartDate, row.registrationEndDate)}</div>
            <div className={styles.date}><span className={styles.label}>참가비</span>{row.fee}</div>
        </Link>)}
    </div>;
}
