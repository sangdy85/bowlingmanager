export type BandShareTable = {
    kind: 'PARTICIPANTS' | 'LANE_ASSIGNMENT' | 'FINAL_RESULT';
    title: string;
    columns: { label: string; width: number; bold?: boolean }[];
    rows: { cells: string[]; highlight?: boolean; redColumns?: number[] }[];
    twoColumns: boolean;
    rowUnit?: '명' | '팀';
};
