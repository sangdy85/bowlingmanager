'use server';

import prisma from '@/lib/prisma';
import { verifyCenterAdmin } from '@/lib/auth-utils';
import { prepareBandAnnouncement } from '@/lib/band/announcement';
import type { BandPostType } from '@/lib/band/types';
import { buildBandShareCaption, readBandShareDefaults } from '@/lib/band/share-caption';
import { getBandShareTableData } from '@/lib/band/share-table-data';
import type { BandShareTable } from '@/lib/band/share-table';

export type BandShareInput = {
    centerId: string;
    tournamentId: string;
    roundId?: string | null;
    week?: number;
    type: BandPostType;
};
export type BandSharePreview = {
    content: string;
    shareText: string;
    belowImageText: string;
    generatedAt: string;
    roundId: string | null;
    week: number | null;
    table?: BandShareTable;
};

// Read-only and deliberately separate from the OAuth publisher. Never reads a
// connection/token, writes a BandPost, or calls any external service.
export async function getBandSharePreviewAction(input: BandShareInput): Promise<
    { success: true; preview: BandSharePreview } | { success: false; message: string }
> {
    try {
        const validId = (value: unknown) => typeof value === 'string' && value.trim().length > 0 && value.length <= 200;
        if (!input || !validId(input.centerId) || !validId(input.tournamentId) ||
            (input.roundId != null && !validId(input.roundId)) ||
            !['RECRUITMENT', 'PARTICIPANTS', 'LANE_ASSIGNMENT', 'FINAL_RESULT', 'LEAGUE_WEEKLY_RESULT'].includes(input.type)) {
            return { success: false, message: '공지 대상 정보를 확인해주세요.' };
        }
        await verifyCenterAdmin(input.centerId);
        const tournament = await prisma.tournament.findUnique({
            where: { id: input.tournamentId },
            select: {
                id: true, name: true, centerId: true, type: true, settings: true, maxParticipants: true, startDate: true,
                leagueRounds: {
                    where: { id: input.roundId || '' },
                    select: {
                        id: true, roundNumber: true, date: true,
                        participants: { select: { registrationId: true, createdAt: true } },
                        individualScores: { select: { registrationId: true, gameNumber: true, score: true } },
                    },
                },
            },
        });
        if (!tournament || tournament.centerId !== input.centerId) {
            return { success: false, message: '해당 볼링장의 대회를 확인할 수 없습니다.' };
        }
        const round = tournament.leagueRounds[0];
        if (input.roundId && !round) return { success: false, message: '대회에 속한 회차를 선택해주세요.' };
        if (input.type === 'LEAGUE_WEEKLY_RESULT') {
            if (tournament.type !== 'LEAGUE' || !round || !Number.isSafeInteger(input.week) ||
                !input.week || input.week < 1 || round.roundNumber !== input.week) {
                return { success: false, message: '선택 주차와 회차 정보가 일치하지 않습니다.' };
            }
        } else if (input.type !== 'RECRUITMENT') {
            if (!['CHAMP', 'EVENT'].includes(tournament.type) || !round) {
                return { success: false, message: '챔프전·이벤트전의 회차를 선택해주세요.' };
            }
        }
        if (input.type === 'FINAL_RESULT' && round) {
            // LeagueRound has no separate result-finalized flag. Use stored score
            // completeness for every active participant, excluding the waitlist.
            const settings = tournament.settings ? JSON.parse(tournament.settings) : {};
            const gameCount = settings.gameCount ?? 3;
            const limit = settings.roundMaxParticipants?.[round.roundNumber] ?? tournament.maxParticipants;
            const ordered = [...round.participants].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
            const active = limit > 0 ? ordered.slice(0, limit) : ordered;
            if (!Number.isSafeInteger(gameCount) || gameCount < 1 || gameCount > 100 || !active.length ||
                active.some(participant => Array.from({ length: gameCount }, (_, i) => i + 1).some(game =>
                    !round.individualScores.some(score => score.registrationId === participant.registrationId &&
                        score.gameNumber === game && Number.isInteger(score.score) && score.score >= 0 && score.score <= 300)))) {
                return { success: false, message: '실제 참가자 전원의 경기 점수 입력이 완료된 후 최종 결과를 공유할 수 있습니다.' };
            }
        }
        // Only target identifiers cross this boundary; never accept client scores,
        // rankings, body, or history revision as an authoritative announcement.
        const built = await prepareBandAnnouncement({
            tournamentId: tournament.id, roundId: round?.id, week: input.week, type: input.type,
            allFinalResults: true,
        });
        if (built.status !== 'SUCCESS') return { success: false, message: built.message };
        if (built.centerId !== input.centerId) return { success: false, message: '공지 대상이 변경되었습니다. 다시 확인해주세요.' };
        const table = round && ['PARTICIPANTS', 'LANE_ASSIGNMENT', 'FINAL_RESULT'].includes(input.type)
            ? await getBandShareTableData(tournament.id, round.id, input.type as BandShareTable['kind'], input.centerId) : undefined;
        const generatedAt = new Date();
        return { success: true, preview: {
            content: built.content,
            ...(table ? { table } : {}),
            ...buildBandShareCaption(tournament.name, round?.roundNumber ?? null, input.type, readBandShareDefaults(tournament.settings), {
                eventDate: round?.date ?? tournament.startDate, now: generatedAt,
            }),
            generatedAt: generatedAt.toISOString(),
            roundId: round?.id || null,
            week: input.type === 'LEAGUE_WEEKLY_RESULT' ? round!.roundNumber : null,
        } };
    } catch {
        return { success: false, message: '공지를 준비하지 못했습니다. 로그인과 볼링장 관리 권한을 확인해주세요.' };
    }
}
