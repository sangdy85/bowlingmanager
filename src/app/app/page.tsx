import type { Metadata } from 'next';
import Link from 'next/link';
import PublicNav from '@/components/public/PublicNav';
import styles from '@/components/public/Public.module.css';
import { ANDROID_APP_URL, PUBLIC_ORIGIN } from '@/lib/public-web';

export const metadata: Metadata = {
  title: 'BowlingManager 모바일 앱 | 개인 기록과 동호회 관리',
  description: '개인 점수와 에버리지부터 동호회 일정, 참석, 정모 점수와 시즌 순위까지 BowlingManager 앱의 주요 기능을 확인하세요.',
  alternates: { canonical: `${PUBLIC_ORIGIN}/app` },
  robots: { index: false, follow: true },
};

const audiences = [
  {
    title: '개인 볼러',
    features: ['개인 점수와 에버리지 기록', '점수판 촬영과 OCR 기록 보조', '최근 기록과 통계 확인'],
  },
  {
    title: '동호회 회원',
    features: ['동호회 일정과 참석 확인', '정모 점수와 시즌 순위 확인', '동호회 게시판과 알림'],
  },
  {
    title: '총무·운영진',
    features: ['회원과 일정 관리', '참석과 정모 점수 관리', '시즌 순위와 동호회 소식 관리'],
  },
] as const;

export default function AppLandingPage() {
  return <div className={styles.surface}>
    <PublicNav />
    <main>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>BOWLINGMANAGER MOBILE</p>
        <h1>내 기록부터 우리 동호회까지, BowlingManager</h1>
        <p className={styles.intro}>게임이 끝난 뒤에도 기록을 이어보고, 함께하는 동호회 활동을 한 곳에서 관리하세요.</p>
      </header>

      <section aria-labelledby="app-features-heading">
        <h2 id="app-features-heading">누구에게 필요한가요?</h2>
        <div className={styles.grid}>
          {audiences.map(audience => <article className={styles.card} key={audience.title}>
            <h3>{audience.title}</h3>
            <ul>{audience.features.map(feature => <li key={feature}>{feature}</li>)}</ul>
          </article>)}
        </div>
      </section>

      <section className={styles.appCta} aria-labelledby="app-start-heading">
        <p className={styles.appCtaEyebrow}>시작하기</p>
        <h2 id="app-start-heading">BowlingManager를 사용해 보세요</h2>
        {ANDROID_APP_URL
          ? <div className={styles.appCtaActions}>
              <a className={styles.button} href={ANDROID_APP_URL} target="_blank" rel="noopener noreferrer">Android 앱에서 시작하기</a>
              <Link href="/login">기존 계정으로 로그인</Link>
            </div>
          : <>
              <p>Android 앱은 현재 테스트/출시 준비 중입니다.</p>
              <div className={styles.appCtaActions}>
                <Link className={styles.button} href="/register">웹에서 회원가입하기</Link>
                <Link href="/login">기존 계정으로 로그인</Link>
              </div>
            </>}
      </section>
    </main>
  </div>;
}
