import Link from 'next/link';
import styles from './Navbar.module.css';

export default async function Navbar() {
  const isLoggedIn = false; // Emergency Neutralization

  return (
    <nav className={styles.navbar}>
      <div className={`container ${styles.navContent}`}>
        <Link href="/" className={styles.logo}>
          BowlingManager
        </Link>

        <div className={styles.links}>
          {isLoggedIn ? (
            <>
              <Link href="/" className={styles.link}>홈</Link>
              <Link href="/personal" className={styles.link}>점수 기록</Link>
              <Link href="/team" className={styles.link}>팀 관리</Link>
              <Link href="/stats" className={styles.link}>통계/순위</Link>
            </>
          ) : (
            <>
              <Link href="/login" className={styles.link}>로그인</Link>
              <Link href="/register" className="btn btn-primary">회원가입</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
