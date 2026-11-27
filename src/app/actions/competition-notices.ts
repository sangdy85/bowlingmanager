'use server';
import prisma from '@/lib/prisma';
import { competitionEditor } from '@/lib/competition-notices-server';
import { CompetitionInputError, validateCompetitionNotice, type CompetitionNoticeInput } from '@/lib/competition-notices';
import { revalidatePath } from 'next/cache';

export async function saveCompetitionNotice(id: string | null, input: CompetitionNoticeInput, expectedUpdatedAt?: string) {
    // Role is checked against DB before validation/write, never trusted from the client/session.
    const editor = await competitionEditor();
    if (!editor) return {error: '사이트 슈퍼어드민만 대회정보를 등록·수정할 수 있습니다.'};
    try {
        const data = validateCompetitionNotice(input);
        let savedId: string;
        if (id) {
            const version = typeof expectedUpdatedAt === 'string' ? new Date(expectedUpdatedAt) : new Date(NaN);
            if (!Number.isFinite(version.getTime())) return {error: '최신 대회정보를 다시 열어주세요.'};
            const result = await prisma.competitionNotice.updateMany({where: {id, updatedAt: version}, data: {...data, updatedAt: new Date(Math.max(Date.now(), version.getTime() + 1))}});
            if (!result.count) return {error: '다른 관리자가 수정했거나 대회를 찾을 수 없습니다. 새로고침 후 확인해주세요.'};
            savedId = id;
        } else {
            savedId = (await prisma.competitionNotice.create({data: {...data, createdById: editor.id}})).id;
        }
        for (const route of ['/', '/competitions', '/competitions/manage', `/competitions/${savedId}`, `/competitions/${savedId}/edit`]) revalidatePath(route);
        revalidatePath('/sitemap.xml');
        return {id: savedId, published: data.published};
    } catch (error) {
        return {error: error instanceof CompetitionInputError ? error.message : '대회정보를 저장하지 못했습니다. 잠시 후 다시 시도해주세요.'};
    }
}
