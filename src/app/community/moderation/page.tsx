import prisma from '@/lib/prisma';
import { communityViewer } from '@/lib/community-access';
import { moderationWhere } from '@/lib/community-server';
import { searchText, searchPage } from '@/lib/portal-params';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import ModerationButton from '@/components/community/ModerationButton';
import styles from '@/components/portal/Portal.module.css';
import board from '@/components/community/Community.module.css';
export const metadata={title:'커뮤니티 관리 | 볼링매니저',robots:{index:false,follow:false}};
export default async function CommunityModeration({searchParams}:{searchParams:Promise<{filter?:string;page?:string}>}) {
 const user=await communityViewer();if(!user)redirect('/login');if(user.role!=='SUPER_ADMIN')notFound();
 const params=await searchParams;const candidate=searchText(params.filter);const filter=['hidden','reported'].includes(candidate)?candidate:'all';
 const where=moderationWhere(filter);const count=await prisma.communityPost.count({where});const pages=Math.max(1,Math.ceil(count/20));const page=Math.min(searchPage(params.page),pages);
 const posts=await prisma.communityPost.findMany({where,orderBy:[{updatedAt:'desc'},{id:'desc'}],skip:(page-1)*20,take:20,include:{author:{select:{name:true}},reports:{select:{reason:true,createdAt:true},orderBy:{createdAt:'desc'}}}});
 const href=(next=1,nextFilter=filter)=>`/community/moderation?${new URLSearchParams({filter:nextFilter,page:String(next)})}`;
 return <div className={styles.page}><div className={styles.inner}><Link href="/community">← 커뮤니티</Link><header className={styles.headline}><p className={styles.eyebrow}>COMMUNITY CARE</p><h1>신고·숨김 관리</h1><p>신고 사유는 관리자에게만 표시됩니다. 글과 신고 내용을 확인한 뒤 공개 상태를 결정해주세요.</p></header>
 <div className={board.toolbar}><nav className={board.scopes} aria-label="관리 목록 필터">{[['all','전체 확인 대상'],['reported','신고된 글'],['hidden','숨김 글']].map(([key,label])=><Link key={key} href={href(1,key)} aria-current={key===filter?'page':undefined}>{label}</Link>)}</nav><span>총 {count}개 글</span></div>
 <div className={board.moderation}>{posts.length?posts.map(p=><article key={p.id} className={styles.card}><span className={styles.tag}>{p.status==='HIDDEN'?'숨김':'공개'} · 신고 {p.reports.length}건</span><h2>{p.title}</h2><p>{p.author.name}</p><div className={styles.body}>{p.content}</div>{p.reports.map((r,i)=><p key={i} className={styles.notice}>신고 이유: {r.reason}</p>)}<div className={styles.actions}>{p.status==='PUBLISHED'&&<Link className={styles.secondary} href={`/${p.category==='EQUIPMENT'?'equipment':'community'}/${p.id}`}>공개 글 보기</Link>}<ModerationButton id={p.id} hidden={p.status==='HIDDEN'}/></div></article>):<div className={styles.empty}>확인할 신고·숨김 글이 없습니다.</div>}</div>
 <nav className={styles.pager} aria-label="관리 목록 페이지">{page>1&&<Link href={href(page-1)} className={styles.secondary}>이전</Link>}<span>{page} / {pages}페이지</span>{page<pages&&<Link href={href(page+1)} className={styles.secondary}>다음</Link>}</nav>
 </div></div>;
}
