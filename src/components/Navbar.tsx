import Link from 'next/link';
import styles from './Navbar.module.css';

export default async function Navbar() {
  const isLoggedIn = false;

  return (
    <nav className={styles.navbar}>
      <div className={`container ${styles.navContent}`}>
        <Link href="/" className={styles.logo}>
          BowlingManager
        </Link>

        <div className={styles.links}>
          <Link href="/login" className={styles.link}>로그인</Link>
          <Link href="/register" className="btn btn-primary">회원가입</Link>
        </div>
      </div>
    </nav>
  );
}
