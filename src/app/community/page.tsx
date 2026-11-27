import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import { communityViewer } from '@/lib/community-access';
import { publicCommunityWhere } from '@/lib/community-server';
import { COMMUNITY_CATEGORIES, categoryLabel, communityDate, validCategory } from '@/lib/community';
import { PUBLIC_ORIGIN } from '@/lib/public-web';
import styles from '@/components/portal/Portal.module.css';
import board from '@/components/community/Community.module.css';
import { searchText, searchPage } from '@/lib/portal-params';
import { CommunityPostingGuide } from '@/components/public/ReadingGuides';
import { OPERATING_GUIDES } from '@/lib/operating-guides';

type Props={searchParams:Promise<{category?:string;q?:string;page?:string;scope?:string;sort?:string}>};
export async function generateMetadata({searchParams}:Props):Promise<Metadata>{
 const p=await searchParams;const privateView=['mine','commented'].includes(searchText(p.scope));
 return {title:'볼링 커뮤니티 | 볼링매니저',description:'볼링 질문과 답변, 경기 경험, 대회 소식, 용품 후기를 나누는 게시판.',alternates:{canonical:PUBLIC_ORIGIN+'/community'},robots:{index:!privateView&&!searchText(p.q),follow:!privateView}};
}
export default async function CommunityPage({searchParams}:Props) {
 const params=await searchParams;const candidate=searchText(params.category);
 const category=validCategory(candidate)?candidate:'';const q=searchText(params.q);
 const scope=['mine','commented'].includes(searchText(params.scope))?searchText(params.scope):'all';
 const sort=searchText(params.sort)==='oldest'?'oldest':'latest';const viewer=await communityViewer();
 if(scope!=='all'&&!viewer)redirect('/login');
 const where=publicCommunityWhere({category,q,scope,userId:viewer?.id});
 const [count,groups]=await Promise.all([prisma.communityPost.count({where}),prisma.communityPost.groupBy({by:['category'],where:{status:'PUBLISHED'},_count:{_all:true}})]);
 const pages=Math.max(1,Math.ceil(count/15));const page=Math.min(searchPage(params.page),pages);
 const posts=await prisma.communityPost.findMany({where,orderBy:[{createdAt:sort==='oldest'?'asc':'desc'},{id:sort==='oldest'?'asc':'desc'}],skip:(page-1)*15,take:15,select:{id:true,title:true,category:true,createdAt:true,author:{select:{name:true}},_count:{select:{comments:{where:{status:'PUBLISHED'}}}}}});
 const href=(next=1,nextCategory=category,nextScope=scope)=>`/community?${new URLSearchParams({category:nextCategory,q,scope:nextScope,sort,page:String(next)})}`;
 const writeHref=category==='EQUIPMENT'?'/equipment/new':`/community/new?category=${category||'FREE'}`;
 return <div className={styles.page}><div className={styles.inner}>
 <header className={styles.headline}><p className={styles.eyebrow}>BOWLING TALK</p><h1>볼링 이야기, 함께 나눠요.</h1><p>오늘의 경기 경험부터 풀리지 않는 질문까지. 서로의 경험을 나누고, 다음 볼링을 함께 준비해요.</p></header>
 <nav className={styles.tabs} aria-label="커뮤니티 페이지 안내"><a href="#community-posts">회원 게시글</a><a href="#operating-notes">기록·대회 운영 노트</a><a href="#posting-guide">질문·후기 작성 가이드</a></nav>
 <nav className={board.boards} aria-label="커뮤니티 게시판">{COMMUNITY_CATEGORIES.map(c=><Link className={board.board} href={href(1,c.id)} key={c.id} aria-current={category===c.id?'page':undefined}><strong>{c.label}</strong><small>{c.description}</small><span>{groups.find(g=>g.category===c.id)?._count._all??0}개 이야기 →</span></Link>)}</nav>
 <div className={board.toolbar}><nav className={board.scopes} aria-label="내 커뮤니티 활동"><Link href={href(1,'','all')} aria-current={!category&&scope==='all'?'page':undefined}>전체 글</Link><Link href={href(1,category,'mine')} aria-current={scope==='mine'?'page':undefined}>내가 쓴 글</Link><Link href={href(1,category,'commented')} aria-current={scope==='commented'?'page':undefined}>댓글 남긴 글</Link></nav><div className={styles.actions}><Link className={styles.button} href={writeHref}>글쓰기 +</Link>{viewer?.role==='SUPER_ADMIN'&&<Link className={styles.secondary} href="/community/moderation">신고·숨김 관리</Link>}</div></div>
 {category==='EQUIPMENT'&&<p className={board.tip}>제품 종류와 모델별 소개·후기를 찾으려면 <Link href="/equipment">볼링용품 페이지 →</Link></p>}
 {category==='TOURNAMENT'&&<p className={board.tip}>참가 경험과 소식을 나누는 게시판입니다. 사이트에 등록된 일정과 요강은 <Link href="/competitions">대회정보 →</Link>에서 확인하세요.</p>}
 <form action="/community" className={board.search}><input type="hidden" name="category" value={category}/><input type="hidden" name="scope" value={scope}/><input type="search" name="q" aria-label="게시글 검색" placeholder="제목이나 내용으로 검색" defaultValue={q} maxLength={100}/><select name="sort" aria-label="게시글 정렬" defaultValue={sort}><option value="latest">최신순</option><option value="oldest">오래된순</option></select><button className={styles.secondary}>검색</button></form>
 <div className={board.toolbar} id="community-posts"><h2>{scope==='mine'?'내가 쓴 글':scope==='commented'?'댓글 남긴 글':category?categoryLabel(category):'전체 이야기'}</h2><span className={board.counter}>총 {count}개 글</span></div>
 {posts.length?<div className={board.list}><div className={board.listHead}><span>게시판</span><span>제목</span><span>작성자</span><span>작성일</span><span>댓글</span></div>{posts.map(p=><Link key={p.id} href={`/${p.category==='EQUIPMENT'?'equipment':'community'}/${p.id}`} className={board.row}><span className={board.badge}>{categoryLabel(p.category)}</span><strong>{p.title}</strong><small>{p.author.name}</small><small>{communityDate(p.createdAt)}</small><span className={board.count} aria-label={`댓글 ${p._count.comments}개`}>{p._count.comments}</span></Link>)}</div>:<div className={styles.empty}><strong>{q?'검색 결과가 없습니다.':scope==='commented'?'아직 댓글을 남긴 글이 없습니다.':'아직 등록된 글이 없습니다.'}</strong><p>다른 게시판을 둘러보거나 첫 이야기를 나눠보세요.</p><Link href={writeHref}>글 작성하기 →</Link></div>}
 <nav className={styles.pager} aria-label="게시글 페이지">{page>1&&<Link className={styles.secondary} href={href(page-1)}>이전</Link>}<span>{page} / {pages}페이지</span>{page<pages&&<Link className={styles.secondary} href={href(page+1)}>다음</Link>}</nav>
 <CommunityPostingGuide/>
 <section id="operating-notes" className={styles.section} aria-labelledby="operating-notes-title"><div className={styles.sectionHead}><h2 id="operating-notes-title">기록·대회 운영 노트</h2></div><p>BowlingManager가 작성한 서비스 이용 안내입니다. 회원 게시글·사용 후기와 구분해 제공합니다.</p><div className={styles.grid}>{OPERATING_GUIDES.map(article=><article key={article.slug} className={styles.card}><span className={styles.tag}>편집부 안내 · {article.updatedAt}</span><h3><Link href={'/guide/'+article.slug}>{article.title}</Link></h3><p>{article.description}</p><Link href={'/guide/'+article.slug}>안내 읽기 →</Link></article>)}</div></section>
 <aside className={styles.notice}>공개 게시판입니다. 개인정보·비방·도배·무단 광고를 피하고 서로를 존중해주세요. 문제가 있는 글이나 댓글은 상세 화면에서 신고할 수 있습니다.</aside>
 </div></div>;
}
