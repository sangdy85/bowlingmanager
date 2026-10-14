import Link from 'next/link';
import styles from './Public.module.css';

export default function PublicNav() {
  return <nav className={styles.nav} aria-label="공개 콘텐츠">
    <Link href="/">홈</Link><Link href="/competitions">대회 정보</Link>
    <Link href="/equipment">볼링 용품</Link><Link href="/community">커뮤니티</Link>
    <Link href="/guide">이용방법 & 가이드</Link><Link href="/tools/average">평균 계산기</Link>
  </nav>;
}
