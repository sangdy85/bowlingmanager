import Link from 'next/link';
import styles from './Public.module.css';

export default function PublicNav() {
  return <nav className={styles.nav} aria-label="공개 콘텐츠">
    <Link href="/">홈</Link><Link href="/guide">볼링 가이드</Link>
    <Link href="/guide/average-and-score-distribution">기록 분석</Link>
    <Link href="/guide/club-event-checklist">동호회 운영</Link>
    <Link href="/tools/average">무료 평균 계산기</Link><Link href="/about">서비스 소개</Link>
  </nav>;
}
