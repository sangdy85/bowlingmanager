import Link from 'next/link';
import type { Metadata } from 'next';
import { auth } from '@/auth';
import { PUBLISHED_GUIDE_ARTICLES } from '@/lib/guide-data';
import { PUBLIC_ORIGIN, PRIORITY_GUIDES } from '@/lib/public-web';
import AboutPageContent from '@/components/AboutPageContent';
import styles from '@/components/portal/Portal.module.css';
export const metadata:Metadata={title:'이용방법 & 볼링 가이드 | 볼링매니저',description:'서비스 이용방법과 볼링 점수·장비·에티켓·동호회 운영 가이드를 한곳에서 찾아보세요.',alternates:{canonical:PUBLIC_ORIGIN+'/guide'}};
export default async function GuideListPage({searchParams}:{searchParams:Promise<{tab?:string;category?:string}>}) {
    const params=await searchParams;const service=params.tab==='service';
    const categories:string[]=[...new Set(PUBLISHED_GUIDE_ARTICLES.map(a=>a.category))];
    const selected=categories.includes(params.category??'')?params.category!:'';
    const articles=[...PUBLISHED_GUIDE_ARTICLES].filter(a=>!selected||a.category===selected).sort((a,b)=>Number(PRIORITY_GUIDES.includes(b.slug))-Number(PRIORITY_GUIDES.includes(a.slug)));
    const session=service?await auth():null;
    return <div className={styles.page}><div className={styles.inner}><header className={styles.headline}><p className={styles.eyebrow}>LEARN & PLAY</p><h1>이용방법 & 볼링 가이드</h1><p>사이트 사용법부터 볼링의 기초와 장비, 동호회 운영까지. 지금 필요한 주제부터 찾아보세요.</p></header>
        <nav className={styles.tabs} aria-label="가이드 구분"><Link href="/guide" aria-current={!service?'page':undefined}>볼링 가이드</Link><Link href="/guide?tab=service" aria-current={service?'page':undefined}>서비스 이용방법</Link><Link href="/tools/average">무료 평균 계산기 ↗</Link></nav>
        {service?<section id="how-to" className={styles.guideSection}><AboutPageContent embedded isLoggedIn={!!session?.user} isAdmin={session?.user?.role==='SUPER_ADMIN'}/></section>:<><nav className={styles.tabs} aria-label="가이드 주제"><Link href="/guide" aria-current={!selected?'page':undefined}>모든 주제</Link>{categories.map(c=><Link key={c} href={`/guide?category=${encodeURIComponent(c)}`} aria-current={selected===c?'page':undefined}>{c}</Link>)}</nav><div className={styles.grid}>{articles.map(a=><Link key={a.slug} href={`/guide/${a.slug}`} className={styles.card}><span className={styles.tag}>{a.category}</span><h2>{a.title}</h2><p>{a.description}</p><span className={styles.cardFoot}>{a.readTime} · 읽어보기 →</span></Link>)}</div><aside className={styles.notice}>규칙과 장비 정보는 해당 대회 요강과 연결된 원문도 함께 확인하세요. <Link href="/guide?tab=service#standards">서비스 설명·작성 기준 →</Link></aside></>}
    </div></div>;
}
