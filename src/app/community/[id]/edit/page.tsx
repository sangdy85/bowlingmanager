import { communityViewer } from '@/lib/community-access';
import prisma from '@/lib/prisma';
import { notFound, redirect } from 'next/navigation';
import CommunityEditor from '@/components/community/CommunityEditor';
import styles from '@/components/portal/Portal.module.css';
export const metadata={title:'커뮤니티 글 수정 | 볼링매니저',robots:{index:false,follow:false}};
export default async function EditCommunityPost({params}:{params:Promise<{id:string}>}) {
    const viewer=await communityViewer();if(!viewer)redirect('/login');const {id}=await params;
    const post=await prisma.communityPost.findFirst({where:{id,status:'PUBLISHED'}});
    if(!post||(post.authorId!==viewer.id&&viewer.role!=='SUPER_ADMIN'))notFound();
    if(post.category==='EQUIPMENT'&&post.equipmentType)redirect(`/equipment/${id}/edit`);
    return <div className={styles.page}><div className={styles.inner}><header className={styles.headline}><h1>게시글 수정</h1></header><CommunityEditor initial={post}/></div></div>;
}
