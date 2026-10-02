import { auth } from '@/auth';
import Link from 'next/link';
import type { Metadata } from 'next';
import { findPublishedGuideArticle } from '@/lib/guide-data';
import { PRIORITY_GUIDES, PUBLIC_ORIGIN } from '@/lib/public-web';
import PublicNav from '@/components/public/PublicNav';
import AppGrowthCta from '@/components/public/AppGrowthCta';
import styles from '@/components/public/Public.module.css';
export const metadata: Metadata = {title:'볼링매니저 | 볼링 기록 해석·동호회 운영·무료 도구',description:'볼링 점수 계산법과 기록 해석, 동호회 운영 가이드를 읽고 가입 없이 평균 계산기를 사용하세요.',alternates:{canonical:PUBLIC_ORIGIN}};
export default async function Home() {
 const session=await auth();
 return <div className={styles.surface}><PublicNav /><header className={styles.hero}><p className={styles.eyebrow}>BOWLING MANAGER · 기록에서 시작하는 볼링</p>
 <h1>볼링 기록을 이해하고,<br />동호회를 더 편하게<br />운영하세요.</h1>
 <p className={styles.intro}>한 게임의 점수부터 함께하는 정기전까지.<br />읽고, 계산하고, 다음 경기를 준비하는 공간입니다.</p>
 <div className={styles.actions}><Link className={styles.button} href="/tools/average">내 점수 평균 계산하기</Link><Link href="/guide">가이드 둘러보기 →</Link></div></header>
 <section className={styles.card}><span className={styles.tag}>바로 사용할 수 있는 무료 도구</span><h2>오늘 친 세 게임, 평균은 얼마일까요?</h2>
 <p>120 · 150 · 180점 → 총점 450점, 평균 150.0점. 가상 예시처럼 내 점수를 넣어 게임 수와 최고·최저까지 확인하세요. 가입이나 점수 저장 없이 사용할 수 있습니다.</p><Link href="/tools/average">평균 계산기 열기 →</Link></section>
 <h2>처음 읽기 좋은 가이드</h2><div className={styles.grid}>{PRIORITY_GUIDES.map(slug=>{const article=findPublishedGuideArticle(slug);if(!article)return null;return <article key={slug} className={styles.card}><span className={styles.tag}>{article.category}</span><h3><Link href={'/guide/'+slug}>{article.title}</Link></h3><p>{article.description}</p></article>;})}</div>
 <AppGrowthCta source="home" variant="full" />
 <section><h2>회원 기능으로 계속하기</h2><p>개인 기록 저장과 팀 관리는 로그인 후 사용하는 회원 기능입니다. 공개 가이드와 계산기는 비회원도 이용할 수 있습니다.</p>
 <div className={styles.actions}><Link href={session?.user?'/personal':'/login'} prefetch={false}>나의 기록실{!session?.user&&' · 로그인 필요'}</Link><Link href={session?.user?'/team':'/login'} prefetch={false}>팀 관리{!session?.user&&' · 로그인 필요'}</Link><Link href="/centers" prefetch={false}>볼링장/대회</Link></div></section>
 <aside className={styles.notice}><h2>어떻게 이용하나요?</h2><p>점수판 확인 → 게임별 점수 입력 → 결과 대조 → 기간별 기록 확인. OCR 결과도 최종 저장 전에 직접 확인하세요.</p><Link href="/about">서비스 이용 설명과 작성 기준</Link> · <Link href="/inquiry">문의하기</Link></aside></div>;
}
