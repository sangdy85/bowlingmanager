import type {
    FinalResultPostData,
    LaneAssignmentPostData,
    ParticipantPostData,
    RecruitmentPostData,
} from './types';

function formatDate(value: Date | string): string {
    return new Intl.DateTimeFormat('ko-KR', {
        timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
        weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).format(new Date(value));
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
    lines.push('', '📝 참가신청 및 상세정보', data.detailUrl, '', 'BowlingManager 자동 안내');
    return lines.join('\n');
}

export function buildParticipantPost(data: ParticipantPostData): string {
    const lines = [
        `👥 [${data.title}]`,
        '',
        data.tournamentName,
    ];
    if (data.roundNumber) lines.push(`${data.roundNumber}회차`);
    lines.push('', `참가 ${data.activeCount}명${data.waitlistCount ? ` · 대기 ${data.waitlistCount}명` : ''}`, '');

    data.participants.forEach((participant, index) => {
        const team = participant.team ? ` · ${participant.team}` : '';
        const waiting = participant.waitlisted ? ' [대기]' : '';
        lines.push(`${index + 1}. ${participant.name}${team}${waiting}`);
    });

    lines.push('', '📋 상세 명단 보기', data.detailUrl, '', 'BowlingManager 참가자 안내');
    return lines.join('\n');
}

export function buildLaneAssignmentPost(data: LaneAssignmentPostData): string {
    const lines = [
        `🎳 [${data.title}]`,
        '',
        data.tournamentName,
    ];
    if (data.roundNumber) lines.push(`${data.roundNumber}회차`);
    lines.push('', `레인 배정 ${data.entries.length}명`, '');

    data.entries.forEach((entry, index) => {
        const team = entry.team ? ` · ${entry.team}` : '';
        lines.push(`${index + 1}. ${entry.name}${team} · ${entry.lane}`);
    });

    lines.push('', '📋 레인 배정 상세 보기', data.detailUrl, '', 'BowlingManager 레인 안내');
    return lines.join('\n');
}

export function buildFinalResultPost(data: FinalResultPostData): string {
    const lines = [
        `🏆 [${data.title}]`,
        '',
        data.tournamentName,
    ];
    if (data.roundNumber) lines.push(`${data.roundNumber}회차`);
    const medals = ['🥇', '🥈', '🥉'];
    data.results.slice(0, 3).forEach((result, index) => {
        lines.push('', `${medals[index]} ${index + 1}위 ${result.name}`);
        const average = result.average == null ? '' : ` / AVG ${result.average.toFixed(1)}`;
        lines.push(`${Math.round(result.total).toLocaleString('ko-KR')}점${average}`);
    });
    lines.push('', `👥 참가자 ${data.participantCount}명`, '', '📊 전체 결과 보기', data.detailUrl, '', 'BowlingManager 자동 결과');
    return lines.join('\n');
}
