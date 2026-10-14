import Link from 'next/link';
import {notFound} from 'next/navigation';
import type {Metadata} from 'next';
import {publishedEquipment} from '@/lib/equipment-server';
import {communityViewer} from '@/lib/community-access';
import {equipmentCategory,equipmentType} from '@/lib/equipment';
import {communityDate} from '@/lib/community';
import {PUBLIC_ORIGIN} from '@/lib/public-web';
import CommunityDiscussion from '@/components/community/CommunityDiscussion';
import portal from '@/components/portal/Portal.module.css';
import styles from '@/components/equipment/Equipment.module.css';
type Props={params:Promise<{id:string}>};
export async function generateMetadata({params}:Props):Promise<Metadata>{const {id}=await params,post=await publishedEquipment(id);return {title:post?`${post.title} | 볼링 용품`:'용품 글을 찾을 수 없습니다',alternates:{canonical:`${PUBLIC_ORIGIN}/equipment/${encodeURIComponent(id)}`},robots:{index:false,follow:true}};}
export default async function EquipmentDetail({params}:Props){const {id}=await params,[post,viewer]=await Promise.all([publishedEquipment(id),communityViewer()]);if(!post)notFound();const isAdmin=viewer?.role==='SUPER_ADMIN';return <div className={portal.page}><div className={portal.inner}><Link href="/equipment">← 볼링 용품 목록</Link><header className={portal.headline}><span className={portal.tag}>{equipmentType(post.equipmentType)}</span><h1>{post.title}</h1><div className={portal.meta}><span>{post.author.name}</span><span>{communityDate(post.createdAt)}</span>{+post.updatedAt!==+post.createdAt&&<span>수정됨</span>}</div></header>
        {post.equipmentModel&&<div className={styles.product}><span className={styles.icon} aria-hidden="true">{equipmentCategory(post.equipmentCategory)?.icon??'🎳'}</span><div><strong>{post.equipmentModel}</strong><p>{[post.equipmentBrand,equipmentCategory(post.equipmentCategory)?.label].filter(Boolean).join(' · ')}</p></div></div>}
        {post.equipmentLink&&<a className={portal.secondary} href={post.equipmentLink} target="_blank" rel="noopener noreferrer">작성자가 첨부한 관련 자료 ↗</a>}<article className={portal.body}>{post.content}</article><aside className={portal.notice}>회원이 작성한 {equipmentType(post.equipmentType)}입니다. 직접 사용한 경험과 확인한 제품 정보를 구분해 읽어주세요. 협찬·판매 목적 여부는 본문을 확인하세요.</aside>
        <CommunityDiscussion postId={post.id} canEdit={!!viewer&&(viewer.id===post.authorId||isAdmin)} isAdmin={isAdmin} isLoggedIn={!!viewer} userId={viewer?.id} comments={post.comments.map(c=>({...c,createdAt:c.createdAt.toISOString(),updatedAt:c.updatedAt.toISOString()}))} basePath="/equipment"/>
    </div></div>;}
