export type BandPostType = 'RECRUITMENT' | 'FINAL_RESULT';

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
