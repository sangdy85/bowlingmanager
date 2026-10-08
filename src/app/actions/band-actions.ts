'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';
import { verifyCenterAdmin } from '@/lib/auth-utils';
import { getBands, getPermissions, bandErrorMessage } from '@/lib/band/client';
import { decryptBandToken } from '@/lib/band/token-crypto';
import { republishBandPost, sendBandTestPost } from '@/lib/band/publisher';
import type { BandPostType, BandPublishOutcome } from '@/lib/band/types';

type ActionResult = { success: boolean; message: string; outcome?: BandPublishOutcome };

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
        if (!permissions.includes('posting')) return { success: false, message: '선택한 BAND에 글쓰기 권한이 없습니다.' };
        await (prisma as any).bandConnection.update({
            where: { centerId },
            data: { bandKey, bandName: band.name, bandCoverUrl: band.cover, enabled: true },
        });
        revalidatePath(`/centers/${centerId}/edit`);
        return { success: true, message: `${band.name} BAND를 게시 대상으로 저장했습니다.` };
    } catch (error) {
        return { success: false, message: bandErrorMessage(error) };
    }
}

export async function updateBandPreferences(centerId: string, input: {
    enabled: boolean; autoRecruitment: boolean; autoFinalResult: boolean; doPush: boolean;
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
        return { success: true, message: 'BAND 자동 게시 설정을 저장했습니다.' };
    } catch {
        return { success: false, message: 'BAND 설정을 저장하지 못했습니다.' };
    }
}

export async function disconnectCenterBand(centerId: string): Promise<ActionResult> {
    try {
        await verifyCenterAdmin(centerId);
        await (prisma as any).bandConnection.deleteMany({ where: { centerId } });
        revalidatePath(`/centers/${centerId}/edit`);
        return { success: true, message: 'BAND 연결을 해제했습니다. 기존 게시 이력은 유지됩니다.' };
    } catch {
        return { success: false, message: 'BAND 연결을 해제하지 못했습니다.' };
    }
}

export async function sendBandTestPostAction(centerId: string): Promise<ActionResult> {
    await verifyCenterAdmin(centerId);
    const outcome = await sendBandTestPost(centerId);
    return { success: outcome.status === 'SUCCESS', message: outcome.message, outcome };
}

export async function getBandPostPreviewAction(input: {
    centerId: string; tournamentId: string; roundId?: string | null; type: BandPostType;
}): Promise<ActionResult> {
    const allowedTypes = new Set<BandPostType>(['RECRUITMENT', 'PARTICIPANTS', 'LANE_ASSIGNMENT', 'FINAL_RESULT', 'LEAGUE_WEEKLY_RESULT']);
    if (!allowedTypes.has(input.type)) return { success: false, message: '지원하지 않는 BAND 게시 유형입니다.' };

    const userId = await verifyCenterAdmin(input.centerId);
    const tournament = await prisma.tournament.findUnique({
        where: { id: input.tournamentId },
        select: { centerId: true },
    });
    if (!tournament || tournament.centerId !== input.centerId) {
        return { success: false, message: '대회 정보를 확인할 수 없습니다.' };
    }

    // This path computes the identical text as publishing, but never writes
    // history, decrypts tokens, checks external permissions, or calls BAND.
    const outcome = await republishBandPost({
        tournamentId: input.tournamentId,
        roundId: input.roundId,
        type: input.type,
        previewOnly: true,
        requestedById: userId,
    });
    return { success: outcome.status === 'SUCCESS' && Boolean(outcome.preview), message: outcome.message, outcome };
}

