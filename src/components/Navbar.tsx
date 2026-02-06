import Link from 'next/link';
import styles from './Navbar.module.css';
import { auth } from "@/auth";

export default async function Navbar() {
  let session = null;

  try {
    // Attempting to get session. 
    // This will trigger 'Dynamic Server Usage' in static build, 
    // which is fine as long as we catch it or the page is rendered dynamically.
    session = await auth();
  } catch (e) {
    // Gracefully handle the error during static generation
  }

  const user = session?.user;

  return (
    <nav className={styles.navbar}>
      <div className={`container ${styles.navContent}`}>
        <Link href="/" className={styles.logo}>
          BowlingManager
        </Link>

        <div className={styles.links}>
          {user ? (
            <>
              <Link href="/dashboard" className={styles.link}>대시보드</Link>
              <Link href="/personal" className={styles.link}>개인기록</Link>
              <span className={styles.userName}>{user.name}님</span>
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
