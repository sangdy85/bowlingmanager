import Link from 'next/link';
import styles from './public/Public.module.css';
export default function Footer() {
 return <footer className={styles.footer}><p><strong>BowlingManager</strong> · 볼링 기록과 동호회 운영</p>
 <nav aria-label="하단 안내"><Link href="/guide">볼링 가이드</Link><Link href="/tools/average">평균 계산기</Link><Link href="/about">서비스 소개·작성 기준</Link><Link href="/inquiry">문의하기</Link><Link href="/privacy">개인정보처리방침</Link><Link href="/terms">이용약관</Link><Link href="/disclaimer">책임 한계</Link></nav>
 <p>© {new Date().getFullYear()} BowlingManager</p></footer>;
}
