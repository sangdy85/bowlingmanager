export type BandPostType =
    | 'RECRUITMENT'
    | 'PARTICIPANTS'
    | 'LANE_ASSIGNMENT'
    | 'LEAGUE_WEEKLY_RESULT'
    | 'FINAL_RESULT';

export type BandSummary = {
    bandKey: string;
    name: string;
    cover: string | null;
    memberCount: number | null;
};

export type BandPublishOutcome = {
    status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
    message: string;
    postId?: string;
    postKey?: string;
    revision?: number;
};

export type BandPostPreview = {
    type: BandPostType;
    label: string;
    content: string;
    centerId: string;
    tournamentId: string;
    roundId: string | null;
};

export type RecruitmentPostData = {
    title: string;
    tournamentName: string;
    centerName: string;
    centerAddress?: string | null;
    date?: Date | string | null;
    roundNumber?: number | null;
    gameMethod?: string | null;
    participantCount: number;
    maxParticipants?: number | null;
    entryFeeText?: string | null;
    detailUrl: string;
};

export type FinalResultEntry = {
    name: string;
    team?: string | null;
    total: number;
    average?: number | null;
};

export type FinalResultPostData = {
    title: string;
    tournamentName: string;
    roundNumber?: number | null;
    results: FinalResultEntry[];
    participantCount: number;
    detailUrl: string;
};

export type ParticipantPostEntry = {
    name: string;
    team?: string | null;
    waitlisted?: boolean;
};

export type ParticipantPostData = {
    tournamentName: string;
    roundNumber?: number | null;
    participants: ParticipantPostEntry[];
    detailUrl: string;
};

export type LanePostEntry = {
    name: string;
    team?: string | null;
    lane: string;
};

export type LanePostData = {
    tournamentName: string;
    roundNumber?: number | null;
    entries: LanePostEntry[];
    detailUrl: string;
};

export type LeagueMatchResult = {
    teamA: string;
    teamB: string;
    pointsA: number;
    pointsB: number;
};

export type LeagueWeeklyPostData = {
    tournamentName: string;
    roundNumber: number;
    teamStandings: Array<{ name: string; wins: number; totalPinfall: number }>;
    individualStandings: Array<{ name: string; teamName: string; average: number; totalPins: number }>;
    matchResults: LeagueMatchResult[];
    averageTop: Array<{ name: string; teamName: string; average: number }>;
    detailUrl: string;
};
