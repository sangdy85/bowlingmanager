import Link from 'next/link';
import styles from './Public.module.css';

type AppGrowthCtaProps = {
  source: 'home' | 'guide' | 'average';
  variant: 'full' | 'compact';
};

const copy = {
  home: {
    title: '기록을 이어가고 싶다면',
    description: 'BowlingManager 앱에서는 개인 기록과 동호회 활동을 한 곳에서 관리할 수 있습니다.',
  },
  guide: {
    title: '이 내용을 내 실제 기록과 함께 관리하고 싶다면',
    description: 'BowlingManager 앱에서 점수와 에버리지 변화를 이어서 확인할 수 있습니다.',
  },
  average: {
    title: '오늘 평균을 계산했다면, 다음 게임부터 기록을 계속 쌓아보세요.',
    description: '계산에서 끝내지 않고 개인 기록과 동호회 활동을 한 곳에서 관리할 수 있습니다.',
  },
} as const;

export default function AppGrowthCta({ source, variant }: AppGrowthCtaProps) {
  const content = copy[source];
  const headingId = `app-growth-cta-${source}`;

  return <aside className={styles.appCta} data-variant={variant} aria-labelledby={headingId}>
    <p className={styles.appCtaEyebrow}>BOWLINGMANAGER MOBILE</p>
    <h2 id={headingId}>{content.title}</h2>
    <p>{content.description}</p>
    <div className={styles.appCtaActions}>
      <Link href={`/app?from=${source}`}>모바일 앱 알아보기 →</Link>
    </div>
  </aside>;
}
