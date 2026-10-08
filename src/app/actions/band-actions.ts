'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';
import { verifyCenterAdmin } from '@/lib/auth-utils';
import { getBands, getPermissions, bandErrorMessage } from '@/lib/band/client';
import { decryptBandToken } from '@/lib/band/token-crypto';
import {
    buildBandPostPreview,
    publishManualBandPost,
    sendBandTestPost,
} from '@/lib/band/publisher';
import type {
    BandPostPreview,
    BandPostType,
    BandPublishOutcome,
} from '@/lib/band/types';

type ActionResult = {
    success: boolean;
    message: string;
    outcome?: BandPublishOutcome;
};

type PreviewResult = {
    success: boolean;
    message: string;
    preview?: BandPostPreview;
};

async function verifyTournamentCenter(centerId: string, tournamentId: string) {
    const tournament = await prisma.tournament.findUnique({
        where: { id: tournamentId },
        select: { centerId: true },
    });
    return Boolean(tournament && tournament.centerId === centerId);
}

export async function selectCenterBand(centerId: string, bandKey: string): Promise<ActionResult> {
    try {
        await verifyCenterAdmin(centerId);
        const connection = await (prisma as any).bandConnection.findUnique({ where: { centerId } });
        if (!connection) return { success: false, message: 'BAND를 먼저 연결해주세요.' };

        const token = decryptBandToken(connection.accessTokenEncrypted);
        const bands = await getBands(token);
        const band = bands.find(item => item.bandKey === bandKey);
        if (!band) return { success: false, message: '선택한 BAND를 확인할 수 없습니다.' };

        const permissions = await getPermissions(token, bandKey);
        if (!permissions.includes('posting')) {
            return { success: false, message: '선택한 BAND에 글쓰기 권한이 없습니다.' };
        }

        await (prisma as any).bandConnection.update({
            where: { centerId },
            data: {
                bandKey,
                bandName: band.name,
                bandCoverUrl: band.cover,
                enabled: true,
            },
        });
        revalidatePath(`/centers/${centerId}/edit`);
        return {
            success: true,
            message: `${band.name} BAND를 게시 대상으로 저장했습니다.`,
        };
    } catch (error) {
        return { success: false, message: bandErrorMessage(error) };
    }
}

// Kept for compatibility with the original BAND schema. Current product flow uses manual preview/publish.
export async function updateBandPreferences(centerId: string, input: {
    enabled: boolean;
    autoRecruitment: boolean;
    autoFinalResult: boolean;
    doPush: boolean;
}): Promise<ActionResult> {
    try {
        await verifyCenterAdmin(centerId);
        await (prisma as any).bandConnection.update({
            where: { centerId },
            data: {
                enabled: input.enabled === true,
                autoRecruitment: input.autoRecruitment === true,
                autoFinalResult: input.autoFinalResult === true,
                doPush: input.doPush === true,
            },
        });
        revalidatePath(`/centers/${centerId}/edit`);
        return { success: true, message: 'BAND 설정을 저장했습니다.' };
    } catch {
        return { success: false, message: 'BAND 설정을 저장하지 못했습니다.' };
    }
}

export async function disconnectCenterBand(centerId: string): Promise<ActionResult> {
    try {
        await verifyCenterAdmin(centerId);
        await (prisma as any).bandConnection.deleteMany({ where: { centerId } });
        revalidatePath(`/centers/${centerId}/edit`);
        return {
            success: true,
            message: 'BAND 연결을 해제했습니다. 기존 게시 이력은 유지됩니다.',
        };
    } catch {
        return { success: false, message: 'BAND 연결을 해제하지 못했습니다.' };
    }
}

export async function sendBandTestPostAction(centerId: string): Promise<ActionResult> {
    await verifyCenterAdmin(centerId);
    const outcome = await sendBandTestPost(centerId);
    return {
        success: outcome.status === 'SUCCESS',
        message: outcome.message,
        outcome,
    };
}

export async function previewBandPostAction(input: {
    centerId: string;
    tournamentId: string;
    roundId?: string | null;
    type: BandPostType;
}): Promise<PreviewResult> {
    try {
        await verifyCenterAdmin(input.centerId);
        if (!await verifyTournamentCenter(input.centerId, input.tournamentId)) {
            return { success: false, message: '대회 정보를 확인할 수 없습니다.' };
        }

        const preview = await buildBandPostPreview({
            tournamentId: input.tournamentId,
            roundId: input.roundId,
            type: input.type,
        });
        return {
            success: true,
            message: '최신 대회 정보로 BAND 게시 미리보기를 만들었습니다.',
            preview,
        };
    } catch (error) {
        return {
            success: false,
            message: error instanceof Error ? error.message : 'BAND 미리보기를 만들지 못했습니다.',
        };
    }
}

export async function publishBandPostAction(input: {
    centerId: string;
    tournamentId: string;
    roundId?: string | null;
    type: BandPostType;
}): Promise<ActionResult> {
    try {
        const userId = await verifyCenterAdmin(input.centerId);
        if (!await verifyTournamentCenter(input.centerId, input.tournamentId)) {
            return { success: false, message: '대회 정보를 확인할 수 없습니다.' };
        }

        const outcome = await publishManualBandPost({
            tournamentId: input.tournamentId,
            roundId: input.roundId,
            type: input.type,
            requestedById: userId,
        });

        revalidatePath(`/centers/${input.centerId}/tournaments/${input.tournamentId}`);
        if (input.roundId) {
            revalidatePath(`/centers/${input.centerId}/tournaments/${input.tournamentId}/rounds/${input.roundId}`);
        }

        return {
            success: outcome.status === 'SUCCESS',
            message: outcome.message,
            outcome,
        };
    } catch (error) {
        return {
            success: false,
            message: error instanceof Error ? error.message : 'BAND 게시 요청을 처리하지 못했습니다.',
        };
    }
}
