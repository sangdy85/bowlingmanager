import Link from 'next/link';
import styles from './public/Public.module.css';
import { PUBLIC_CONTACT_EMAIL, PUBLIC_CONTACT_HREF } from '@/lib/public-contact';
export default function Footer() {
 return <footer className={styles.footer}><p><strong>BowlingManager</strong> · 동호회와 볼링장 운영, 볼링 정보와 사람을 잇는 공간</p>
 <nav aria-label="기록과 운영"><Link href="/personal" prefetch={false}>나의 기록실</Link><Link href="/team" prefetch={false}>동호회 관리</Link><Link href="/centers">볼링장 · 대회 운영</Link></nav>
 <nav aria-label="하단 안내"><Link href="/competitions">대회 정보</Link><Link href="/equipment">볼링 용품</Link><Link href="/community">커뮤니티</Link><Link href="/guide">이용방법 & 가이드</Link><Link href="/tools/average">평균 계산기</Link><Link href="/guide?tab=service#standards">작성 기준</Link><Link href="/inquiry">문의하기</Link><Link href="/privacy">개인정보처리방침</Link><Link href="/terms">이용약관</Link><Link href="/disclaimer">책임 한계</Link></nav>
 <p>이용·콘텐츠 정정 문의: <a href={PUBLIC_CONTACT_HREF}>{PUBLIC_CONTACT_EMAIL}</a> · 비회원도 이메일로 문의할 수 있습니다.</p>
 <p>© {new Date().getFullYear()} BowlingManager</p></footer>;
}