export async function publishBandPostAction(input: {
    centerId: string; tournamentId: string; roundId?: string | null; type: BandPostType; previewToken: string;
}): Promise<ActionResult> {
    const allowedTypes = new Set<BandPostType>(['RECRUITMENT', 'PARTICIPANTS', 'LANE_ASSIGNMENT', 'FINAL_RESULT', 'LEAGUE_WEEKLY_RESULT']);
    if (!allowedTypes.has(input.type)) return { success: false, message: '지원하지 않는 BAND 게시 유형입니다.' };
    if (typeof input.previewToken !== 'string' || !/^\\d{13}\\.[a-f0-9]{64}$/.test(input.previewToken)) {
        return { success: false, message: '게시 전 미리보기를 먼저 확인해주세요.' };
    }

    const userId = await verifyCenterAdmin(input.centerId);
    const tournament = await prisma.tournament.findUnique({ where: { id: input.tournamentId }, select: { centerId: true } });
    if (!tournament || tournament.centerId !== input.centerId) return { success: false, message: '대회 정보를 확인할 수 없습니다.' };
    const outcome = await republishBandPost({
        tournamentId: input.tournamentId,
        roundId: input.roundId,
        type: input.type,
        requestedById: userId,
        previewToken: input.previewToken,
    });
    revalidatePath(`/centers/${input.centerId}/tournaments/${input.tournamentId}`);
    if (input.roundId) {
        revalidatePath(`/centers/${input.centerId}/tournaments/${input.tournamentId}/rounds/${input.roundId}`);
    }
    return { success: outcome.status === 'SUCCESS', message: outcome.message, outcome };
}


export async function resolveUncertainBandPostAction(input: {
    centerId: string;
    postId: string;
    resolution: 'POSTED' | 'NOT_POSTED';
    confirmed: boolean;
}): Promise<ActionResult> {
    if (input.confirmed !== true || !['POSTED', 'NOT_POSTED'].includes(input.resolution)) {
        return { success: false, message: 'BAND 게시 여부를 직접 확인하고 결과를 선택해주세요.' };
    }
    const userId = await verifyCenterAdmin(input.centerId);
    const db = prisma as any;
    const post = await db.bandPost.findUnique({ where: { id: input.postId } });
    if (!post || post.centerId !== input.centerId) {
        return { success: false, message: '해당 게시 이력을 찾을 수 없습니다.' };
    }
    if (!['UNKNOWN', 'PENDING'].includes(post.status)) {
        return { success: false, message: '미확인 상태의 게시 이력만 수동으로 확인할 수 있습니다.' };
    }
    // A recent PENDING request might still be in flight; require a waiting period.
    if (post.status === 'PENDING' && Date.now() - new Date(post.createdAt).getTime() < 30 * 60 * 1000) {
        return { success: false, message: '게시 요청이 아직 처리 중일 수 있습니다. 30분 후 BAND의 실제 게시 여부를 확인해주세요.' };
    }
    const current = await db.bandPost.findFirst({
        where: { tournamentId: post.tournamentId, roundId: post.roundId || null, type: post.type },
        orderBy: { revision: 'desc' },
        select: { id: true },
    });
    if (current?.id !== post.id) {
        return { success: false, message: '최신 게시 이력만 확인 처리할 수 있습니다.' };
    }

    const verifiedAt = new Date();
    const result = await db.bandPost.updateMany({
        where: { id: post.id, centerId: input.centerId, status: post.status },
        data: input.resolution === 'POSTED'
            ? {
                status: 'SUCCESS',
                postedAt: verifiedAt,
                errorCode: 'MANUAL_VERIFIED_POSTED',
                errorMessage: `BAND 게시 확인 · 관리자 ${userId} · ${verifiedAt.toISOString()}`,
            }
            : {
                status: 'FAILED',
                errorCode: 'MANUAL_VERIFIED_ABSENT',
                errorMessage: `BAND 미게시 확인 · 관리자 ${userId} · ${verifiedAt.toISOString()}`,
            },
    });
    if (result.count !== 1) {
        return { success: false, message: '이력 상태가 변경되었습니다. 새로고침한 뒤 다시 확인해주세요.' };
    }
    revalidatePath(`/centers/${input.centerId}/tournaments/${post.tournamentId}`);
    if (post.roundId) {
        revalidatePath(`/centers/${input.centerId}/tournaments/${post.tournamentId}/rounds/${post.roundId}`);
    }
    return {
        success: true,
        message: input.resolution === 'POSTED'
            ? '실제 게시 확인으로 기록했습니다. 중복 게시되지 않습니다.'
            : '미게시 확인으로 기록했습니다. 필요하면 새 미리보기 후 재게시할 수 있습니다.',
    };
}
