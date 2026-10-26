'use server';

import prisma from '@/lib/prisma';
import { verifyCenterAdmin } from '@/lib/auth-utils';
import { revalidatePath } from 'next/cache';
import { BAND_SHARE_TEXT_LIMIT } from '@/lib/band/share-caption';
import type { BandShareDefaults } from '@/lib/band/share-caption';

export async function saveBandPostSettingsAction(input: { centerId: string; tournamentId: string } & BandShareDefaults) {
    try {
        if (!input || ![input.centerId, input.tournamentId].every(value => typeof value === 'string' && value.trim() && value.length <= 200) ||
            ![input.aboveImageText, input.belowImageText].every(value => typeof value === 'string' && value.length <= BAND_SHARE_TEXT_LIMIT)) {
            return { success: false, message: `사진 위·아래 문구는 각각 ${BAND_SHARE_TEXT_LIMIT}자 이내로 입력해주세요.` };
        }
        await verifyCenterAdmin(input.centerId);
        const tournament = await prisma.tournament.findUnique({ where: { id: input.tournamentId }, select: { centerId: true, settings: true } });
        if (!tournament || tournament.centerId !== input.centerId) return { success: false, message: '해당 볼링장의 대회를 확인할 수 없습니다.' };
        const settings = tournament.settings ? JSON.parse(tournament.settings) : {};
        if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return { success: false, message: '기존 대회 설정을 확인해주세요. 저장하지 않았습니다.' };
        const defaults = { aboveImageText: input.aboveImageText.trim(), belowImageText: input.belowImageText.trim() };
        const result = await prisma.tournament.updateMany({
            // Do not overwrite another administrator's concurrent settings edit.
            where: { id: input.tournamentId, centerId: input.centerId, settings: tournament.settings },
            data: { settings: JSON.stringify({ ...settings, bandOfficialShare: defaults }) },
        });
        if (result.count !== 1) return { success: false, message: '다른 설정이 변경되었습니다. 새로고침한 뒤 다시 저장해주세요.' };
        revalidatePath(`/centers/${input.centerId}/tournaments/${input.tournamentId}`, 'layout');
        return { success: true, message: 'BAND 게시글 기본 문구를 저장했습니다.', defaults };
    } catch { return { success: false, message: '저장하지 못했습니다. 로그인·볼링장 관리 권한과 기존 설정을 확인해주세요.' }; }
}
