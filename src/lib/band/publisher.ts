import prisma from '@/lib/prisma';
import { prepareBandAnnouncement } from './announcement';
import { BandApiError, bandErrorMessage, createPost, getPermissions } from './client';
import { decryptBandToken } from './token-crypto';
import { bandPostContentIssue, bandPostContentSize, BAND_POST_MAX_UTF8_BYTES } from './content-guard';
import { createBandPreviewApproval, verifyBandPreviewApproval } from './preview-signature';
import type { BandPostType, BandPublishOutcome } from './types';
import { bandAutoPublishSkipReason, bandPostDedupeKey, nextBandPostRevision } from './policy';
import { isBandConfigured, BAND_NOT_CONFIGURED_MESSAGE } from './config';

type PublishInput = {
    tournamentId: string;
    roundId?: string | null;
    requestedById?: string | null;
    forceRevision?: boolean;
    previewOnly?: boolean;
    previewToken?: string;
    week?: number;
    doPush?: boolean;
};

async function publishBuiltContent(input: PublishInput & {
    centerId: string;
    type: BandPostType;
    content: string;
    autoFlag: 'autoRecruitment' | 'autoFinalResult';
}): Promise<BandPublishOutcome> {
    if (!isBandConfigured()) return { status: 'SKIPPED', message: BAND_NOT_CONFIGURED_MESSAGE };
    const contentIssue = bandPostContentIssue(input.content);
    if (contentIssue) return { status: 'SKIPPED', message: contentIssue };

    const db = prisma as any;
    const connection = await db.bandConnection.findUnique({ where: { centerId: input.centerId } });
    if (!connection?.enabled || !connection.bandKey) {
        return { status: 'SKIPPED', message: '연결된 BAND가 없어 게시하지 않았습니다.' };
    }
    if (!input.forceRevision && !input.previewOnly) {
        const skipReason = bandAutoPublishSkipReason(connection, input.type);
        if (skipReason) return { status: 'SKIPPED', message: skipReason };
    }

    const doPush = typeof input.doPush === 'boolean' ? input.doPush : connection.doPush === true;
    const latest = await db.bandPost.findFirst({
        where: { tournamentId: input.tournamentId, roundId: input.roundId || null, type: input.type },
        orderBy: { revision: 'desc' },
    });
    // Signed server-side: the client cannot mint or alter the confirmation.
    // This binds the exact body, target, history revision and actor for 15 minutes.
    const approvalPayload = JSON.stringify({
        centerId: input.centerId,
        tournamentId: input.tournamentId,
        roundId: input.roundId || null,
        type: input.type,
        bandKey: connection.bandKey,
        bandName: connection.bandName || '',
        doPush,
        content: input.content,
        latestRevision: latest?.revision ?? 0,
        latestStatus: latest?.status ?? null,
    });

    if (input.previewOnly) {
        return {
            status: 'SUCCESS',
            message: '게시 전 미리보기가 준비되었습니다. 아직 BAND에 게시하지 않았습니다.',
            preview: {
                bandName: connection.bandName || '이름 미등록 BAND',
                bandKey: connection.bandKey,
                doPush,
                content: input.content,
                contentBytes: bandPostContentSize(input.content),
                maxContentBytes: BAND_POST_MAX_UTF8_BYTES,
                nextRevision: nextBandPostRevision(latest?.revision),
                latestStatus: latest?.status ?? null,
                previewToken: createBandPreviewApproval(approvalPayload, input.requestedById || ''),
            },
        };
    }
    if (input.previewToken !== undefined &&
        !verifyBandPreviewApproval(input.previewToken, approvalPayload, input.requestedById || '')) {
        return { status: 'SKIPPED', message: '미리보기 승인 정보가 만료되었거나 게시 내용·대상·이력이 변경되었습니다. 다시 미리보기 해주세요.' };
    }
    if (latest?.status === 'PENDING' || latest?.status === 'UNKNOWN') {
        return { status: 'SKIPPED', message: '이전 BAND 게시 결과가 미확인 상태입니다. BAND에서 실제 게시 여부를 확인한 뒤 관리 조치가 필요합니다.', postId: latest.id, revision: latest.revision };
    }
    if (latest && !input.forceRevision) {
        return { status: 'SKIPPED', message: '이미 게시 이력이 있어 중복 게시하지 않았습니다.', postId: latest.id, revision: latest.revision };
    }

    const revision = nextBandPostRevision(latest?.revision);
    let history: any = null;
    let externalPostStarted = false;
    try {
        history = await db.bandPost.create({
            data: {
                centerId: input.centerId,
                tournamentId: input.tournamentId,
                roundId: input.roundId || null,
                type: input.type,
                revision,
                dedupeKey: bandPostDedupeKey(input.tournamentId, input.roundId, input.type, revision),
                bandKey: connection.bandKey,
                contentSnapshot: input.content,
                requestedById: input.requestedById || null,
                status: 'PENDING',
            },
        });

        const accessToken = decryptBandToken(connection.accessTokenEncrypted);
        const permissions = await getPermissions(accessToken, connection.bandKey);
        if (!permissions.includes('posting')) {
            throw new BandApiError('BAND posting permission denied.', 'POSTING_PERMISSION_DENIED', 403);
        }

        // Once the outbound request starts, a timeout does not prove the post
        // failed. Prevent a blind retry until someone verifies the BAND itself.
        externalPostStarted = true;
        const posted = await createPost({
            accessToken,
            bandKey: connection.bandKey,
            content: input.content,
            doPush,
        });
        await db.bandPost.update({
            where: { id: history.id },
            data: { status: 'SUCCESS', postKey: posted.postKey, postedAt: new Date(), errorCode: null, errorMessage: null },
        });
        return { status: 'SUCCESS', message: 'BAND 게시를 완료했습니다.', postId: history.id, postKey: posted.postKey, revision };
    } catch (error: any) {
        if (error?.code === 'P2002' && !history) {
            return { status: 'SKIPPED', message: '동일한 게시 요청이 이미 처리 중이거나 완료되었습니다.' };
        }
        const ambiguousMessage = 'BAND 게시 결과를 확인할 수 없습니다. BAND에서 글이 올라갔는지 확인하기 전에는 재게시하지 마세요.';
        const message = externalPostStarted ? ambiguousMessage : bandErrorMessage(error);
        if (history) {
            await db.bandPost.update({
                where: { id: history.id },
                data: {
                    status: externalPostStarted ? 'UNKNOWN' : 'FAILED',
                    errorCode: externalPostStarted ? 'PUBLISH_UNCONFIRMED' : error instanceof BandApiError ? error.code : 'PUBLISH_FAILED',
                    errorMessage: message,
                },
            }).catch(() => undefined);
        }
        return { status: 'FAILED', message, postId: history?.id, revision };
    }
}

