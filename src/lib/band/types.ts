export type BandPostType = 'RECRUITMENT' | 'PARTICIPANTS' | 'LANE_ASSIGNMENT' | 'FINAL_RESULT' | 'LEAGUE_WEEKLY_RESULT';

export type BandSummary = {
    bandKey: string;
    name: string;
    cover: string | null;
    memberCount: number | null;
};

export type BandPostPreview = {
    bandName: string;
    bandKey: string;
    doPush: boolean;
    content: string;
    contentBytes: number;
    maxContentBytes: number;
    nextRevision: number;
    latestStatus: string | null;
    previewToken: string;
};

export type BandPublishOutcome = {
    status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
    message: string;
    postId?: string;
    postKey?: string;
    revision?: number;
    preview?: BandPostPreview;
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

export type ParticipantPostEntry = {
    name: string;
    team?: string | null;
    waitlisted?: boolean;
};

export type ParticipantPostData = {
    title: string;
    tournamentName: string;
    roundNumber?: number | null;
    participants: ParticipantPostEntry[];
    activeCount: number;
    waitlistCount: number;
    detailUrl: string;
};

export type LaneAssignmentPostEntry = {
    name: string;
    team?: string | null;
    lane: string;
};

export type LaneAssignmentPostData = {
    title: string;
    tournamentName: string;
    roundNumber?: number | null;
    entries: LaneAssignmentPostEntry[];
    detailUrl: string;
};

export type FinalResultEntry = {
    name: string;
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
