import Link from 'next/link';
import type { Metadata } from 'next';
import { findPublishedGuideArticle } from '@/lib/guide-data';
import { PRIORITY_GUIDES, PUBLIC_ORIGIN } from '@/lib/public-web';
import { EQUIPMENT_SOURCES, latestCommunityPosts, latestCompetitionNotices, latestEquipmentPosts } from '@/lib/portal-data';
import { equipmentType } from '@/lib/equipment';
import { noticeDateRange, noticePhase } from '@/lib/competition-notices';
import { categoryLabel, communityDate } from '@/lib/community';
import styles from '@/components/portal/Portal.module.css';
import AppGrowthCta from '@/components/public/AppGrowthCta';
import { auth } from '@/auth';

export const metadata: Metadata = { title:'볼링매니저 | 동호회 · 볼링장 운영과 볼링 정보', description:'동호회 정기전과 기록, 볼링장 리그와 대회 운영부터 대회·용품 정보와 커뮤니티까지 한곳에서 이용하세요.', alternates:{canonical:PUBLIC_ORIGIN} };
export default async function Home() {
    const session=await auth();
    const [tournaments, posts, equipmentPosts] = await Promise.allSettled([latestCompetitionNotices(), latestCommunityPosts(), latestEquipmentPosts()]);
    return <div className={styles.page}>
        <header className={styles.hero}>
            <div>
                <p className={styles.eyebrow}>BOWLING, TOGETHER</p>
                <h1>볼링의 모든 순간,<br />여기서 함께.</h1>
                <p>다음 대회를 찾고, 새로운 장비를 알아보세요.<br />동호회 활동과 볼링장 운영, 볼러들의 이야기를 한곳에서.</p>
                <div className={styles.actions}><Link className={styles.button} href={session?.user?'/team':'/login'} prefetch={false}>동호회 관리 →</Link><Link className={styles.secondary} href="/centers">볼링장, 대회 보기 →</Link></div>
            </div>
            <div className={styles.ballArt} aria-hidden="true" />
        </header>
        <nav className={styles.quickLinks} aria-label="볼링 정보 바로가기"><Link href="/competitions">대회 정보<span>일정 · 요강 · 경기 결과</span></Link><Link href="/equipment">볼링 용품<span>볼링공 · 장비 · 선택 가이드</span></Link><Link href="/community">커뮤니티<span>질문 · 경험 · 정보 공유</span></Link><Link href="/guide">이용방법 & 가이드<span>처음 시작하는 볼링 생활</span></Link></nav>
        <div className={styles.inner}>
            <section className={styles.section} aria-labelledby="bowling-workspace-title">
                <div className={styles.sectionHead}><div><p className={styles.eyebrow}>YOUR BOWLING WORKSPACE</p><h2 id="bowling-workspace-title">함께 치고, 더 편하게 운영하세요.</h2></div><Link href="/guide?tab=service">운영 기능 이용방법 →</Link></div>
                <div className={styles.workspaceGrid}>
                    <article className={styles.workspaceCard} data-kind="club">
                        <div className={styles.workspaceTop}><span className={styles.workspaceIcon} aria-hidden="true">👥</span><span className={styles.workspaceLabel}>동호회 · 팀 관리</span></div>
                        <h3>우리 팀의 일정과 기록,<br />흩어지지 않게.</h3>
                        <p>회원들과 정기전을 준비하고, 참가와 출석·점수를 관리하세요. 팀 기록과 내부 게시판으로 활동을 이어갈 수 있습니다.</p>
                        <ul className={styles.featureChips} aria-label="동호회 주요 기능"><li>회원 관리</li><li>일정 · 참가 확인</li><li>정기전 기록</li><li>팀 게시판</li></ul>
                        <div className={styles.workspaceActions}><Link className={styles.button} href={session?.user?'/team':'/login'} prefetch={false}>{session?.user?'내 동호회 열기':'로그인하고 동호회 관리'} →</Link><Link href={session?.user?'/team/join':'/login'} prefetch={false}>팀 가입</Link><Link href={session?.user?'/team/create':'/login'} prefetch={false}>팀 만들기</Link></div>
                    </article>
                    <article className={styles.workspaceCard} data-kind="center">
                        <div className={styles.workspaceTop}><span className={styles.workspaceIcon} aria-hidden="true">🎳</span><span className={styles.workspaceLabel}>볼링장 · 대회 운영</span></div>
                        <h3>상주리그부터 챔프전까지,<br />경기 운영을 한곳에서.</h3>
                        <p>볼링장별 대회와 리그를 확인하고, 관리자는 참가자·레인 배정·점수 입력·결과 발표를 기존 운영 화면에서 관리하세요.</p>
                        <ul className={styles.featureChips} aria-label="볼링장 주요 기능"><li>볼링장 회원</li><li>리그 · 대회</li><li>참가자 · 레인</li><li>점수 · 결과표</li></ul>
                        <div className={styles.workspaceActions}><Link className={styles.button} href="/centers">볼링장 · 대회 열기 →</Link><Link href="/competitions">전체 대회 찾기</Link></div>
                        <p className={styles.workspaceHint}>대회 운영 메뉴는 해당 볼링장 관리 권한으로 로그인한 뒤 표시됩니다.</p>
                    </article>
                </div>
                <div className={styles.recordStrip}><div><strong>내 볼링 기록도 함께</strong><span>개인 점수와 경기 기록을 나의 기록실에서 이어가세요.</span></div><Link href={session?.user?'/personal':'/login'} className={styles.secondary} prefetch={false}>나의 기록실 →</Link></div>
            </section>
            <section className={styles.section}><div className={styles.sectionHead}><div><p className={styles.eyebrow}>ON THE LANES</p><h2>지금 만나는 대회</h2></div><Link href="/competitions">전체 대회 보기 →</Link></div>
                {tournaments.status==='fulfilled' ? tournaments.value.length ? <div className={styles.grid}>{tournaments.value.map(t => <Link key={t.id} href={`/competitions/${t.id}`} className={styles.card}><span className={styles.tag}>{t.format} · {noticePhase(t)}</span><h3>{t.title}</h3><p>{t.organizer} · {t.venue}</p><div className={styles.cardFoot}>{noticeDateRange(t.startDate,t.endDate)} · 대회 요강 보기 →</div></Link>)}</div> : <div className={styles.empty}><strong>예정·진행 중인 등록 대회가 아직 없습니다.</strong><Link href="/competitions?status=all">전체 대회정보 둘러보기 →</Link></div> : <div className={styles.empty}>대회 정보를 불러오지 못했습니다. 잠시 후 다시 확인해주세요.</div>}
            </section>
            <div className={styles.twoColumns}>
                <section className={styles.section}><div className={styles.sectionHead}><div><p className={styles.eyebrow}>BOWLING TALK</p><h2>함께 나누는 볼링 이야기</h2></div><Link href="/community">게시판으로 →</Link></div>
                    {posts.status==='fulfilled' ? posts.value.length ? <div className={styles.list}>{posts.value.map(post => <Link key={post.id} href={`/community/${post.id}`} className={styles.postRow}><div><span className={styles.tag}>{categoryLabel(post.category)}</span><h3>{post.title}</h3><small>{post.author.name} · {communityDate(post.createdAt)}</small></div><span className={styles.commentCount}>댓글 {post._count.comments}</span></Link>)}</div> : <div className={styles.empty}><strong>첫 볼링 이야기를 들려주세요.</strong><p>처음 산 볼, 오늘의 경기, 궁금했던 기술까지.</p><Link className={styles.button} href="/community/new">첫 글 작성하기</Link></div> : <div className={styles.empty}>커뮤니티 정보를 불러오지 못했습니다. 잠시 후 다시 확인해주세요.</div>}
                </section>
                <section className={styles.section}>
                    <div className={styles.sectionHead}><div><p className={styles.eyebrow}>GEAR NOTE</p><h2>용품 소개 & 사용 후기</h2></div><Link href="/equipment">전체 보기 →</Link></div>
                    {equipmentPosts.status==='fulfilled'&&equipmentPosts.value.length>0&&<div className={styles.list}>{equipmentPosts.value.map(post=><Link key={post.id} href={`/equipment/${post.id}`} className={styles.postRow}><div><span className={styles.tag}>{equipmentType(post.equipmentType)}</span><h3>{post.title}</h3><small>{post.author.name}</small></div></Link>)}</div>}
                    <article className={styles.card}><div className={styles.equipmentArt}><span className={styles.miniBall} aria-hidden="true" />BALL / GEAR / CHOICE</div><h3>새로운 볼을 보기 전, 내 장비부터 이해하기</h3><p>제조사 최신 라인업과 사양 확인 방법을 모았습니다. 국내 출시·가격·재고는 판매처에서 별도로 확인하세요.</p><div className={styles.cardFoot}>{EQUIPMENT_SOURCES.slice(0,2).map(source => <p key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title} ↗</a></p>)}</div></article>
                </section>
            </div>
            <section className={styles.section}><div className={styles.sectionHead}><div><p className={styles.eyebrow}>LEARN & PLAY</p><h2>볼링, 차근차근 알아가기</h2></div><Link href="/guide">이용방법 & 가이드 →</Link></div><div className={styles.grid}>{PRIORITY_GUIDES.map(slug => {const article=findPublishedGuideArticle(slug);return article ? <Link key={slug} href={`/guide/${slug}`} className={styles.card}><span className={styles.tag}>{article.category}</span><h3>{article.title}</h3><p>{article.description}</p><span className={styles.cardFoot}>{article.readTime} · 읽어보기 →</span></Link> : null;})}</div></section>
            <aside className={styles.notice}>내 기록과 동호회도 계속 관리하세요. <Link href={session?.user?'/personal':'/login'} prefetch={false}>나의 기록실</Link> · <Link href={session?.user?'/team':'/login'} prefetch={false}>팀 관리</Link> · <Link href="/tools/average">무료 평균 계산기</Link></aside>
            <AppGrowthCta source="home" variant="full" />
        </div>
    </div>;
}
