import type {
    FinalResultPostData,
    LanePostData,
    LeagueWeeklyPostData,
    ParticipantPostData,
    RecruitmentPostData,
} from './types';

function formatDate(value: Date | string): string {
    return new Intl.DateTimeFormat('ko-KR', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    }).format(new Date(value));
}

function roundLabel(roundNumber?: number | null) {
    return roundNumber ? `${roundNumber}회차` : '';
}

function numbered(lines: string[], values: string[]) {
    values.forEach((value, index) => lines.push(`${index + 1}. ${value}`));
}

export function buildRecruitmentPost(data: RecruitmentPostData): string {
    const lines = [
        `🎳 [${data.title}]`,
        '',
        data.tournamentName,
    ];
    if (data.centerName) lines.push('', '📍 장소', [data.centerName, data.centerAddress].filter(Boolean).join(' · '));
    if (data.date) lines.push('', '📅 경기일', `${data.roundNumber ? `${data.roundNumber}회차 · ` : ''}${formatDate(data.date)}`);
    if (data.gameMethod) lines.push('', '🎳 경기 방식', data.gameMethod);
    const capacity = data.maxParticipants && data.maxParticipants > 0 ? ` / 정원 ${data.maxParticipants}명` : '';
    lines.push('', '👥 모집', `현재 ${data.participantCount}명${capacity}`);
    if (data.entryFeeText) lines.push('', '💰 참가비', data.entryFeeText);
    lines.push('', '📝 참가신청 및 상세정보', data.detailUrl, '', 'BowlingManager');
    return lines.join('\n');
}

export function buildParticipantListPost(data: ParticipantPostData): string {
    const lines = [
        '👥 [참가자 모집 현황]',
        '',
        [data.tournamentName, roundLabel(data.roundNumber)].filter(Boolean).join(' · '),
        '',
        `현재 참가자 ${data.participants.length}명`,
    ];
    if (data.participants.length) {
        lines.push('');
        numbered(lines, data.participants.map(person => {
            const team = person.team ? ` · ${person.team}` : '';
            const wait = person.waitlisted ? ' · 대기' : '';
            return `${person.name}${team}${wait}`;
        }));
    } else {
        lines.push('', '등록된 참가자가 없습니다.');
    }
    lines.push('', '🔎 상세 보기', data.detailUrl, '', 'BowlingManager');
    return lines.join('\n');
}

export function buildLaneAssignmentPost(data: LanePostData): string {
    const lines = [
        '🎳 [레인 배정 안내]',
        '',
        [data.tournamentName, roundLabel(data.roundNumber)].filter(Boolean).join(' · '),
    ];
    if (data.entries.length) {
        lines.push('');
        data.entries.forEach((entry, index) => {
            const team = entry.team ? ` · ${entry.team}` : '';
            lines.push(`${index + 1}. ${entry.name}${team} · ${entry.lane}`);
        });
    } else {
        lines.push('', '공개할 레인 배정이 없습니다.');
    }
    lines.push('', '🔎 상세 보기', data.detailUrl, '', 'BowlingManager');
    return lines.join('\n');
}

export function buildFinalResultPost(data: FinalResultPostData): string {
    const lines = [
        `🏆 [${data.title}]`,
        '',
        [data.tournamentName, roundLabel(data.roundNumber)].filter(Boolean).join(' · '),
    ];
    const medals = ['🥇', '🥈', '🥉'];
    data.results.forEach((result, index) => {
        const medal = medals[index] || `${index + 1}위`;
        const team = result.team ? ` · ${result.team}` : '';
        const average = result.average == null ? '' : ` · AVG ${result.average.toFixed(1)}`;
        lines.push('', `${medal} ${index + 1}위 ${result.name}${team}`, `${Math.round(result.total).toLocaleString('ko-KR')}점${average}`);
    });
    lines.push('', `👥 참가자 ${data.participantCount}명`, '', '📊 전체 결과 보기', data.detailUrl, '', 'BowlingManager');
    return lines.join('\n');
}

export function buildLeagueWeeklyResultPost(data: LeagueWeeklyPostData): string {
    const lines = [
        `🎳 [${data.tournamentName} · ${data.roundNumber}주차 경기 결과]`,
        '',
        '🏆 팀 순위',
    ];

    data.teamStandings.slice(0, 10).forEach((team, index) => {
        lines.push(`${index + 1}위 ${team.name} · 승점 ${team.wins} · ${Math.round(team.totalPinfall).toLocaleString('ko-KR')}핀`);
    });

    lines.push('', '👤 개인 순위');
    data.individualStandings.slice(0, 10).forEach((person, index) => {
        lines.push(`${index + 1}위 ${person.name} · ${person.teamName} · AVG ${person.average.toFixed(1)}`);
    });

    lines.push('', `📋 ${data.roundNumber}주차 경기 결과`);
    data.matchResults.forEach(result => {
        lines.push(`${result.teamA} ${result.pointsA} : ${result.pointsB} ${result.teamB}`);
    });

    lines.push('', '🔥 개인 에버 TOP');
    data.averageTop.slice(0, 10).forEach((person, index) => {
        lines.push(`${index + 1}. ${person.name} · ${person.teamName} · AVG ${person.average.toFixed(1)}`);
    });

    lines.push('', '🔎 전체 결과 보기', data.detailUrl, '', 'BowlingManager');
    return lines.join('\n');
}
