import { auth } from '@/auth';
import prisma from '@/lib/prisma';

export async function communityMember() {
    const session=await auth();
    if (!session?.user?.id) throw new Error('로그인 후 이용해주세요.');
    const user=await prisma.user.findUnique({where:{id:session.user.id},select:{id:true,role:true}});
    if (!user) throw new Error('회원 정보를 확인할 수 없습니다.');
    return user;
}
export async function communityViewer() {
    try { return await communityMember(); } catch { return null; }
}
