'use server';

import prisma from '@/lib/prisma';
import { validatePost } from '@/lib/community';
import { validateEquipment, type EquipmentInput } from '@/lib/equipment';
import { communityMember as member } from '@/lib/community-access';
import { revalidatePath } from 'next/cache';

function refresh(id?: string) {
    revalidatePath('/');
    revalidatePath('/community');
    revalidatePath('/community/moderation');
    revalidatePath('/equipment');
    if (id) revalidatePath(`/community/${id}`);
    if (id) revalidatePath(`/equipment/${id}`);
}

async function writablePost(id: string, user: { id: string; role: string }) {
    const post = await prisma.communityPost.findUnique({ where: { id } });
    if (!post || post.status === 'DELETED') throw new Error('게시글을 찾을 수 없습니다.');
    if (post.authorId !== user.id && user.role !== 'SUPER_ADMIN') throw new Error('수정 권한이 없습니다.');
    return post;
}

export async function saveCommunityPost(id: string | null, input: { category: string; title: string; content: string; equipment?: EquipmentInput }) {
    const user = await member();
    const base = validatePost(input);
    if (input.equipment && base.category !== 'EQUIPMENT') throw new Error('용품 정보는 용품 이야기 게시판에 등록해주세요.');
    const data = {...base,...(input.equipment ? validateEquipment(input.equipment) : base.category !== 'EQUIPMENT' ? {equipmentType:null,equipmentCategory:null,equipmentBrand:null,equipmentModel:null,equipmentLink:null} : {})};
    if (id) {
        const post = await writablePost(id, user);
        if (post.status !== 'PUBLISHED') throw new Error('숨김 처리된 글은 수정할 수 없습니다.');
        await prisma.communityPost.update({ where: { id }, data });
        refresh(id);
        return { id };
    }
    const post = await prisma.$transaction(async tx => {
        const recent = await tx.communityPost.count({ where: { authorId: user.id, createdAt: { gte: new Date(Date.now() - 60000) } } });
        if (recent > 0) throw new Error('글을 작성한 뒤 1분 후에 다시 등록해주세요.');
        return tx.communityPost.create({ data: { ...data, authorId: user.id } });
    });
    refresh(post.id);
    return { id: post.id };
}

export async function deleteCommunityPost(id: string) {
    const user = await member();
    await writablePost(id, user);
    await prisma.communityPost.update({ where: { id }, data: { status: 'DELETED' } });
    refresh(id);
}

export async function addCommunityComment(postId: string, input: string) {
    const user = await member();
    const content = input.trim();
    if (!content || content.length > 2000) throw new Error('댓글은 1~2,000자로 입력해주세요.');
    await prisma.$transaction(async tx => {
        const post = await tx.communityPost.findFirst({ where: { id: postId, status: 'PUBLISHED' } });
        if (!post) throw new Error('댓글을 작성할 수 없는 게시글입니다.');
        const recent = await tx.communityComment.count({ where: { authorId: user.id, createdAt: { gte: new Date(Date.now() - 60000) } } });
        if (recent >= 5) throw new Error('잠시 후 댓글을 다시 작성해주세요.');
        await tx.communityComment.create({ data: { postId, authorId: user.id, content } });
    });
    refresh(postId);
}

export async function deleteCommunityComment(id: string) {
    const user = await member();
    const comment = await prisma.communityComment.findUnique({ where: { id } });
    if (!comment || (comment.authorId !== user.id && user.role !== 'SUPER_ADMIN')) throw new Error('삭제 권한이 없습니다.');
    await prisma.communityComment.update({ where: { id }, data: { status: 'DELETED' } });
    refresh(comment.postId);
}

export async function updateCommunityComment(id:string, input:string, expectedUpdatedAt:string) {
    const user=await member();
    const content=typeof input==='string'?input.trim():'';
    const version=new Date(expectedUpdatedAt);
    if (!content || content.length>2000 || !Number.isFinite(version.getTime())) throw new Error('댓글 입력 내용을 확인해주세요.');
    const postId=await prisma.$transaction(async tx=>{
        const comment=await tx.communityComment.findUnique({where:{id},select:{postId:true,authorId:true}});
        if(!comment || (comment.authorId!==user.id && user.role!=='SUPER_ADMIN')) throw new Error('수정 권한이 없습니다.');
        const result=await tx.communityComment.updateMany({where:{id,status:'PUBLISHED',post:{status:'PUBLISHED'},updatedAt:version,...(user.role==='SUPER_ADMIN'?{}:{authorId:user.id})},data:{content,updatedAt:new Date(Math.max(Date.now(),version.getTime()+1))}});
        if(result.count!==1)throw new Error('댓글이 변경됐거나 수정할 수 없습니다. 새로고침 후 확인해주세요.');
        return comment.postId;
    });
    refresh(postId);
}

export async function reportCommunityPost(postId: string, input: string) {
    const user = await member();
    const reason = input.trim();
    if (reason.length < 5 || reason.length > 500) throw new Error('신고 이유를 5~500자로 입력해주세요.');
    const post = await prisma.communityPost.findFirst({ where: { id: postId, status: 'PUBLISHED' } });
    if (!post) throw new Error('게시글을 찾을 수 없습니다.');
    await prisma.communityReport.upsert({ where: { postId_authorId: { postId, authorId: user.id } }, create: { postId, authorId: user.id, reason }, update: { reason } });
    refresh(postId);
}

export async function moderateCommunityPost(id: string, hidden: boolean) {
    const user = await member();
    if (user.role !== 'SUPER_ADMIN') throw new Error('관리자 권한이 필요합니다.');
    const post = await prisma.communityPost.findUnique({ where: { id } });
    if (!post || post.status === 'DELETED') throw new Error('게시글을 찾을 수 없습니다.');
    await prisma.communityPost.update({ where: { id }, data: { status: hidden ? 'HIDDEN' : 'PUBLISHED' } });
    refresh(id);
}