async function publishAnnouncement(input: PublishInput, type: BandPostType, autoFlag: 'autoRecruitment' | 'autoFinalResult'): Promise<BandPublishOutcome> {
    const built = await prepareBandAnnouncement({ ...input, type });
    if (built.status !== 'SUCCESS') return built;
    return publishBuiltContent({ ...input, centerId: built.centerId, roundId: built.roundId, type, content: built.content, autoFlag });
}

export async function publishTournamentRecruitment(input: PublishInput): Promise<BandPublishOutcome> {
    return publishAnnouncement(input, 'RECRUITMENT', 'autoRecruitment');
}

export async function publishRoundParticipants(input: PublishInput): Promise<BandPublishOutcome> {
    return publishAnnouncement(input, 'PARTICIPANTS', 'autoRecruitment');
}

export async function publishRoundLaneAssignment(input: PublishInput): Promise<BandPublishOutcome> {
    return publishAnnouncement(input, 'LANE_ASSIGNMENT', 'autoRecruitment');
}

export async function publishTournamentFinalResult(input: PublishInput): Promise<BandPublishOutcome> {
    return publishAnnouncement(input, 'FINAL_RESULT', 'autoFinalResult');
}

export async function publishLeagueWeeklyResult(input: PublishInput): Promise<BandPublishOutcome> {
    return publishAnnouncement(input, 'LEAGUE_WEEKLY_RESULT', 'autoFinalResult');
}

export async function republishBandPost(input: PublishInput & { type: BandPostType }): Promise<BandPublishOutcome> {
    const forced = { ...input, forceRevision: true };
    switch (input.type) {
        case 'RECRUITMENT':
            return publishTournamentRecruitment(forced);
        case 'PARTICIPANTS':
            return publishRoundParticipants(forced);
        case 'LANE_ASSIGNMENT':
            return publishRoundLaneAssignment(forced);
        case 'FINAL_RESULT':
            return publishTournamentFinalResult(forced);
        case 'LEAGUE_WEEKLY_RESULT':
            return publishLeagueWeeklyResult(forced);
    }
}

export async function sendBandTestPost(centerId: string): Promise<BandPublishOutcome> {
    if (!isBandConfigured()) return { status: 'SKIPPED', message: BAND_NOT_CONFIGURED_MESSAGE };
    const connection = await (prisma as any).bandConnection.findUnique({
        where: { centerId }, include: { center: { select: { name: true } } },
    });
    if (!connection?.enabled || !connection.bandKey) return { status: 'SKIPPED', message: '게시할 BAND를 먼저 선택해주세요.' };
    try {
        const accessToken = decryptBandToken(connection.accessTokenEncrypted);
        const permissions = await getPermissions(accessToken, connection.bandKey);
        if (!permissions.includes('posting')) {
            throw new BandApiError('BAND posting permission denied.', 'POSTING_PERMISSION_DENIED', 403);
        }

        const posted = await createPost({
            accessToken,
            bandKey: connection.bandKey,
            content: `🎳 BowlingManager BAND 연동 테스트\n\n${connection.center.name}와 NAVER BAND 연결이 정상적으로 완료되었습니다.\n\nBowlingManager`,
            doPush: false,
        });
        return { status: 'SUCCESS', message: 'BAND 테스트 글을 게시했습니다.', postKey: posted.postKey };
    } catch (error) {
        return { status: 'FAILED', message: bandErrorMessage(error) };
    }
}
