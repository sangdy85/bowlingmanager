import bundle from '../../content/competition-notices/upcoming-schedules-20261019.json';
import { todayInKorea } from './competition-notices';

// Early announcements have no verified registration dates. Keep them outside the
// registered-notice model rather than filling required dates with invented values.
export function upcomingCompetitionSchedules(q: string, status: string, month?: string, today = todayInKorea()) {
    if (status === 'registering' || status === 'finished') return [];
    const query = q.toLocaleLowerCase('ko-KR');
    return bundle.entries.filter(entry => entry.endDate >= today
        && (!month || (entry.startDate <= month + '-31' && entry.endDate >= month + '-01'))
        && (!query || [entry.title, entry.organizer, entry.venue].join(' ').toLocaleLowerCase('ko-KR').includes(query)));
}
export const competitionSchedulesCheckedAt = bundle.checkedAt;
