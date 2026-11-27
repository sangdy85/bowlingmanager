import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { communityViewer } from '@/lib/community-access';
import prisma from '@/lib/prisma';
import { categoryLabel, communityDate } from '@/lib/community';
import { PUBLIC_ORIGIN } from '@/lib/public-web';
import CommunityDiscussion from '@/components/community/CommunityDiscussion';
import styles from '@/components/portal/Portal.module.css';
type Props={params:Promise<{id:string}>};
export async function generateMetadata({params}:Props):Promise<Metadata> {
    const {id}=await params;const p=await prisma.communityPost.findFirst({where:{id,status:'PUBLISHED'},select:{title:true,category:true}});
    return {title:p?`${p.title} | 볼링 커뮤니티`:'게시글을 찾을 수 없습니다',alternates:{canonical:`${PUBLIC_ORIGIN}/${p?.category==='EQUIPMENT'?'equipment':'community'}/${encodeURIComponent(id)}`},robots:{index:false,follow:true}};
}
export default async function CommunityDetail({params}:Props) {
    const {id}=await params;const [post,viewer]=await Promise.all([prisma.communityPost.findFirst({where:{id,status:'PUBLISHED'},include:{author:{select:{id:true,name:true}},comments:{where:{status:'PUBLISHED'},orderBy:[{createdAt:'asc'},{id:'asc'}],include:{author:{select:{id:true,name:true}}}}}}),communityViewer()]);
    if(!post)notFound();if(post.category==='EQUIPMENT')redirect(`/equipment/${id}`);const isAdmin=viewer?.role==='SUPER_ADMIN';
    return <div className={styles.page}><div className={styles.inner}><Link href={`/community?category=${post.category}`}>← {categoryLabel(post.category)}</Link><header className={styles.headline}><span className={styles.tag}>{categoryLabel(post.category)}</span><h1>{post.title}</h1><div className={styles.meta}><span>{post.author.name}</span><span>{communityDate(post.createdAt)}</span>{+post.updatedAt!==+post.createdAt&&<span>수정됨</span>}</div></header><article className={styles.body}>{post.content}</article><CommunityDiscussion postId={id} userId={viewer?.id} canEdit={isAdmin||viewer?.id===post.authorId} isAdmin={isAdmin} isLoggedIn={!!viewer?.id} comments={post.comments.map(c=>({...c,createdAt:c.createdAt.toISOString(),updatedAt:c.updatedAt.toISOString()}))}/></div></div>;
}
