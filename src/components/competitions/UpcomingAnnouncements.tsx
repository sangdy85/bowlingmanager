import { upcomingCompetitionSchedules, competitionSchedulesCheckedAt } from '@/lib/competition-schedules';
import styles from './UpcomingAnnouncements.module.css';

export default function UpcomingAnnouncements({ q, status, month }: { q: string; status: string; month?: string }) {
    const entries = upcomingCompetitionSchedules(q, status, month);
    if (!entries.length) return null;
    return <section className={styles.section} aria-labelledby="upcoming-announcements-title">
        <header><span className={styles.label}>공식 일정 사전 안내 · {entries.length}건</span><h2 id="upcoming-announcements-title">다음으로 만날 대회</h2><p>개최 일정은 공개됐지만 접수 세부 요강을 더 확인해야 하는 소식입니다. 접수 중인 대회와 구분해 확인하세요.</p></header>
        <div className={styles.list}>{entries.map(entry => <article className={styles.article} key={entry.slug} id={entry.slug}>
            <div className={styles.meta}><time dateTime={entry.startDate}>{entry.startDate}{entry.endDate !== entry.startDate && ' ~ ' + entry.endDate}</time><span>접수 요강 확인 필요</span></div>
            <h3>{entry.title}</h3><p className={styles.venue}>{entry.venue}</p><p>{entry.summary}</p>
            <nav className={styles.sources} aria-label={entry.title + ' 공식 대회 링크'}><strong>공식 대회 링크</strong>{entry.sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">{source.label} ↗</a>)}</nav>
            <details><summary>일정 안내 자세히 읽기</summary><div className={styles.body}>{entry.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}<p className={styles.credit}>주관: {entry.organizer} · 원문 확인: {competitionSchedulesCheckedAt}</p></div></details>
        </article>)}</div>
    </section>;
}
