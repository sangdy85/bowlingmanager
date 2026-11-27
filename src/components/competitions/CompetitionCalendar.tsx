import Link from 'next/link';
import type { CompetitionNotice } from '@prisma/client';
import { calendarDays, noticeDateKey, todayInKorea } from '@/lib/competition-notices';
import styles from './Competitions.module.css';

export default function CompetitionCalendar({month, rows}: {month: string; rows: CompetitionNotice[]}) {
    const today = todayInKorea();
    return <div className={styles.calendar} aria-label={`${month} 대회 일정 달력`}>
        <div className={styles.weekdays} aria-hidden="true">{['일','월','화','수','목','금','토'].map(day => <span key={day}>{day}</span>)}</div>
        <div className={styles.days}>{calendarDays(month).map(date => {
            const key = noticeDateKey(date);
            const entries = key.startsWith(month) ? rows.filter(row => noticeDateKey(row.startDate) <= key && noticeDateKey(row.endDate) >= key) : [];
            return <div key={key} className={styles.day} data-outside={!key.startsWith(month)} data-today={key === today}>
                <time className={styles.dayNumber} dateTime={key} aria-label={key}>{date.getUTCDate()}</time>
                {entries.map(row => <Link className={styles.calendarEvent} href={`/competitions/${row.id}`} key={row.id} aria-label={`${key} ${row.title}, ${row.venue}`}>{row.title}<span>{row.eventTime}</span></Link>)}
            </div>;
        })}</div>
    </div>;
}
