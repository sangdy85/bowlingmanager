import Link from 'next/link';
import { PUBLISHED_GUIDE_ARTICLES } from '@/lib/guide-data';
import { PUBLIC_ORIGIN, PRIORITY_GUIDES } from '@/lib/public-web';
import PublicNav from '@/components/public/PublicNav';
import styles from '@/components/public/Public.module.css';
import type { Metadata } from 'next';
export const metadata: Metadata = { title: '볼링 가이드 | 기록 해석과 동호회 운영', description: '점수 계산, 평균 해석, 정기전 운영부터 장비와 에티켓까지 주제별 볼링 가이드를 읽어보세요.', alternates: { canonical: PUBLIC_ORIGIN + '/guide' } };
export default function GuideListPage() {
 const articles = [...PUBLISHED_GUIDE_ARTICLES].sort((a,b) => Number(PRIORITY_GUIDES.includes(b.slug))-Number(PRIORITY_GUIDES.includes(a.slug)));
 return <div className={styles.surface}><PublicNav /><header className={styles.hero}>
 <p className={styles.eyebrow}>BOWLING GUIDE</p><h1>기록을 읽고,<br />다음 경기를 준비하세요.</h1>
 <p className={styles.intro}>점수판의 숫자가 궁금할 때, 동호회 정기전을 준비할 때. 필요한 주제부터 읽고 무료 도구로 직접 확인하세요.</p><Link href="/tools/average">평균 계산기 바로 사용하기 →</Link>
 </header><div className={styles.grid}>{articles.map(article => <article className={styles.card} key={article.slug}>
 <span className={styles.tag}>{article.category} · {article.readTime}</span><h2><Link href={'/guide/'+article.slug}>{article.title}</Link></h2><p>{article.description}</p>
 </article>)}</div><p>경기 규칙은 대회별로 다를 수 있습니다. 적용 전 주관사의 최신 요강을 확인하세요. <Link href="/about#standards">콘텐츠 작성 기준</Link></p></div>;
}
