import type { Prisma } from '@prisma/client';

export function publicCommunityWhere({category='', q='', scope='all', userId}: {category?:string;q?:string;scope?:string;userId?:string} = {}): Prisma.CommunityPostWhereInput {
    const where: Prisma.CommunityPostWhereInput = {status:'PUBLISHED'};
    if (category) where.category = category;
    if (q) where.OR = [{title:{contains:q}},{content:{contains:q}}];
    if (scope === 'mine' || scope === 'commented') {
        if (!userId) return {status:'PUBLISHED',id:{in:[]}};
        if (scope === 'mine') where.authorId = userId;
        else where.comments = {some:{authorId:userId,status:'PUBLISHED'}};
    }
    return where;
}

export function moderationWhere(filter='all'): Prisma.CommunityPostWhereInput {
    if(filter==='hidden')return {status:'HIDDEN'};
    return {status:{not:'DELETED'}, ...(filter==='reported'?{reports:{some:{}}}:{OR:[{status:'HIDDEN'},{reports:{some:{}}}]})};
}
